import { useMemo } from 'react'
import { formatDate, STORAGE_CONDITIONS } from '../../lib/helpers'
import { useExport } from '../../hooks/useExport'

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

    const expiryData = useMemo(() => {
        return lots
            .filter(l => l.expiry_date)
            .map(l => {
                const exp = getExpiryGroup(l.expiry_date)
                const now = new Date()
                const ed = new Date(l.expiry_date)
                const diffDays = Math.ceil((ed - now) / (1000 * 60 * 60 * 24))
                return { ...l, expiryGroup: exp, daysRemaining: diffDays }
            })
            .sort((a, b) => a.daysRemaining - b.daysRemaining)
    }, [lots])

    const groups = useMemo(() => {
        const g = {}
        expiryData.forEach(l => {
            const lbl = l.expiryGroup?.label || 'Không xác định'
            g[lbl] = (g[lbl] || 0) + 1
        })
        return g
    }, [expiryData])

    const exportColumns = [
        { key: 'code', label: 'Mã SP', exportRender: (_, r) => r.product?.code || '' },
        { key: 'name', label: 'Tên SP', exportRender: (_, r) => r.product?.name || '' },
        { key: 'lot_number', label: 'Số Lot' },
        { key: 'expiry_date', label: 'HSD', exportRender: v => v ? new Date(v).toLocaleDateString('vi-VN') : '' },
        { key: 'group', label: 'Nhóm hạn', exportRender: (_, r) => r.expiryGroup?.label || '' },
        { key: 'daysRemaining', label: 'Ngày còn lại' },
        { key: 'quantity', label: 'SL tồn' },
        { key: 'unit', label: 'ĐVT', exportRender: (_, r) => r.product?.unit || '' },
    ]

    return (
        <div>
            {/* Group summary */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                {Object.entries(groups).map(([label, count]) => {
                    const grp = expiryData.find(d => d.expiryGroup?.label === label)?.expiryGroup
                    return (
                        <div key={label} style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: grp?.bg || 'var(--bg-tertiary)',
                            border: `1px solid ${grp?.color || 'var(--border)'}30`,
                            borderRadius: 'var(--radius-md)',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <span style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color: grp?.color }}>{count}</span>
                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{label}</span>
                        </div>
                    )
                })}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => exportExcel(exportColumns, expiryData, 'canh_bao_hsd', 'Cảnh báo HSD')}>📥 Excel</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => exportPDF(exportColumns, expiryData, 'Báo cáo Cảnh báo HSD', 'canh_bao_hsd')}>📥 PDF</button>
                </div>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Mã SP</th><th>Tên sản phẩm</th><th>Hãng SX</th>
                            <th>Số Lot</th><th>HSD</th><th>Nhóm hạn</th>
                            <th>Ngày còn lại</th><th>SL tồn</th><th>ĐVT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expiryData.length === 0 ? (
                            <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>
                                Không có dữ liệu HSD
                            </td></tr>
                        ) : expiryData.map((l, idx) => (
                            <tr key={l.id} style={{ background: l.expiryGroup?.bg }}>
                                <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{idx + 1}</td>
                                <td><span className="code-badge">{l.product?.code}</span></td>
                                <td>{l.product?.name}</td>
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
                                    color: l.daysRemaining <= 0 ? '#636E72' : l.daysRemaining <= 30 ? '#D63031' : 'var(--text-primary)',
                                }}>
                                    {l.daysRemaining <= 0 ? `Quá ${Math.abs(l.daysRemaining)} ngày` : `${l.daysRemaining} ngày`}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{(l.quantity || 0).toLocaleString()}</td>
                                <td style={{ fontSize: 'var(--font-sm)' }}>{l.product?.unit || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
