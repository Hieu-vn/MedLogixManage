import { useState, useMemo } from 'react'
import { formatDate } from '../../lib/helpers'
import { useExport } from '../../hooks/useExport'
import { Search, Download } from 'lucide-react'

function getExpiryGroup(expiryDate) {
    if (!expiryDate) return null
    const days = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
    if (days <= 0) return { label: 'Hết hạn', color: '#636E72', bg: 'rgba(99,110,114,0.08)', priority: 0 }
    if (days <= 30) return { label: '0-30 ngày', color: '#D63031', bg: 'rgba(214,48,49,0.06)', priority: 1 }
    if (days <= 90) return { label: '1-3 tháng', color: '#E17055', bg: 'rgba(225,112,85,0.06)', priority: 2 }
    if (days <= 180) return { label: '3-6 tháng', color: '#FDCB6E', bg: 'rgba(253,203,110,0.06)', priority: 3 }
    if (days <= 365) return { label: '6-12 tháng', color: '#0984E3', bg: 'rgba(9,132,227,0.04)', priority: 4 }
    return { label: '> 1 năm', color: '#00B894', bg: 'transparent', priority: 5 }
}

export default function ExpiryTab({ lots }) {
    const { exportExcel, exportPDF } = useExport()
    const [search, setSearch] = useState('')
    const [groupFilter, setGroupFilter] = useState('all')

    const expiryData = useMemo(() => {
        return lots
            .filter(l => l.expiry_date)
            .map(l => {
                const exp = getExpiryGroup(l.expiry_date)
                const now = new Date()
                const ed = new Date(l.expiry_date)
                const diffDays = Math.ceil((ed - now) / (1000 * 60 * 60 * 24))
                const value = (l.quantity || 0) * (parseFloat(l.unit_cost) || 0)
                return { ...l, expiryGroup: exp, daysRemaining: diffDays, value }
            })
            .sort((a, b) => a.daysRemaining - b.daysRemaining)
    }, [lots])

    // Group counts + values
    const groups = useMemo(() => {
        const g = {}
        expiryData.forEach(l => {
            const lbl = l.expiryGroup?.label || 'Không xác định'
            if (!g[lbl]) g[lbl] = { count: 0, qty: 0, value: 0, color: l.expiryGroup?.color, bg: l.expiryGroup?.bg }
            g[lbl].count++
            g[lbl].qty += l.quantity || 0
            g[lbl].value += l.value || 0
        })
        return g
    }, [expiryData])

    // Filtered data
    const filteredData = useMemo(() => {
        let result = expiryData
        if (groupFilter !== 'all') {
            result = result.filter(l => l.expiryGroup?.label === groupFilter)
        }
        if (search) {
            const q = search.toLowerCase()
            result = result.filter(l =>
                l.product?.code?.toLowerCase().includes(q) ||
                l.product?.name?.toLowerCase().includes(q) ||
                l.product?.manufacturer?.toLowerCase().includes(q) ||
                l.lot_number?.toLowerCase().includes(q)
            )
        }
        return result
    }, [expiryData, groupFilter, search])

    // Total values for filtered
    const totals = useMemo(() => ({
        qty: filteredData.reduce((s, l) => s + (l.quantity || 0), 0),
        value: filteredData.reduce((s, l) => s + (l.value || 0), 0),
    }), [filteredData])

    const exportColumns = [
        { key: 'code', label: 'Mã SP', exportRender: (_, r) => r.product?.code || '' },
        { key: 'name', label: 'Tên SP', exportRender: (_, r) => r.product?.name || '' },
        { key: 'manufacturer', label: 'Hãng SX', exportRender: (_, r) => r.product?.manufacturer || '' },
        { key: 'lot_number', label: 'Số Lot' },
        { key: 'expiry_date', label: 'HSD', exportRender: v => v ? new Date(v).toLocaleDateString('vi-VN') : '' },
        { key: 'group', label: 'Nhóm hạn', exportRender: (_, r) => r.expiryGroup?.label || '' },
        { key: 'daysRemaining', label: 'Ngày còn lại' },
        { key: 'quantity', label: 'SL tồn' },
        { key: 'unit', label: 'ĐVT', exportRender: (_, r) => r.product?.unit || '' },
        { key: 'value', label: 'Giá trị', exportRender: v => (v || 0).toLocaleString() },
    ]

    return (
        <div>
            {/* Group summary cards — clickable to filter */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button
                    className={`btn btn-sm ${groupFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setGroupFilter('all')}
                    style={{ fontSize: 'var(--font-xs)' }}
                >
                    Tất cả ({expiryData.length})
                </button>
                {Object.entries(groups).map(([label, g]) => (
                    <button key={label}
                        onClick={() => setGroupFilter(groupFilter === label ? 'all' : label)}
                        style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: groupFilter === label ? `${g.color}30` : g.bg || 'var(--bg-tertiary)',
                            border: `1px solid ${groupFilter === label ? g.color : g.color + '30'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer', transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                        <span style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color: g.color }}>{g.count}</span>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{label}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>SL: {g.qty.toLocaleString()}</div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Search + Export */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 300 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input className="form-input" placeholder="Tìm mã SP, tên, lot, hãng SX..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: 32, fontSize: 'var(--font-sm)' }} />
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                    {filteredData.length} lot | SL: {totals.qty.toLocaleString()} | Giá trị: {totals.value.toLocaleString()} đ
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => exportExcel(exportColumns, filteredData, 'canh_bao_hsd', 'Cảnh báo HSD')}>
                        <Download size={14} /> Excel
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => exportPDF(exportColumns, filteredData, 'Báo cáo Cảnh báo HSD', 'canh_bao_hsd')}>
                        <Download size={14} /> PDF
                    </button>
                </div>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Mã SP</th><th>Tên sản phẩm</th><th>Hãng SX</th>
                            <th>Số Lot</th><th>HSD</th><th>Nhóm hạn</th>
                            <th style={{ textAlign: 'right' }}>Ngày còn lại</th>
                            <th style={{ textAlign: 'right' }}>SL tồn</th>
                            <th>ĐVT</th>
                            <th style={{ textAlign: 'right' }}>Giá trị</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>
                                Không có dữ liệu
                            </td></tr>
                        ) : filteredData.map((l, idx) => (
                            <tr key={l.id} style={{ background: l.expiryGroup?.bg }}>
                                <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{idx + 1}</td>
                                <td><span className="code-badge">{l.product?.code}</span></td>
                                <td>
                                    <div>{l.product?.name}</div>
                                    {l.product?.packaging && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{l.product.packaging}</div>}
                                </td>
                                <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{l.product?.manufacturer || '—'}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)' }}>{l.lot_number}</td>
                                <td>{formatDate(l.expiry_date)}</td>
                                <td>
                                    <span style={{
                                        fontSize: 'var(--font-xs)', fontWeight: 700,
                                        color: l.expiryGroup?.color,
                                        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                                        background: `${l.expiryGroup?.color}15`,
                                    }}>{l.expiryGroup?.label}</span>
                                </td>
                                <td style={{
                                    textAlign: 'right', fontWeight: 700,
                                    color: l.daysRemaining <= 0 ? '#636E72' : l.daysRemaining <= 30 ? '#D63031' : l.daysRemaining <= 90 ? '#E17055' : 'var(--text-primary)',
                                }}>
                                    {l.daysRemaining <= 0 ? `Quá ${Math.abs(l.daysRemaining)} ngày` : `${l.daysRemaining} ngày`}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{(l.quantity || 0).toLocaleString()}</td>
                                <td style={{ fontSize: 'var(--font-sm)' }}>{l.product?.unit || '—'}</td>
                                <td style={{ textAlign: 'right', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                                    {(l.value || 0).toLocaleString()} đ
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {filteredData.length > 0 && (
                        <tfoot>
                            <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 800 }}>
                                <td colSpan={8} style={{ textAlign: 'right' }}>TỔNG CỘNG</td>
                                <td style={{ textAlign: 'right' }}>{totals.qty.toLocaleString()}</td>
                                <td></td>
                                <td style={{ textAlign: 'right', fontSize: 'var(--font-xs)' }}>{totals.value.toLocaleString()} đ</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    )
}
