import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useToast } from './Toast'

/**
 * RoleGuard — Protects routes by module access
 * Usage: <RoleGuard module="sales_forecast"><SalesForecastPage /></RoleGuard>
 */
export default function RoleGuard({ module, children }) {
    const { profile, hasAccess } = useAuth()
    const toast = useToast()

    if (!profile) return null

    if (!hasAccess(module)) {
        return (
            <div className="empty-state" style={{ marginTop: 'var(--space-12)' }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 'var(--radius-full)',
                    background: 'rgba(214,48,49,0.15)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)',
                    fontSize: '1.5rem',
                }}>🔒</div>
                <h3>Không có quyền truy cập</h3>
                <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                    Vai trò <strong>{profile.role}</strong> không được phép truy cập module này.
                </p>
                <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-1)', fontSize: 'var(--font-sm)' }}>
                    Liên hệ Admin nếu cần cấp quyền.
                </p>
            </div>
        )
    }

    return children
}
