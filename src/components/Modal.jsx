import { X } from 'lucide-react'

export default function Modal({ isOpen = true, onClose, title, children, footer, size = '' }) {
    if (!isOpen) return null

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) onClose()
    }

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className={`modal ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : ''}`}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}
