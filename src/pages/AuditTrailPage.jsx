import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import { Shield, Search, Filter, Clock, Plus, Edit2, Trash2, Eye, ChevronDown, ChevronRight, RefreshCw, Download, Monitor } from 'lucide-react'
import { formatDate } from '../lib/helpers'
import { useExport } from '../hooks/useExport'

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
    deliveries: 'Giao hàng',
}

/**
 * Parse user agent string into short browser/OS label
 */
function parseUserAgent(ua) {
    if (!ua) return '—'
    let browser = 'Unknown'
    let os = 'Unknown'

    // Browser
    if (ua.includes('Edg/')) browser = 'Edge'
    else if (ua.includes('Chrome/')) browser = 'Chrome'
    else if (ua.includes('Firefox/')) browser = 'Firefox'
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari'

    // OS
    if (ua.includes('Windows')) os = 'Win'
    else if (ua.includes('Mac OS')) os = 'Mac'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

    return `${browser}/${os}`
}

export default function AuditTrailPage() {
    const toast = useToast()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState(null)
    const [hoveredId, setHoveredId] = useState(null)
    const { exportExcel, exportPDF } = useExport()
    const [totalCount, setTotalCount] = useState(0)

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
            setTotalCount(count || 0)
        } catch (err) {
            toast.error('Lỗi tải audit log: ' + err.message)
        } finally { setLoading(false) }
    }

    // Export columns for audit log
    const exportColumns = [
        { key: 'created_at', label: 'Thời gian', exportRender: v => v ? new Date(v).toLocaleString('vi-VN') : '—' },
        { key: 'action', label: 'Hành động', exportRender: v => ACTION_CONFIG[v]?.label || v },
        { key: 'table_name', label: 'Module', exportRender: v => TABLE_LABELS[v] || v },
        { key: 'user_email', label: 'Người thực hiện' },
        { key: 'ip_address', label: 'IP Address' },
        { key: 'user_agent', label: 'Browser/OS', exportRender: v => parseUserAgent(v) },
        { key: 'changed_fields', label: 'Trường thay đổi', exportRender: v => Array.isArray(v) ? v.filter(f => !['updated_at', 'created_at'].includes(f)).join(', ') : '—' },
    ]

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

    // Hover tooltip for change preview
    function ChangeTooltip({ log }) {
        if (log.action !== 'UPDATE' || !log.changed_fields?.length) return null
        const fields = log.changed_fields.filter(f => !['updated_at', 'created_at'].includes(f))
        if (fields.length === 0) return null

        return (
            <div style={{
                position: 'absolute', top: '100%', left: 60, zIndex: 50,
                background: 'var(--bg-primary)', border: '1px solid var(--border-secondary)',
                borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                padding: 'var(--space-3)', minWidth: 320, maxWidth: 500,
                fontSize: 'var(--font-xs)',
            }}>
                <div style={{ fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                    📝 Chi tiết thay đổi ({fields.length} trường)
                </div>
                {fields.slice(0, 5).map(field => {
                    const oldVal = log.old_values?.[field]
                    const newVal = log.new_values?.[field]
                    return (
                        <div key={field} style={{
                            display: 'flex', gap: 8, padding: '3px 0',
                            borderBottom: '1px solid var(--border-secondary)',
                        }}>
                            <span style={{ fontWeight: 600, minWidth: 80, color: 'var(--text-secondary)' }}>{field}:</span>
                            <span style={{ color: '#D63031', fontFamily: 'monospace', fontSize: 10 }}>
                                {oldVal != null ? String(oldVal).substring(0, 40) : '∅'}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                            <span style={{ color: '#00B894', fontFamily: 'monospace', fontSize: 10 }}>
                                {newVal != null ? String(newVal).substring(0, 40) : '∅'}
                            </span>
                        </div>
                    )
                })}
                {fields.length > 5 && (
                    <div style={{ color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>
                        +{fields.length - 5} trường khác... (click để mở rộng)
                    </div>
                )}
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
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={fetchLogs}>
                            <RefreshCw size={16} /> Làm mới
                        </button>
                        <button className="btn btn-ghost" onClick={() => exportExcel(exportColumns, logs, 'audit_trail', 'Audit Trail')}>
                            <Download size={14} /> Excel
                        </button>
                        <button className="btn btn-ghost" onClick={() => exportPDF(exportColumns, logs, 'Lịch sử Thay đổi Hệ thống', 'audit_trail')}>
                            <Download size={14} /> PDF
                        </button>
                    </div>
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
                            const isHovered = hoveredId === log.id

                            return (
                                <div key={log.id} style={{
                                    borderBottom: '1px solid var(--border-secondary)',
                                    position: 'relative',
                                }}>
                                    {/* Summary row */}
                                    <div
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                        onMouseEnter={() => setHoveredId(log.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                            padding: 'var(--space-3) var(--space-4)',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s',
                                            background: isHovered ? 'var(--bg-secondary)' : 'transparent',
                                        }}
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

                                        {/* IP Address */}
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 90, fontFamily: 'monospace' }}>
                                            {log.ip_address || '—'}
                                        </span>

                                        {/* Browser/OS */}
                                        <span style={{
                                            fontSize: 10, color: 'var(--text-tertiary)', minWidth: 70,
                                            display: 'inline-flex', alignItems: 'center', gap: 2,
                                        }}>
                                            <Monitor size={10} /> {parseUserAgent(log.user_agent)}
                                        </span>

                                        {/* Time */}
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 110, textAlign: 'right' }}>
                                            {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                            }) : ''}
                                        </span>
                                    </div>

                                    {/* Hover tooltip for change preview */}
                                    {isHovered && !isExpanded && <ChangeTooltip log={log} />}

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
                            Trang {page + 1}{totalCount > 0 ? ` / ${Math.ceil(totalCount / PAGE_SIZE)}` : ''} · {totalCount} logs
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
