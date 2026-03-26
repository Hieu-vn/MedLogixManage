import { useState } from 'react'
import { useProductConsumption, useHospitals } from '../hooks/useSupabaseQuery'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity } from 'lucide-react'

/**
 * ConsumptionHistoryPanel — shows 12-month consumption trend for a product using real delivery data
 * Props: productId (UUID), hospitalId? (UUID), productName (string)
 */
export default function ConsumptionHistoryPanel({ productId, hospitalId, productName }) {
    const [selectedHospital, setSelectedHospital] = useState(hospitalId || 'all')
    const { data: hospitals = [] } = useHospitals()
    const { data = [], isLoading: loading } = useProductConsumption(productId, selectedHospital)

    // Aggregate by month (if 'all' hospitals is selected, RPC returns breakdown by hospital)
    const chartData = (() => {
        const map = {}
        data.forEach(r => {
            const dateObj = new Date(r.month)
            const monthStr = dateObj.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' })
            if (!map[monthStr]) map[monthStr] = { month: monthStr, delivered: 0, confirmed: 0 }
            map[monthStr].delivered += Number(r.qty_delivered || 0)
            map[monthStr].confirmed += Number(r.qty_confirmed || 0)
        })
        return Object.values(map)
    })()

    // Summary stats
    const totalDelivered = data.reduce((s, r) => s + Number(r.qty_delivered || 0), 0)
    const totalConfirmed = data.reduce((s, r) => s + Number(r.qty_confirmed || 0), 0)
    const avgMonthly = chartData.length ? (totalDelivered / chartData.length).toFixed(0) : 0

    if (!productId) return null

    return (
        <div style={{
            border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)', background: 'var(--bg-secondary)',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-base)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={18} style={{ color: 'var(--primary-400)' }} />
                        Lịch sử tiêu thụ (Thực tế)
                    </h3>
                    {productName && (
                        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                            {productName} — Toàn thời gian
                        </p>
                    )}
                </div>
                <select
                    className="form-select"
                    value={selectedHospital}
                    onChange={e => setSelectedHospital(e.target.value)}
                    style={{ width: 180, fontSize: 'var(--font-xs)' }}
                >
                    <option value="all">Tất cả BV</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
                    <div className="spinner" style={{ width: 24, height: 24 }}></div>
                </div>
            ) : data.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)', textAlign: 'center', padding: 'var(--space-4)' }}>
                    Chưa có dữ liệu tiêu thụ thực tế từ luồng Giao Hàng (M6) cho sản phẩm này
                </p>
            ) : (
                <>
                    {/* KPI mini row */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)',
                        marginBottom: 'var(--space-4)',
                    }}>
                        <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(108,92,231,0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Tổng giao</div>
                            <div style={{ fontWeight: 700, color: 'var(--primary-400)' }}>{totalDelivered}</div>
                        </div>
                        <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(0,184,148,0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Tổng xác nhận</div>
                            <div style={{ fontWeight: 700, color: 'var(--accent-500)' }}>{totalConfirmed}</div>
                        </div>
                        <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(9,132,227,0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>TB/tháng</div>
                            <div style={{ fontWeight: 700, color: '#0984E3' }}>{avgMonthly}</div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div style={{ height: 200, marginBottom: 'var(--space-3)' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-primary)', border: '1px solid var(--border-secondary)',
                                        borderRadius: 8, fontSize: 12
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="delivered" name="Đã giao" fill="#6C5CE7" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="confirmed" name="Xác nhận" fill="#00B894" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Data table (collapsible) */}
                    <details style={{ fontSize: 'var(--font-xs)' }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--primary-400)', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                            📋 Xem chi tiết ({data.length} bản ghi nhóm theo Tháng/BV)
                        </summary>
                        <table className="data-table" style={{ fontSize: 'var(--font-xs)' }}>
                            <thead>
                                <tr><th>Tháng</th><th>Bệnh viện</th><th>SL Giao</th><th>SL XN</th><th>Ghi chú nổi bật</th></tr>
                            </thead>
                            <tbody>
                                {data.map((r, i) => (
                                    <tr key={`${r.month}-${i}`}>
                                        <td>{new Date(r.month).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}</td>
                                        <td>{r.hospital_name || '—'}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(r.qty_delivered)}</td>
                                        <td style={{ textAlign: 'right' }}>{Number(r.qty_confirmed)}</td>
                                        <td style={{ color: 'var(--text-tertiary)' }}>{r.notes || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </details>
                </>
            )}
        </div>
    )
}
