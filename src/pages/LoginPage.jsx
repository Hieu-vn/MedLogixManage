import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLE_LABELS } from '../lib/auth'
import { LogIn, Shield, User, Package, Truck, Warehouse as WarehouseIcon, Eye, EyeOff } from 'lucide-react'

const DEMO_ACCOUNTS = [
    { email: 'admin@medlogix.com', label: 'Admin', role: 'admin', icon: Shield, color: '#6C5CE7' },
    { email: 'giamdoc@medlogix.com', label: 'Giám đốc', role: 'director', icon: Shield, color: '#0984E3' },
    { email: 'qlsales@medlogix.com', label: 'QL Sales', role: 'sales_manager', icon: User, color: '#00B894' },
    { email: 'logistics@medlogix.com', label: 'QL Logistics', role: 'logistics_manager', icon: Truck, color: '#FDCB6E' },
    { email: 'thukho@medlogix.com', label: 'Thủ Kho', role: 'warehouse_keeper', icon: WarehouseIcon, color: '#E17055' },
    { email: 'sales1@medlogix.com', label: 'A. Thái', role: 'sales', icon: Package, color: '#A78BFA' },
    { email: 'sales2@medlogix.com', label: 'A. Phương', role: 'sales', icon: Package, color: '#34D399' },
    { email: 'sales3@medlogix.com', label: 'A. Hoàng', role: 'sales', icon: Package, color: '#FC5C65' },
]

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [selectedDemo, setSelectedDemo] = useState(null)
    const { signIn, user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (user) navigate('/', { replace: true })
    }, [user, navigate])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await signIn(email, password)
            navigate('/', { replace: true })
        } catch (err) {
            setError(err.message === 'Invalid login credentials'
                ? 'Email hoặc mật khẩu không đúng'
                : err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDemoLogin = (acc, idx) => {
        setEmail(acc.email)
        setPassword('demo123')
        setError('')
        setSelectedDemo(idx)
    }

    return (
        <div className="login-page" data-theme="dark">
            {/* Animated background orbs */}
            <div className="login-bg-orbs">
                <div className="login-orb login-orb-1" />
                <div className="login-orb login-orb-2" />
                <div className="login-orb login-orb-3" />
                <div className="login-orb login-orb-4" />
            </div>

            {/* Grid pattern overlay */}
            <div className="login-grid-overlay" />

            {/* Main card */}
            <div className="login-card">
                {/* Glow accent */}
                <div className="login-card-glow" />

                {/* Logo Section */}
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <span>M</span>
                        <div className="login-logo-ring" />
                    </div>
                    <div className="login-logo-text">
                        <span className="login-logo-name">MedLogixManage</span>
                        <span className="login-logo-sub">Hệ thống Quản lý Kho & Logistics Y tế</span>
                    </div>
                </div>

                {/* Feature pills */}
                <div className="login-features">
                    <span className="login-pill"><span className="login-pill-dot" style={{ background: '#00B894' }} /> GSP / GDP</span>
                    <span className="login-pill"><span className="login-pill-dot" style={{ background: '#0984E3' }} /> ISO 13485</span>
                    <span className="login-pill"><span className="login-pill-dot" style={{ background: '#FDCB6E' }} /> FEFO</span>
                </div>

                {/* Login Form */}
                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="login-input-group">
                        <label className="login-label">Email</label>
                        <div className="login-input-wrapper">
                            <User size={16} className="login-input-icon" />
                            <input
                                type="email"
                                className="login-input"
                                placeholder="name@medlogix.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="login-input-group">
                        <label className="login-label">Mật khẩu</label>
                        <div className="login-input-wrapper">
                            <Shield size={16} className="login-input-icon" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="login-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="login-eye-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="login-error">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <><div className="login-spinner" /> Đang đăng nhập...</>
                        ) : (
                            <><LogIn size={18} /> Đăng nhập</>
                        )}
                    </button>
                </form>

                {/* Demo Accounts */}
                <div className="login-demo">
                    <div className="login-demo-header">
                        <div className="login-demo-line" />
                        <span className="login-demo-title">Tài khoản demo</span>
                        <div className="login-demo-line" />
                    </div>
                    <p className="login-demo-hint">Mật khẩu: <code>demo123</code></p>
                    <div className="login-demo-grid">
                        {DEMO_ACCOUNTS.map((acc, idx) => {
                            const Icon = acc.icon
                            return (
                                <button
                                    key={acc.email}
                                    className={`login-demo-card ${selectedDemo === idx ? 'selected' : ''}`}
                                    type="button"
                                    onClick={() => handleDemoLogin(acc, idx)}
                                    style={{ '--demo-color': acc.color }}
                                >
                                    <div className="login-demo-card-icon">
                                        <Icon size={14} />
                                    </div>
                                    <div className="login-demo-card-info">
                                        <span className="login-demo-card-name">{acc.label}</span>
                                        <span className="login-demo-card-role">{ROLE_LABELS[acc.role]}</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="login-footer">
                    <span>&copy; 2026 MedLogixManage</span>
                    <span>v1.0.0</span>
                </div>
            </div>
        </div>
    )
}
