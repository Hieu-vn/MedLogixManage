import { Clock, Check, Send, Ship, Warehouse, Package, AlertTriangle, X } from 'lucide-react'

// 7-step PO lifecycle timeline
const PO_STEPS = [
    { key: 'draft', label: 'Nháp', icon: Clock, color: '#636E72' },
    { key: 'pending', label: 'Chờ GĐ duyệt', icon: Clock, color: '#FDCB6E' },
    { key: 'approved', label: 'GĐ duyệt', icon: Check, color: '#00B894' },
    { key: 'sent', label: 'Gửi NCC', icon: Send, color: '#0984E3' },
    { key: 'confirmed', label: 'GĐ xác nhận', icon: Check, color: '#6C5CE7' },
    { key: 'delivering', label: 'Đang giao', icon: Ship, color: '#E17055' },
    { key: 'received', label: 'Đã nhận', icon: Warehouse, color: '#00B894' },
]

export default function POTimeline({ po }) {
    if (!po) return null

    const currentIdx = PO_STEPS.findIndex(s => s.key === po.status)
    const isRejected = po.status === 'rejected'
    const isCancelled = po.status === 'cancelled'

    // Overdue check
    const isOverdue = po.expected_delivery && po.status !== 'received' && po.status !== 'cancelled'
        && new Date(po.expected_delivery) < new Date()
    const daysOverdue = isOverdue
        ? Math.floor((new Date() - new Date(po.expected_delivery)) / (1000 * 60 * 60 * 24))
        : 0

    return (
        <div style={{ padding: 'var(--space-3) 0' }}>
            {/* Overdue Warning */}
            {isOverdue && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'rgba(214,48,49,0.1)', border: '1px solid rgba(214,48,49,0.25)',
                    borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)',
                    fontSize: 'var(--font-sm)', color: '#D63031',
                }}>
                    <AlertTriangle size={16} />
                    <strong>Quá hạn giao hàng!</strong> Trễ {daysOverdue} ngày so với ngày giao dự kiến ({new Date(po.expected_delivery).toLocaleDateString('vi-VN')})
                </div>
            )}

            {/* Rejected/Cancelled banner */}
            {isRejected && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'rgba(214,48,49,0.1)', borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-3)',
                    fontSize: 'var(--font-sm)', color: '#D63031',
                }}>
                    <X size={16} />
                    <strong>GĐ từ chối</strong>
                    {po.rejection_reason && ` — ${po.rejection_reason}`}
                </div>
            )}

            {/* Timeline steps */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                overflowX: 'auto', padding: '4px 0',
            }}>
                {PO_STEPS.map((step, i) => {
                    const isCompleted = !isRejected && !isCancelled && i <= currentIdx
                    const isCurrent = !isRejected && !isCancelled && i === currentIdx
                    const isPast = !isRejected && !isCancelled && i < currentIdx
                    const Icon = step.icon

                    return (
                        <div key={step.key} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: 4, minWidth: 70,
                            }}>
                                {/* Circle */}
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: isCompleted ? `${step.color}25` : 'var(--bg-tertiary)',
                                    border: `2px solid ${isCompleted ? step.color : 'var(--border-secondary)'}`,
                                    transition: 'all 0.3s ease',
                                    boxShadow: isCurrent ? `0 0 0 3px ${step.color}20` : 'none',
                                }}>
                                    {isPast ? (
                                        <Check size={14} style={{ color: step.color }} />
                                    ) : (
                                        <Icon size={14} style={{ color: isCompleted ? step.color : 'var(--text-tertiary)' }} />
                                    )}
                                </div>
                                {/* Label */}
                                <span style={{
                                    fontSize: 10, textAlign: 'center',
                                    color: isCompleted ? step.color : 'var(--text-tertiary)',
                                    fontWeight: isCurrent ? 700 : 400,
                                    lineHeight: 1.2,
                                }}>
                                    {step.label}
                                </span>
                                {/* Timestamp for completed steps */}
                                {isPast && i === 2 && po.approved_at && (
                                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                                        {new Date(po.approved_at).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                                {isPast && i === 3 && po.sent_at && (
                                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                                        {new Date(po.sent_at).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                            </div>
                            {/* Connector */}
                            {i < PO_STEPS.length - 1 && (
                                <div style={{
                                    width: 24, height: 2,
                                    background: isPast ? step.color : 'var(--border-secondary)',
                                    flexShrink: 0,
                                    transition: 'background 0.3s ease',
                                }} />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// Helper: returns overdue badge for PO list
export function getOverdueBadge(po) {
    if (!po.expected_delivery || po.status === 'received' || po.status === 'cancelled') return null
    const days = Math.floor((new Date() - new Date(po.expected_delivery)) / (1000 * 60 * 60 * 24))
    if (days <= 0) return null
    return (
        <span className="badge" style={{
            background: 'rgba(214,48,49,0.15)', color: '#D63031',
            fontSize: 10, fontWeight: 700, marginLeft: 6,
        }}>
            🔴 Trễ {days}d
        </span>
    )
}
