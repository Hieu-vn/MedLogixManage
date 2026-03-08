import { Inbox } from 'lucide-react'

/**
 * EmptyState — Chuẩn hóa empty state
 * Props: icon (Lucide component), title, description, action (ReactNode)
 */
export default function EmptyState({
    icon: Icon = Inbox,
    title = 'Không có dữ liệu',
    description,
    action,
}) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 'var(--space-12)',
            textAlign: 'center', minHeight: 300,
        }}>
            <div style={{
                width: 72, height: 72, borderRadius: 'var(--radius-xl)',
                background: 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 'var(--space-5)',
            }}>
                <Icon size={32} style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
            </div>
            <h3 style={{
                fontSize: 'var(--font-lg)', fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: 'var(--space-2)',
            }}>
                {title}
            </h3>
            {description && (
                <p style={{
                    fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)',
                    maxWidth: 360, lineHeight: 1.6,
                }}>
                    {description}
                </p>
            )}
            {action && (
                <div style={{ marginTop: 'var(--space-5)' }}>
                    {action}
                </div>
            )}
        </div>
    )
}
