import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import { Shield, Search, Filter, Clock, Plus, Edit2, Trash2, Eye, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { formatDate } from '../lib/helpers'

const ACTION_CONFIG = {
    INSERT: { label: 'Tạo mới', color: '#00B894', icon: Plus },
    UPDATE: { label: 'Cập nhật', color: '#0984E3', icon: Edit2 },
    DELETE: { label: 'Xóa', color: '#D63031', icon: Trash2 },
}

const TABLE_LABELS = {
    products: 'Sản phẩm',
    hospitals: 'Bệnh viện',
    suppliers: 'Nhà cung cấp',
    purchase_orders: 'Đặt hàng (PO)',
    po_items: 'Chi tiết PO',
    import_shipments: 'Nhập khẩu',
    warehouse_receipts: 'Nhập kho',
    inventory_lots: 'Tồn kho',
    price_list: 'Bảng giá',
    sales_forecasts: 'Dự trù Sales',
    purchase_forecasts: 'Dự trù MH',
    carriers: 'ĐV Vận chuyển',
}

export default function AuditTrailPage() {
    const toast = useToast()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState(null)

    // Filters
    const [filterTable, setFilterTable] = useState('')
    const [filterAction, setFilterAction] = useState('')
    const [filterUser, setFilterUser] = useState('')
    const [filterDateFrom, setFilterDateFrom] = useState('')
    const [filterDateTo, setFilterDateTo] = useState('')
    const [page, setPage] = useState(0)
    const PAGE_SIZE = 50

    useEffect(() => { fetchLogs() }, [filterTable, filterAction, filterUser, filterDateFrom, filterDateTo, page])

    async function fetchLogs() {
        setLoading(true)
        try {
            let query = supabase
                .from('audit_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

            if (filterTable) query = query.eq('table_name', filterTable)
            if (filterAction) query = query.eq('action', filterAction)
            if (filterUser) query = query.ilike('user_email', `%${filterUser}%`)
            if (filterDateFrom) query = query.gte('created_at', filterDateFrom)
            if (filterDateTo) query = query.lte('created_at', filterDateTo + 'T23:59:59')

            const { data, count, error } = await query
            if (error) throw error
            setLogs(data || [])
        } catch (err) {
            toast.error('Lỗi tải audit log: ' + err.message)
        } finally { setLoading(false) }
    }

    function renderChangedFields(log) {
        if (!log.changed_fields || log.changed_fields.length === 0) return null

        return (
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr', gap: 4,
                fontSize: 'var(--font-xs)',
            }}>
                {log.changed_fields.filter(f => f !== 'updated_at' && f !== 'created_at').map(field => {
                    const oldVal = log.old_values?.[field]
                    const newVal = log.new_values?.[field]
                    return (
                        <div key={field} style={{
                            display: 'grid', gridTemplateColumns: '120px 1fr 20px 1fr', gap: 8,
                            padding: '4px 8px', background: 'rgba(9,132,227,0.05)',
                            borderRadius: 4, alignItems: 'center',
                        }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{field}</span>
                            <span style={{ color: '#D63031', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                                {oldVal !== null && oldVal !== undefined ? String(oldVal).substring(0, 60) : '—'}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                            <span style={{ color: '#00B894', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                                {newVal !== null && newVal !== undefined ? String(newVal).substring(0, 60) : '—'}
                            </span>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div>
            <PageHeader
                title="Audit Trail"
                subtitle="Lịch sử thay đổi hệ thống — field-level tracking"
                icon={<Shield size={20} />}
                actions={
                    <button className="btn btn-ghost" onClick={fetchLogs}>
                        <RefreshCw size={16} /> Làm mới
                    </button>
                }
            />

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="card-body">
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-3)',
                        alignItems: 'end',
                    }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Module</label>
                            <select className="form-select" value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(0) }}>
                                <option value="">Tất cả</option>
                                {Object.entries(TABLE_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Hành động</label>
                            <select className="form-select" value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }}>
                                <option value="">Tất cả</option>
                                <option value="INSERT">Tạo mới</option>
                                <option value="UPDATE">Cập nhật</option>
                                <option value="DELETE">Xóa</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Email</label>
                            <input className="form-input" placeholder="Tìm email..."
                                value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0) }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Từ ngày</label>
                            <input type="date" className="form-input"
                                value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(0) }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Đến ngày</label>
                            <input type="date" className="form-input"
                                value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(0) }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Log list */}
            {loading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : logs.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
                    <Shield size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }} />
                    <h3>Chưa có lịch sử thay đổi</h3>
                    <p style={{ color: 'var(--text-tertiary)' }}>Audit log sẽ tự động ghi lại khi có thay đổi dữ liệu</p>
                </div>
            ) : (
                <div className="card">
                    <div style={{ overflowX: 'auto' }}>
                        {logs.map(log => {
                            const ac = ACTION_CONFIG[log.action] || {}
                            const Icon = ac.icon || Edit2
                            const isExpanded = expandedId === log.id

                            return (
                                <div key={log.id} style={{
                                    borderBottom: '1px solid var(--border-secondary)',
                                }}>
                                    {/* Summary row */}
                                    <div
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                            padding: 'var(--space-3) var(--space-4)',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {/* Expand icon */}
                                        {log.action === 'UPDATE' ? (
                                            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                                        ) : <div style={{ width: 14 }} />}

                                        {/* Action badge */}
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                            background: `${ac.color}15`, color: ac.color,
                                            fontSize: 'var(--font-xs)', fontWeight: 600,
                                            minWidth: 70, justifyContent: 'center',
                                        }}>
                                            <Icon size={12} /> {ac.label}
                                        </span>

                                        {/* Table name */}
                                        <span style={{
                                            fontSize: 'var(--font-xs)', fontWeight: 600,
                                            color: 'var(--text-secondary)', minWidth: 100,
                                        }}>
                                            {TABLE_LABELS[log.table_name] || log.table_name}
                                        </span>

                                        {/* Changed fields preview */}
                                        <span style={{ flex: 1, fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                            {log.changed_fields?.filter(f => !['updated_at', 'created_at'].includes(f)).join(', ') || '—'}
                                        </span>

                                        {/* User */}
                                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', minWidth: 120 }}>
                                            {log.user_email || 'System'}
                                        </span>

                                        {/* Time */}
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 110, textAlign: 'right' }}>
                                            {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                            }) : ''}
                                        </span>
                                    </div>

                                    {/* Expanded detail */}
                                    {isExpanded && log.action === 'UPDATE' && (
                                        <div style={{
                                            padding: '0 var(--space-4) var(--space-3) calc(var(--space-4) + 14px + var(--space-3))',
                                        }}>
                                            {renderChangedFields(log)}
                                        </div>
                                    )}

                                    {isExpanded && log.action === 'INSERT' && log.new_values && (
                                        <div style={{
                                            padding: '0 var(--space-4) var(--space-3) calc(var(--space-4) + 14px + var(--space-3))',
                                            fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)',
                                        }}>
                                            <pre style={{
                                                background: 'var(--bg-tertiary)', padding: 'var(--space-2)',
                                                borderRadius: 4, maxHeight: 200, overflow: 'auto',
                                                fontFamily: 'monospace', fontSize: 10, whiteSpace: 'pre-wrap',
                                            }}>
                                                {JSON.stringify(log.new_values, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Pagination */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-secondary)',
                    }}>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                            Trang {page + 1}
                        </span>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button className="btn btn-ghost btn-sm" disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}>← Trước</button>
                            <button className="btn btn-ghost btn-sm" disabled={logs.length < PAGE_SIZE}
                                onClick={() => setPage(p => p + 1)}>Sau →</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
