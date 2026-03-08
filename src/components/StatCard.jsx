import { useEffect, useRef, useState } from 'react'

/**
 * StatCard — Animated KPI card with count-up effect + wireframe gradient icon
 * Props: icon, value, label, trend, trendLabel, color, onClick, suffix, badge
 */
export default function StatCard({ icon, value, label, trend, trendLabel, color = 'var(--primary-500)', onClick, suffix = '', badge }) {
    const [displayed, setDisplayed] = useState(0)
    const ref = useRef(null)

    useEffect(() => {
        const numVal = typeof value === 'number' ? value : parseInt(value) || 0
        if (numVal === 0) { setDisplayed(0); return }
        const duration = 800
        const steps = 30
        const increment = numVal / steps
        let current = 0
        const timer = setInterval(() => {
            current += increment
            if (current >= numVal) {
                setDisplayed(numVal)
                clearInterval(timer)
            } else {
                setDisplayed(Math.floor(current))
            }
        }, duration / steps)
        return () => clearInterval(timer)
    }, [value])

    const trendColor = trend > 0 ? '#00B894' : trend < 0 ? '#D63031' : 'var(--text-tertiary)'
    const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'

    return (
        <div
            className="card kpi-card"
            onClick={onClick}
            style={{ cursor: onClick ? 'pointer' : 'default', '--kpi-color': color }}
        >
            <div className="kpi-icon" style={{ background: `${color}20`, color }}>
                {icon}
            </div>
            <div className="kpi-content">
                <div className="kpi-label">{label}</div>
                <div className="kpi-value" ref={ref}>
                    {typeof value === 'string' && value.includes('₫')
                        ? value
                        : displayed.toLocaleString('vi-VN')}{suffix}
                    {badge && (
                        <span className={`kpi-badge ${badge.type || 'warning'}`}>
                            {badge.text}
                        </span>
                    )}
                </div>
                {(trend !== undefined || trendLabel) && (
                    <div className="kpi-change" style={{ color: trendColor }}>
                        {trend !== undefined && <span>{trendIcon} {Math.abs(trend)}%</span>}
                        {trendLabel && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>{trendLabel}</span>}
                    </div>
                )}
            </div>
        </div>
    )
}
