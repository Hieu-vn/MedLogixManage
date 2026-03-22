import { useMemo } from 'react'
import { formatCurrency, STORAGE_CONDITIONS } from '../../lib/helpers'

function CSSBar({ label, value, max, color }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', marginBottom: 2 }}>
                <span style={{ color: 'var(--text-secondary)', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
        </div>
    )
}

function CSSPie({ data, size = 160 }) {
    const total = data.reduce((s, d) => s + d.value, 0)
    if (total === 0) return <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 40 }}>Không có dữ liệu</div>
    let cumPct = 0
    const gradientParts = data.map(d => {
        const pct = (d.value / total) * 100
        const part = `${d.color} ${cumPct}% ${cumPct + pct}%`
        cumPct += pct
        return part
    })
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
                width: size, height: size, borderRadius: '50%',
                background: `conic-gradient(${gradientParts.join(', ')})`,
                flexShrink: 0,
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.filter(d => d.value > 0).map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                        <span style={{ fontWeight: 600, marginLeft: 'auto' }}>{d.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function OverviewTab({ lots, productStock }) {
    const analysis = useMemo(() => {
        const totalQty = lots.reduce((s, l) => s + (l.quantity || 0), 0)
        const totalValue = Object.values(productStock).reduce((s, ps) => s + ps.totalValue, 0)

        // Expiry analysis
        const now = new Date()
        let expiredValue = 0, nearExpiryValue = 0
        lots.forEach(l => {
            if (!l.expiry_date) return
            const diff = (new Date(l.expiry_date) - now) / (1000 * 60 * 60 * 24)
            const val = (l.quantity || 0) * (parseFloat(l.unit_cost) || 0)
            if (diff <= 0) expiredValue += val
            else if (diff <= 180) nearExpiryValue += val
        })

        // By category
        const byCat = {}
        lots.forEach(l => {
            const cat = l.product?.category || 'Chưa phân loại'
            byCat[cat] = (byCat[cat] || 0) + (l.quantity || 0)
        })

        // By manufacturer
        const byMfr = {}
        lots.forEach(l => {
            const mfr = l.product?.manufacturer || 'Không rõ'
            byMfr[mfr] = (byMfr[mfr] || 0) + (l.quantity || 0)
        })

        // By expiry group
        const expiryGroups = { 'Hết hạn': 0, '0-30 ngày': 0, '1-3 tháng': 0, '3-6 tháng': 0, '6-12 tháng': 0, '> 1 năm': 0 }
        lots.forEach(l => {
            if (!l.expiry_date) return
            const days = (new Date(l.expiry_date) - now) / (1000 * 60 * 60 * 24)
            if (days <= 0) expiryGroups['Hết hạn'] += l.quantity || 0
            else if (days <= 30) expiryGroups['0-30 ngày'] += l.quantity || 0
            else if (days <= 90) expiryGroups['1-3 tháng'] += l.quantity || 0
            else if (days <= 180) expiryGroups['3-6 tháng'] += l.quantity || 0
            else if (days <= 365) expiryGroups['6-12 tháng'] += l.quantity || 0
            else expiryGroups['> 1 năm'] += l.quantity || 0
        })

        return { totalQty, totalValue, expiredValue, nearExpiryValue, byCat, byMfr, expiryGroups }
    }, [lots, productStock])

    const catColors = ['#6C5CE7', '#0984E3', '#00B894', '#FDCB6E', '#E17055', '#D63031', '#00CEC9', '#A29BFE']
    const expiryColors = { 'Hết hạn': '#636E72', '0-30 ngày': '#D63031', '1-3 tháng': '#E17055', '3-6 tháng': '#FDCB6E', '6-12 tháng': '#0984E3', '> 1 năm': '#00B894' }

    const catData = Object.entries(analysis.byCat).sort((a, b) => b[1] - a[1])
    const mfrData = Object.entries(analysis.byMfr).sort((a, b) => b[1] - a[1]).slice(0, 10)
    const maxMfr = mfrData[0]?.[1] || 1

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                {[
                    { label: 'Giá trị tồn kho', value: formatCurrency(analysis.totalValue), color: '#6C5CE7', icon: '💰' },
                    { label: 'Số lượng tồn kho', value: analysis.totalQty.toLocaleString(), color: '#0984E3', icon: '📦' },
                    { label: 'Giá trị hàng cận hạn', value: formatCurrency(analysis.nearExpiryValue), color: '#FDCB6E', icon: '⚠️' },
                    { label: 'Giá trị hàng hết hạn', value: formatCurrency(analysis.expiredValue), color: '#D63031', icon: '⏰' },
                ].map((s, i) => (
                    <div key={i} className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                {/* Category Pie */}
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <h4 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>📊 Tồn kho theo nhóm hàng</h4>
                    <CSSPie data={catData.map(([label, value], i) => ({
                        label, value, color: catColors[i % catColors.length],
                    }))} />
                </div>

                {/* Manufacturer Bar */}
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <h4 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>🏭 Tồn kho theo hãng SX (Top 10)</h4>
                    {mfrData.map(([label, value], i) => (
                        <CSSBar key={i} label={label} value={value} max={maxMfr} color={catColors[i % catColors.length]} />
                    ))}
                </div>
            </div>

            {/* Expiry Groups */}
            <div className="card" style={{ padding: 'var(--space-4)' }}>
                <h4 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>📅 Tồn kho theo nhóm hạn sử dụng</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-3)' }}>
                    {Object.entries(analysis.expiryGroups).map(([label, value]) => (
                        <div key={label} style={{
                            textAlign: 'center', padding: 'var(--space-3)',
                            background: `${expiryColors[label]}10`, borderRadius: 'var(--radius-md)',
                            border: `1px solid ${expiryColors[label]}30`,
                        }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: expiryColors[label] }}>{value.toLocaleString()}</div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
