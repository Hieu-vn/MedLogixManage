import { useState, useMemo } from 'react'
import { formatDate } from '../../lib/helpers'
import { useInventoryMovements } from '../../hooks/useSupabaseQuery'

export default function MovementsTab({ lots }) {
    const today = new Date()
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])

    const { data: movements, isLoading } = useInventoryMovements(startDate, endDate)
    const receiptItems = movements?.receiptItems || []
    const exportItems = movements?.exportItems || []

    // Calculate period-start stock for each product (current stock + exports - imports in period)
    const movementData = useMemo(() => {
        // Current stock by product
        const currentStock = {}
        lots.forEach(l => {
            const pid = l.product_id
            if (!currentStock[pid]) {
                currentStock[pid] = {
                    product: l.product,
                    currentQty: 0,
                }
            }
            currentStock[pid].currentQty += l.quantity || 0
        })

        // Imports in period by product
        const imports = {}
        receiptItems.forEach(ri => {
            imports[ri.product_id] = (imports[ri.product_id] || 0) + (ri.quantity || 0)
        })

        // Exports in period by product
        const exports = {}
        exportItems.forEach(ei => {
            exports[ei.product_id] = (exports[ei.product_id] || 0) + (ei.quantity || 0)
        })

        // Merge all product IDs
        const allProductIds = new Set([
            ...Object.keys(currentStock),
            ...receiptItems.map(r => r.product_id),
            ...exportItems.map(e => e.product_id),
        ])

        const rows = []
        allProductIds.forEach(pid => {
            const cs = currentStock[pid]
            const product = cs?.product || receiptItems.find(r => r.product_id === pid)?.product || exportItems.find(e => e.product_id === pid)?.product
            if (!product) return

            const imported = imports[pid] || 0
            const exported = exports[pid] || 0
            const endQty = cs?.currentQty || 0
            // Opening = Closing - Imported + Exported
            const openQty = endQty - imported + exported

            rows.push({
                product,
                openQty,
                imported,
                exported,
                endQty,
            })
        })

        return rows.sort((a, b) => (a.product?.code || '').localeCompare(b.product?.code || ''))
    }, [lots, receiptItems, exportItems])

    const totals = useMemo(() => ({
        open: movementData.reduce((s, r) => s + r.openQty, 0),
        imported: movementData.reduce((s, r) => s + r.imported, 0),
        exported: movementData.reduce((s, r) => s + r.exported, 0),
        end: movementData.reduce((s, r) => s + r.endQty, 0),
    }), [movementData])

    return (
        <div>
            {/* Date range filter */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Từ ngày</label>
                    <input type="date" className="form-input" value={startDate}
                        onChange={e => setStartDate(e.target.value)} style={{ width: 160 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Đến ngày</label>
                    <input type="date" className="form-input" value={endDate}
                        onChange={e => setEndDate(e.target.value)} style={{ width: 160 }} />
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    📊 Đầu kỳ + Nhập − Xuất = Cuối kỳ
                </div>
            </div>

            {isLoading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th><th>Mã SP</th><th>Tên sản phẩm</th><th>ĐVT</th><th>Ngành hàng</th>
                                <th style={{ textAlign: 'right', color: '#FDCB6E' }}>SL đầu kỳ</th>
                                <th style={{ textAlign: 'right', color: '#00B894' }}>SL nhập kho</th>
                                <th style={{ textAlign: 'right', color: '#D63031' }}>SL xuất kho</th>
                                <th style={{ textAlign: 'right', color: '#0984E3', fontWeight: 800 }}>SL cuối kỳ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movementData.length === 0 ? (
                                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>
                                    Không có dữ liệu biến động trong khoảng thời gian này
                                </td></tr>
                            ) : movementData.map((row, idx) => (
                                <tr key={row.product?.id || idx}>
                                    <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{idx + 1}</td>
                                    <td><span className="code-badge">{row.product?.code}</span></td>
                                    <td>{row.product?.name}</td>
                                    <td style={{ fontSize: 'var(--font-sm)' }}>{row.product?.unit || '—'}</td>
                                    <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{row.product?.category || '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.openQty.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#00B894' }}>
                                        {row.imported > 0 ? `+${row.imported.toLocaleString()}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#D63031' }}>
                                        {row.exported > 0 ? `-${row.exported.toLocaleString()}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0984E3' }}>{row.endQty.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        {movementData.length > 0 && (
                            <tfoot>
                                <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 800 }}>
                                    <td colSpan={5} style={{ textAlign: 'right' }}>TỔNG</td>
                                    <td style={{ textAlign: 'right' }}>{totals.open.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#00B894' }}>+{totals.imported.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#D63031' }}>-{totals.exported.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#0984E3' }}>{totals.end.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </div>
    )
}
