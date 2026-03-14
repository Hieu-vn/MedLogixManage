import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * ErrorBoundary — Catches unhandled React errors.
 * Prevents white-screen crashes and shows a recovery UI.
 * A18: Professional error handling.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo })
        console.error('[ErrorBoundary]', error, errorInfo)
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        window.location.reload()
    }

    handleGoHome = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        window.location.href = '/dashboard'
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-primary, #1a1a2e)', padding: '2rem',
                }}>
                    <div style={{
                        maxWidth: 480, width: '100%', textAlign: 'center',
                        background: 'var(--bg-secondary, #16213e)', borderRadius: 16,
                        padding: '3rem 2rem', border: '1px solid var(--border, #2a2a4a)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'rgba(214,48,49,0.15)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
                        }}>
                            <AlertTriangle size={32} style={{ color: '#D63031' }} />
                        </div>

                        <h2 style={{ color: 'var(--text-primary, #eee)', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
                            Đã xảy ra lỗi
                        </h2>
                        <p style={{ color: 'var(--text-tertiary, #999)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            Hệ thống gặp sự cố không mong muốn. Dữ liệu của bạn đã được lưu an toàn.
                        </p>

                        {this.state.error && (
                            <div style={{
                                background: 'rgba(214,48,49,0.08)', borderRadius: 8,
                                padding: '0.75rem 1rem', marginBottom: '1.5rem', textAlign: 'left',
                                border: '1px solid rgba(214,48,49,0.2)',
                            }}>
                                <code style={{ fontSize: '0.75rem', color: '#D63031', wordBreak: 'break-word' }}>
                                    {this.state.error.toString()}
                                </code>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button onClick={this.handleReload} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '0.625rem 1.25rem', borderRadius: 8,
                                background: 'var(--primary, #6C5CE7)', color: '#fff',
                                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                            }}>
                                <RefreshCw size={14} /> Tải lại
                            </button>
                            <button onClick={this.handleGoHome} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '0.625rem 1.25rem', borderRadius: 8,
                                background: 'var(--bg-tertiary, #2a2a4a)', color: 'var(--text-primary, #eee)',
                                border: '1px solid var(--border, #3a3a5a)', cursor: 'pointer',
                                fontWeight: 500, fontSize: '0.875rem',
                            }}>
                                <Home size={14} /> Về Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
