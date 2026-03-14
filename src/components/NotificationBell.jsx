import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Bell, Clock, AlertTriangle, Package, CheckCircle, X } from 'lucide-react'
import { formatDate, getExpiryWarning } from '../lib/helpers'

/**
 * NotificationBell — shows badge count and dropdown with recent alerts
 * Alerts: PO overdue, lots expiring soon, low stock, PO pending approval
 */
export default function NotificationBell() {
    const [notifications, setNotifications] = useState([])
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchNotifications()
        // A8: Refresh every 120s (was 60s) to reduce backend load
        const interval = setInterval(fetchNotifications, 120000)
        return () => clearInterval(interval)
    }, [])

    async function fetchNotifications() {
        try {
            const now = new Date()
            const items = []
            const future60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

            // A8: Batch into 3 parallel queries instead of 5 sequential
            const [poResult, lotsResult, productsResult] = await Promise.all([
                // Query 1: All PO data needed (pending + overdue)
                supabase.from('purchase_orders')
                    .select('id, code, grand_total, created_at, status, expected_delivery')
                    .not('status', 'in', '("received","cancelled")'),
                // Query 2: Expiring lots  
                supabase.from('inventory_lots')
                    .select('id, lot_number, expiry_date, product_id, quantity, status, products(code, name)')
                    .eq('status', 'available'),
                // Query 3: Products with safety stock
                supabase.from('products')
                    .select('id, code, name, safety_stock_qty')
                    .eq('is_active', true)
                    .gt('safety_stock_qty', 0),
            ])

            // Process POs: pending + overdue
            const allPOs = poResult.data || []
            allPOs.filter(po => po.status === 'pending').forEach(po => {
                items.push({
                    id: `po-pending-${po.id}`, type: 'warning', icon: Clock,
                    title: `PO ${po.code} chờ GĐ duyệt`, time: po.created_at,
                })
            })
            allPOs.filter(po => po.expected_delivery && new Date(po.expected_delivery) < now).forEach(po => {
                const days = Math.floor((now - new Date(po.expected_delivery)) / (1000 * 60 * 60 * 24))
                items.push({
                    id: `po-overdue-${po.id}`, type: 'danger', icon: AlertTriangle,
                    title: `PO ${po.code} trễ giao ${days} ngày`, time: po.expected_delivery,
                })
            })

            // Process lots: expiring + low stock
            const allLots = lotsResult.data || []
            allLots.filter(l => l.expiry_date && new Date(l.expiry_date) < future60 && new Date(l.expiry_date) > now)
                .forEach(lot => {
                    const days = Math.floor((new Date(lot.expiry_date) - now) / (1000 * 60 * 60 * 24))
                    items.push({
                        id: `expiry-${lot.id}`, type: days <= 30 ? 'danger' : 'warning', icon: Package,
                        title: `${lot.products?.code} lot ${lot.lot_number} hết hạn ${days}d`, time: lot.expiry_date,
                    })
                })

            // Low stock from lots aggregation
            const stockMap = {}
            allLots.forEach(l => { stockMap[l.product_id] = (stockMap[l.product_id] || 0) + l.quantity })
            ;(productsResult.data || []).forEach(p => {
                const current = stockMap[p.id] || 0
                if (current < p.safety_stock_qty) {
                    items.push({
                        id: `lowstock-${p.id}`, type: 'warning', icon: AlertTriangle,
                        title: `${p.code} tồn ${current}/${p.safety_stock_qty} (thiếu ${p.safety_stock_qty - current})`,
                        time: now.toISOString(),
                    })
                }
            })

            // Sort by severity then time
            items.sort((a, b) => {
                const typePriority = { danger: 0, warning: 1, info: 2 }
                return (typePriority[a.type] || 2) - (typePriority[b.type] || 2)
            })

            setNotifications(items)
        } catch (err) {
            console.error('NotificationBell error:', err)
        } finally {
            setLoading(false)
        }
    }

    const dangerCount = notifications.filter(n => n.type === 'danger').length
    const totalCount = notifications.length

    return (
        <div style={{ position: 'relative' }}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(!open)}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    position: 'relative', padding: 6,
                    color: 'var(--text-secondary)',
                }}
            >
                <Bell size={20} />
                {totalCount > 0 && (
                    <span style={{
                        position: 'absolute', top: 0, right: 0,
                        width: 18, height: 18, borderRadius: '50%',
                        background: dangerCount > 0 ? '#D63031' : '#FDCB6E',
                        color: dangerCount > 0 ? '#fff' : '#2D3436',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {totalCount > 9 ? '9+' : totalCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setOpen(false)}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                    />
                    <div style={{
                        position: 'absolute', top: '100%', right: 0,
                        width: 360, maxHeight: 420, overflowY: 'auto',
                        background: 'var(--bg-primary)', border: '1px solid var(--border-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        zIndex: 100,
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: 'var(--space-3) var(--space-4)',
                            borderBottom: '1px solid var(--border-secondary)',
                        }}>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                                🔔 Thông báo ({totalCount})
                            </span>
                            <button
                                onClick={() => setOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Items */}
                        {notifications.length === 0 ? (
                            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>
                                <CheckCircle size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <p>Không có thông báo mới</p>
                            </div>
                        ) : (
                            notifications.map(n => {
                                const Icon = n.icon
                                const colors = {
                                    danger: { bg: 'rgba(214,48,49,0.08)', border: 'rgba(214,48,49,0.2)', icon: '#D63031' },
                                    warning: { bg: 'rgba(253,203,110,0.08)', border: 'rgba(253,203,110,0.2)', icon: '#FDCB6E' },
                                    info: { bg: 'rgba(9,132,227,0.08)', border: 'rgba(9,132,227,0.2)', icon: '#0984E3' },
                                }
                                const c = colors[n.type] || colors.info

                                return (
                                    <div key={n.id} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                                        padding: 'var(--space-3) var(--space-4)',
                                        borderBottom: '1px solid var(--border-secondary)',
                                        background: c.bg,
                                    }}>
                                        <div style={{
                                            flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: c.border,
                                        }}>
                                            <Icon size={14} style={{ color: c.icon }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500 }}>
                                                {n.title}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                {formatDate(n.time)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
