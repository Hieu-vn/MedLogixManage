/**
 * SkeletonLoader — Content placeholder khi loading
 * Props: rows, type ('table'|'cards'|'form')
 */
export default function SkeletonLoader({ rows = 5, type = 'table' }) {
    if (type === 'cards') {
        return (
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)',
            }}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="card" style={{ padding: 'var(--space-5)' }}>
                        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }} />
                        <div className="skeleton" style={{ width: '60%', height: 12, marginBottom: 'var(--space-2)' }} />
                        <div className="skeleton" style={{ width: '40%', height: 24 }} />
                    </div>
                ))}
            </div>
        )
    }

    if (type === 'form') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i}>
                        <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 'var(--space-2)' }} />
                        <div className="skeleton" style={{ width: '100%', height: 36, borderRadius: 'var(--radius-md)' }} />
                    </div>
                ))}
            </div>
        )
    }

    // Default: table
    return (
        <div className="card" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
                display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
                background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-secondary)',
            }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ flex: 1, height: 12 }} />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{
                    display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1px solid var(--border-secondary)',
                }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} className="skeleton" style={{
                            flex: j === 0 ? 0.5 : 1, height: 14,
                            animationDelay: `${(i * 5 + j) * 50}ms`,
                        }} />
                    ))}
                </div>
            ))}
        </div>
    )
}
