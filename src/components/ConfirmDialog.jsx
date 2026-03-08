import { AlertTriangle, Trash2, X } from 'lucide-react'

/**
 * ConfirmDialog — Custom confirm modal (replaces window.confirm)
 * Props:
 *   open, onClose, onConfirm
 *   title, message
 *   type: 'danger'|'warning'|'info'
 *   confirmText, cancelText
 *   loading
 */
export default function ConfirmDialog({
    open, onClose, onConfirm,
    title = 'Xác nhận',
    message = 'Bạn có chắc chắn muốn thực hiện hành động này?',
    type = 'danger',
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    loading = false,
}) {
    if (!open) return null

    const typeConfig = {
        danger: {
            color: '#D63031', bg: 'rgba(214,48,49,0.1)', border: 'rgba(214,48,49,0.25)',
            icon: <Trash2 size={24} />, btnClass: 'btn-danger',
        },
        warning: {
            color: '#FDCB6E', bg: 'rgba(253,203,110,0.1)', border: 'rgba(253,203,110,0.25)',
            icon: <AlertTriangle size={24} />, btnClass: 'btn-primary',
        },
        info: {
            color: '#0984E3', bg: 'rgba(9,132,227,0.1)', border: 'rgba(9,132,227,0.25)',
            icon: <AlertTriangle size={24} />, btnClass: 'btn-primary',
        },
    }
    const cfg = typeConfig[type] || typeConfig.danger

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 420, textAlign: 'center' }}
            >
                <div style={{ padding: 'var(--space-6)' }}>
                    {/* Icon */}
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: cfg.bg, border: `2px solid ${cfg.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: cfg.color, margin: '0 auto var(--space-4)',
                    }}>
                        {cfg.icon}
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontSize: 'var(--font-lg)', fontWeight: 600,
                        marginBottom: 'var(--space-2)',
                    }}>
                        {title}
                    </h3>

                    {/* Message */}
                    <p style={{
                        fontSize: 'var(--font-sm)', color: 'var(--text-secondary)',
                        lineHeight: 1.6, marginBottom: 'var(--space-6)',
                    }}>
                        {message}
                    </p>

                    {/* Actions */}
                    <div style={{
                        display: 'flex', justifyContent: 'center', gap: 'var(--space-3)',
                    }}>
                        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
                            {cancelText}
                        </button>
                        <button
                            className={`btn ${cfg.btnClass}`}
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <><span className="spinner" style={{ width: 14, height: 14 }} /> Đang xử lý...</>
                            ) : confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
