import { useState, useMemo } from 'react'
import { formatDate } from '../../lib/helpers'
import { useInventoryMovements } from '../../hooks/useSupabaseQuery'
import { useExport } from '../../hooks/useExport'
import { Search, Download } from 'lucide-react'

export default function MovementsTab() {
    const today = new Date()
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
    const [search, setSearch] = useState('')
    const { exportExcel, exportPDF } = useExport()

    const { data: movements, isLoading, error } = useInventoryMovements(startDate, endDate)

    // Build movement data with true opening stock
    const movementData = useMemo(() => {
        if (!movements) return []

        const { periodReceipts, periodExports, beforeReceipts, beforeExports } = movements

        // Calculate opening stock per product (sum of all receipts before period - sum of all exports before period)
        const openingStock = {}
        beforeReceipts.forEach(r => {
            openingStock[r.product_id] = (openingStock[r.product_id] || 0) + (r.quantity || 0)
        })
        beforeExports.forEach(e => {
            openingStock[e.product_id] = (openingStock[e.product_id] || 0) - (e.quantity || 0)
        })

        // Sum imports in period by product
        const periodImports = {}
        const productMap = {}
        periodReceipts.forEach(r => {
            periodImports[r.product_id] = (periodImports[r.product_id] || 0) + (r.quantity || 0)
            if (r.product) productMap[r.product_id] = r.product
        })

        // Sum exports in period by product
        const periodExportQty = {}
        periodExports.forEach(e => {
            periodExportQty[e.product_id] = (periodExportQty[e.product_id] || 0) + (e.quantity || 0)
            if (e.product) productMap[e.product_id] = e.product
        })

        // Also add products from before-period data
        beforeReceipts.forEach(r => { if (r.product) productMap[r.product_id] = r.product })
        beforeExports.forEach(e => { if (e.product) productMap[e.product_id] = e.product })

        // Merge all product IDs that had any activity
        const allProductIds = new Set([
            ...Object.keys(openingStock),
            ...Object.keys(periodImports),
            ...Object.keys(periodExportQty),
        ])

        const rows = []
        allProductIds.forEach(pid => {
            const product = productMap[pid]
            if (!product) return

            const openQty = openingStock[pid] || 0
            const imported = periodImports[pid] || 0
            const exported = periodExportQty[pid] || 0
            const closeQty = openQty + imported - exported

            // Skip products with no activity and zero stock
            if (openQty === 0 && imported === 0 && exported === 0) return

            rows.push({
                productId: pid,
                product,
                openQty,
                imported,
                exported,
                closeQty,
                change: imported - exported,
            })
        })

        return rows.sort((a, b) => (a.product?.code || '').localeCompare(b.product?.code || ''))
    }, [movements])

    // Filter by search
    const filteredData = useMemo(() => {
        if (!search) return movementData
        const q = search.toLowerCase()
        return movementData.filter(r =>
            r.product?.code?.toLowerCase().includes(q) ||
            r.product?.name?.toLowerCase().includes(q) ||
            r.product?.manufacturer?.toLowerCase().includes(q) ||
            r.product?.category?.toLowerCase().includes(q)
        )
    }, [movementData, search])

    // Totals
    const totals = useMemo(() => ({
        open: filteredData.reduce((s, r) => s + r.openQty, 0),
        imported: filteredData.reduce((s, r) => s + r.imported, 0),
        exported: filteredData.reduce((s, r) => s + r.exported, 0),
        close: filteredData.reduce((s, r) => s + r.closeQty, 0),
    }), [filteredData])

    // Export columns
    const exportColumns = [
        { key: 'code', label: 'Mã SP', exportRender: (_, r) => r.product?.code || '' },
        { key: 'name', label: 'Tên SP', exportRender: (_, r) => r.product?.name || '' },
        { key: 'unit', label: 'ĐVT', exportRender: (_, r) => r.product?.unit || '' },
        { key: 'category', label: 'Ngành hàng', exportRender: (_, r) => r.product?.category || '' },
        { key: 'openQty', label: 'SL đầu kỳ' },
        { key: 'imported', label: 'SL nhập kho' },
        { key: 'exported', label: 'SL xuất kho' },
        { key: 'closeQty', label: 'SL cuối kỳ' },
    ]

    // Quick period presets
    function setPeriod(type) {
        const now = new Date()
        let start, end = now
        switch (type) {
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1); break
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                end = new Date(now.getFullYear(), now.getMonth(), 0); break
            case 'thisQuarter': {
                const q = Math.floor(now.getMonth() / 3) * 3
                start = new Date(now.getFullYear(), q, 1); break
            }
            case 'thisYear':
                start = new Date(now.getFullYear(), 0, 1); break
            default: return
        }
        setStartDate(start.toISOString().split('T')[0])
        setEndDate(end.toISOString().split('T')[0])
    }

    return (
        <div>
            {/* Controls row */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Từ ngày</label>
                    <input type="date" className="form-input" value={startDate}
                        onChange={e => setStartDate(e.target.value)} style={{ width: 150 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Đến ngày</label>
                    <input type="date" className="form-input" value={endDate}
                        onChange={e => setEndDate(e.target.value)} style={{ width: 150 }} />
                </div>

                {/* Period presets */}
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    {[
                        { key: 'thisMonth', label: 'Tháng này' },
                        { key: 'lastMonth', label: 'Tháng trước' },
                        { key: 'thisQuarter', label: 'Quý này' },
                        { key: 'thisYear', label: 'Năm nay' },
                    ].map(p => (
                        <button key={p.key} className="btn btn-ghost btn-sm" onClick={() => setPeriod(p.key)}
                            style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input className="form-input" placeholder="Tìm mã SP, tên, hãng SX..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: 32, fontSize: 'var(--font-sm)' }} />
                </div>

                {/* Export buttons */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
                    <button className="btn btn-ghost btn-sm"
                        onClick={() => exportExcel(exportColumns, filteredData, `bien_dong_${startDate}_${endDate}`, 'Biến động kho')}>
                        <Download size={14} /> Excel
                    </button>
                    <button className="btn btn-ghost btn-sm"
                        onClick={() => exportPDF(exportColumns, filteredData, `Biến động kho ${startDate} → ${endDate}`, `bien_dong_${startDate}_${endDate}`)}>
                        <Download size={14} /> PDF
                    </button>
                </div>
            </div>

            {/* Formula reminder */}
            <div style={{
                padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-3)',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-xs)', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <span>📊</span>
                <span><strong>Đầu kỳ</strong> = Tổng nhập trước kỳ − Tổng xuất trước kỳ</span>
                <span style={{ color: 'var(--text-tertiary)' }}>|</span>
                <span><strong>Cuối kỳ</strong> = Đầu kỳ + Nhập trong kỳ − Xuất trong kỳ</span>
                <span style={{ color: 'var(--text-tertiary)' }}>|</span>
                <span>Hiển thị <strong>{filteredData.length}</strong> sản phẩm</span>
            </div>

            {/* Error state */}
            {error && (
                <div style={{ padding: 'var(--space-3)', background: 'rgba(214,48,49,0.08)', borderRadius: 'var(--radius-md)', color: '#D63031', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-3)' }}>
                    ⚠️ Lỗi tải dữ liệu: {error.message}
                </div>
            )}

            {isLoading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Mã SP</th>
                                <th>Tên sản phẩm</th>
                                <th>ĐVT</th>
                                <th>Ngành hàng</th>
                                <th style={{ textAlign: 'right', color: '#FDCB6E' }}>SL đầu kỳ</th>
                                <th style={{ textAlign: 'right', color: '#00B894' }}>SL nhập kho</th>
                                <th style={{ textAlign: 'right', color: '#D63031' }}>SL xuất kho</th>
                                <th style={{ textAlign: 'right', color: '#0984E3', fontWeight: 800 }}>SL cuối kỳ</th>
                                <th style={{ textAlign: 'right' }}>Biến động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length === 0 ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>
                                    Không có dữ liệu biến động trong khoảng thời gian này
                                </td></tr>
                            ) : filteredData.map((row, idx) => (
                                <tr key={row.productId}>
                                    <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{idx + 1}</td>
                                    <td><span className="code-badge">{row.product?.code}</span></td>
                                    <td>{row.product?.name}</td>
                                    <td style={{ fontSize: 'var(--font-sm)' }}>{row.product?.unit || '—'}</td>
                                    <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{row.product?.category || '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.openQty.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: row.imported > 0 ? '#00B894' : 'var(--text-tertiary)' }}>
                                        {row.imported > 0 ? `+${row.imported.toLocaleString()}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: row.exported > 0 ? '#D63031' : 'var(--text-tertiary)' }}>
                                        {row.exported > 0 ? `-${row.exported.toLocaleString()}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0984E3' }}>{row.closeQty.toLocaleString()}</td>
                                    <td style={{
                                        textAlign: 'right', fontWeight: 600, fontSize: 'var(--font-xs)',
                                        color: row.change > 0 ? '#00B894' : row.change < 0 ? '#D63031' : 'var(--text-tertiary)',
                                    }}>
                                        {row.change > 0 ? `↑${row.change}` : row.change < 0 ? `↓${Math.abs(row.change)}` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {filteredData.length > 0 && (
                            <tfoot>
                                <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 800 }}>
                                    <td colSpan={5} style={{ textAlign: 'right' }}>TỔNG CỘNG</td>
                                    <td style={{ textAlign: 'right' }}>{totals.open.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#00B894' }}>+{totals.imported.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#D63031' }}>-{totals.exported.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#0984E3' }}>{totals.close.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: totals.imported - totals.exported >= 0 ? '#00B894' : '#D63031' }}>
                                        {totals.imported - totals.exported >= 0 ? '↑' : '↓'}{Math.abs(totals.imported - totals.exported).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </div>
    )
}
