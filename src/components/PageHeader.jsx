/**
 * PageHeader — Chuẩn hóa header cho tất cả pages
 * Props: title, subtitle, icon, actions (ReactNode)
 */
export default function PageHeader({ title, subtitle, icon, actions, children }) {
    return (
        <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {icon && (
                    <div style={{
                        width: 40, height: 40, borderRadius: 'var(--radius-lg)',
                        background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', flexShrink: 0,
                    }}>
                        {icon}
                    </div>
                )}
                <div>
                    <h1 className="page-title">{title}</h1>
                    {subtitle && <p className="page-subtitle">{subtitle}</p>}
                </div>
            </div>
            <div className="page-actions">
                {actions || children}
            </div>
        </div>
    )
}
