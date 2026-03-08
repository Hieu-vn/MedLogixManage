import { STATUS_CONFIG, PRIORITY_CONFIG, STORAGE_CONDITIONS } from '../lib/helpers'

export function StatusBadge({ status }) {
    const config = STATUS_CONFIG[status]
    if (!config) return <span className="badge" style={{ background: 'rgba(99,110,114,0.15)', color: '#636E72' }}>{status}</span>

    return (
        <span className="badge" style={{ background: config.bg, color: config.color }}>
            {config.label}
        </span>
    )
}

export function PriorityBadge({ priority }) {
    const config = PRIORITY_CONFIG[priority]
    if (!config) return null

    return (
        <span className="badge" style={{ background: config.bg, color: config.color }}>
            {config.icon} {config.label}
        </span>
    )
}

export function StorageBadge({ condition }) {
    const config = STORAGE_CONDITIONS[condition]
    if (!config) return null

    return (
        <span className="badge" style={{
            background: `${config.color}20`,
            color: config.color,
        }}>
            {config.icon} {config.label}
        </span>
    )
}

export function RoleBadge({ role, label, color }) {
    return (
        <span className="badge" style={{
            background: `${color}20`,
            color: color,
        }}>
            {label}
        </span>
    )
}
