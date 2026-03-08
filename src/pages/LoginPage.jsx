import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLE_LABELS } from '../lib/auth'
import { LogIn } from 'lucide-react'

const DEMO_ACCOUNTS = [
    { email: 'admin@medlogix.com', label: 'Admin', role: 'admin' },
    { email: 'giamdoc@medlogix.com', label: 'Giám đốc', role: 'director' },
    { email: 'qlsales@medlogix.com', label: 'QL Sales', role: 'sales_manager' },
    { email: 'logistics@medlogix.com', label: 'QL Logistics', role: 'logistics_manager' },
    { email: 'thukho@medlogix.com', label: 'Thủ Kho', role: 'warehouse_keeper' },
    { email: 'sales1@medlogix.com', label: 'A. Thái', role: 'sales' },
    { email: 'sales2@medlogix.com', label: 'A. Phương', role: 'sales' },
    { email: 'sales3@medlogix.com', label: 'A. Hoàng', role: 'sales' },
]

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn, user } = useAuth()
    const navigate = useNavigate()

    // If user is already logged in, redirect (fixed: use useEffect instead of render-phase navigate)
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

    const handleDemoLogin = (demoEmail) => {
        setEmail(demoEmail)
        setPassword('demo123')
        setError('')
    }

    return (
        <div className="login-page" data-theme="dark">
            <div className="login-card">
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">M</div>
                    <div className="login-logo-text">
                        <span className="login-logo-name">MedLogixManage</span>
                        <span className="login-logo-sub">Quản lý Kho & Logistics Y tế</span>
                    </div>
                </div>

                {/* Login Form */}
                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" style={{ color: '#A0AEC0' }}>Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="Nhập email..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ color: '#A0AEC0' }}>Mật khẩu</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Nhập mật khẩu..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary login-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> Đang đăng nhập...</>
                        ) : (
                            <><LogIn size={18} /> Đăng nhập</>
                        )}
                    </button>
                </form>

                {/* Demo Accounts */}
                <div className="login-demo">
                    <div className="login-demo-title">Tài khoản demo (mật khẩu: demo123)</div>
                    <div className="login-demo-accounts">
                        {DEMO_ACCOUNTS.map(acc => (
                            <button
                                key={acc.email}
                                className="login-demo-btn"
                                type="button"
                                onClick={() => handleDemoLogin(acc.email)}
                            >
                                {acc.label}
                                <small>{acc.email.split('@')[0]}</small>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
