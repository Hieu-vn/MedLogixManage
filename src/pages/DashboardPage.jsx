import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useDashboardData } from '../hooks/useSupabaseQuery'
import { formatCurrency, formatDate, getExpiryWarning } from '../lib/helpers'
import { StatusBadge } from '../components/Badges'
import PageHeader from '../components/PageHeader'
import SkeletonLoader from '../components/SkeletonLoader'
import RoleGuard from '../components/RoleGuard'
import {
    FileText, ClipboardList, ShoppingCart, Ship,
    Warehouse, AlertTriangle, ArrowRight,
    Package, Clock, Calendar, DollarSign, LayoutDashboard, Hospital, Users,
    TrendingUp, TrendingDown, Minus, Activity, Thermometer
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts'

const TOOLTIP_STYLE = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)',
    borderRadius: 8, color: 'var(--text-primary)', fontSize: 12,
}

// Animated counter hook
function useCountUp(end, duration = 1200) {
    const [value, setValue] = useState(0)
    const ref = useRef(null)
    useEffect(() => {
        if (end === 0 || end === undefined || end === null) { setValue(0); return }
        const isNumber = typeof end === 'number'
        if (!isNumber) { setValue(end); return }
        let start = 0
        const startTime = performance.now()
        function animate(currentTime) {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            // ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(Math.round(start + (end - start) * eased))
            if (progress < 1) ref.current = requestAnimationFrame(animate)
        }
        ref.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(ref.current)
    }, [end, duration])
    return value
}

function AnimatedStatCard({ icon, label, value, color, badge, subtitle, trend }) {
    const numericValue = typeof value === 'number' ? value : null
    const animatedValue = useCountUp(numericValue, 1000)
    const displayValue = numericValue !== null ? animatedValue : value

    return (
        <div className="card kpi-card" style={{ '--kpi-color': color }}>
            <div className="kpi-icon" style={{ background: `linear-gradient(135deg, ${color}, transparent)` }}>
                {icon}
            </div>
            <div className="kpi-content">
                <div className="kpi-label">{label}</div>
                <div className="kpi-value" style={{ color }}>
                    {displayValue}
                    {badge && <span className={`kpi-badge ${badge.type}`}>{badge.text}</span>}
                </div>
                {subtitle && <div className="kpi-change" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</div>}
                {trend && (
                    <div className="kpi-change" style={{ color: trend > 0 ? '#00B894' : trend < 0 ? '#E17055' : 'var(--text-tertiary)' }}>
                        {trend > 0 ? <TrendingUp size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> :
                            trend < 0 ? <TrendingDown size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> :
                                <Minus size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />}
                        {' '}{trend > 0 ? '+' : ''}{trend}% so với tháng trước
                    </div>
                )}
            </div>
        </div>
    )
}

function PipelineStep({ step, isLast }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="dashboard-pipeline-step" style={{
                '--step-color': step.color,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, padding: '14px 18px',
                background: `color-mix(in srgb, ${step.color} 8%, transparent)`,
                border: `1px solid color-mix(in srgb, ${step.color} 20%, transparent)`,
                borderRadius: 12, minWidth: 130, textAlign: 'center',
                transition: 'all 0.25s', cursor: 'default',
            }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `color-mix(in srgb, ${step.color} 15%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <step.icon size={18} style={{ color: step.color }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{step.label}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: step.color, lineHeight: 1 }}>{step.count}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>đang xử lý</span>
            </div>
            {!isLast && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ArrowRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                </div>
            )}
        </div>
    )
}

export default function DashboardPage() {
    const { profile } = useAuth()
    const { data: raw, isLoading: loading } = useDashboardData()

    // Process raw data into dashboard stats
    const stats = React.useMemo(() => {
        if (!raw) return null
        const { salesForecasts: sf, purchaseForecasts: pf, products: prods, inventoryLots: lots,
            hospitalCount, supplierCount, recentSF, purchaseOrders: po, importShipments: nk, warehouseReceipts: wr, monthlyTrend: mtRaw, inventoryTrend: itRaw } = raw

        const pendingCount = sf.filter(f => f.status === 'pending').length
            + pf.filter(f => f.status === 'pending').length
            + po.filter(f => f.status === 'pending').length
        const now = new Date()

        // Expiry alerts
        const expiryAlerts = lots
            .filter(l => l.status === 'available' && l.expiry_date)
            .map(l => {
                const warning = getExpiryWarning(l.expiry_date, now)
                const prod = prods.find(p => p.id === l.product_id)
                return { ...l, warning, productName: prod?.name, productCode: prod?.code }
            })
            .filter(l => l.warning.level !== 'ok')
            .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))

        // Low stock
        const stockByProduct = {}
        lots.filter(l => l.status === 'available').forEach(l => {
            stockByProduct[l.product_id] = (stockByProduct[l.product_id] || 0) + l.quantity
        })
        const lowStockProducts = prods
            .filter(p => p.is_active && p.safety_stock_qty > 0)
            .map(p => ({ ...p, currentStock: stockByProduct[p.id] || 0, deficit: (stockByProduct[p.id] || 0) - p.safety_stock_qty }))
            .filter(p => p.deficit < 0)
            .sort((a, b) => a.deficit - b.deficit)

        const expiryCount90 = lots.filter(l => {
            if (l.status !== 'available' || !l.expiry_date) return false
            const days = (new Date(l.expiry_date) - now) / (1000 * 60 * 60 * 24)
            return days <= 90 && days > 0
        }).length

        const stockValue = lots.filter(l => l.status === 'available')
            .reduce((sum, l) => sum + (l.quantity * (Number(l.unit_cost) || 0)), 0)

        const totalLots = lots.filter(l => l.status === 'available').length

        // Pipeline
        const pipeline = [
            { label: 'Dự trù Sales', count: sf.filter(f => ['draft', 'pending'].includes(f.status)).length, icon: FileText, color: '#6C5CE7' },
            { label: 'Dự trù MH', count: pf.filter(f => ['draft', 'pending'].includes(f.status)).length, icon: ClipboardList, color: '#0984E3' },
            { label: 'Đặt hàng', count: po.filter(f => !['received', 'cancelled'].includes(f.status)).length, icon: ShoppingCart, color: '#00B894' },
            { label: 'Nhập khẩu', count: nk.filter(f => f.status !== 'completed').length, icon: Ship, color: '#FDCB6E' },
            { label: 'Nhập kho', count: wr.filter(f => f.status !== 'completed').length, icon: Warehouse, color: '#E17055' },
        ]

        // Chart: Inventory by category (only categories with actual stock)
        const categoryMap = {}
        prods.forEach(p => {
            if (!p.is_active) return
            const cat = p.category || 'Khác'
            if (!categoryMap[cat]) categoryMap[cat] = { name: cat, stock: 0, products: 0 }
            categoryMap[cat].products++
            categoryMap[cat].stock += stockByProduct[p.id] || 0
        })
        const categoryData = Object.values(categoryMap)
            .filter(c => c.stock > 0)
            .sort((a, b) => b.stock - a.stock)

        // Chart: Storage condition pie
        const storagePie = [
            { name: 'Thường', value: lots.filter(l => l.storage_condition === 'normal' && l.status === 'available').length, color: '#00B894' },
            { name: 'Mát 2-8°C', value: lots.filter(l => l.storage_condition === 'cool' && l.status === 'available').length, color: '#0984E3' },
            { name: 'Lạnh -20°C', value: lots.filter(l => l.storage_condition === 'cold' && l.status === 'available').length, color: '#6C5CE7' },
        ].filter(s => s.value > 0)

        // Chart: Top products by stock quantity
        const topProducts = Object.entries(stockByProduct)
            .map(([pid, qty]) => {
                const prod = prods.find(p => p.id === pid)
                return { name: prod?.code || pid.substring(0, 8), qty, fullName: prod?.name }
            })
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 8)

        // Format real monthly trend
        const monthlyTrend = (mtRaw || []).map(r => ({
            month: new Date(r.month).toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' }),
            qty: Number(r.qty)
        }))

        // Format real inventory trend
        const inventoryTrend = (itRaw || []).map(r => ({
            date: new Date(r.snapshot_date).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' }),
            value: Number(r.total_value),
            items: Number(r.total_items)
        }))

        return {
            pendingCount,
            totalProducts: prods.filter(p => p.is_active).length,
            totalHospitals: hospitalCount,
            totalSuppliers: supplierCount,
            expiryAlerts, lowStockProducts, pipeline, storagePie,
            categoryData, topProducts, monthlyTrend, inventoryTrend,
            recentSF, expiryCount90, stockValue, totalLots,
            totalPO: po.length, totalNK: nk.length, totalWR: wr.length,
        }
    }, [raw])

    if (loading) return <SkeletonLoader type="cards" rows={6} />
    if (!stats) return null

    const CHART_COLORS = ['#6C5CE7', '#0984E3', '#00B894', '#FDCB6E', '#E17055', '#A78BFA']

    return (
        <div>
            <PageHeader
                title="Dashboard"
                subtitle="Tổng quan hệ thống hôm nay"
                icon={<LayoutDashboard size={20} />}
            />

            {/* KPI Cards Row */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
                gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
            }}>
                <AnimatedStatCard icon={<Clock size={22} />} label="Chờ xử lý" value={stats.pendingCount}
                    color="#FDCB6E" subtitle="phiếu chờ duyệt" />
                <AnimatedStatCard icon={<Package size={22} />} label="Sản phẩm" value={stats.totalProducts}
                    color="#6C5CE7" subtitle="đang hoạt động" />
                <AnimatedStatCard icon={<Hospital size={22} />} label="Bệnh viện" value={stats.totalHospitals}
                    color="#0984E3" subtitle="đối tác" />
                <AnimatedStatCard icon={<Users size={22} />} label="Nhà cung cấp" value={stats.totalSuppliers}
                    color="#00B894" />
                <AnimatedStatCard icon={<Calendar size={22} />} label="HSD sắp hết"
                    value={stats.expiryCount90}
                    color={stats.expiryCount90 > 0 ? '#E17055' : '#00B894'}
                    badge={stats.expiryCount90 > 0 ? { text: '< 90 ngày', type: 'danger' } : null}
                />
                <AnimatedStatCard icon={<DollarSign size={22} />} label="Giá trị tồn kho"
                    value={formatCurrency(stats.stockValue)} color="#0984E3" subtitle={`${stats.totalLots} lô hàng`} />
            </div>

            {/* Pipeline */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={16} style={{ color: 'var(--primary-400)' }} /> Pipeline — Luồng quy trình
                    </h3>
                </div>
                <div className="card-body">
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        overflowX: 'auto', padding: '8px 0',
                        justifyContent: 'center',
                    }}>
                        {stats.pipeline.map((step, i) => (
                            <PipelineStep key={step.label} step={step} isLast={i === stats.pipeline.length - 1} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Charts Row 1: Category bar + Stock value trend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="card">
                    <div className="card-header">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Package size={16} style={{ color: '#6C5CE7' }} /> Tồn kho theo danh mục
                        </h3>
                    </div>
                    <div className="card-body" style={{ height: Math.max(200, stats.categoryData.length * 40 + 40) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.categoryData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                                <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={120} />
                                <Tooltip contentStyle={TOOLTIP_STYLE}
                                    formatter={(value, name, props) => [`${value} đơn vị (${props.payload.products} SP)`, 'Tồn kho']} />
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#6C5CE7" />
                                        <stop offset="100%" stopColor="#A78BFA" />
                                    </linearGradient>
                                </defs>
                                <Bar dataKey="stock" name="Tồn kho" fill="url(#barGrad)" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <RoleGuard module="inventory">
                    <div className="card">
                        <div className="card-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <TrendingUp size={16} style={{ color: '#0984E3' }} /> Xu hướng giá trị tồn kho
                            </h3>
                        </div>
                        <div className="card-body" style={{ height: 260 }}>
                            {stats.inventoryTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.inventoryTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="invGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0984E3" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#0984E3" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis hide domain={['dataMin - (dataMin * 0.05)', 'dataMax + (dataMax * 0.05)']} />
                                        <Tooltip 
                                            contentStyle={TOOLTIP_STYLE} 
                                            formatter={(value, name) => [name === 'value' ? formatCurrency(value) : value, name === 'value' ? 'Giá trị tồn' : 'Số lượng']}
                                        />
                                        <Area type="monotone" dataKey="value" name="value" stroke="#0984E3" strokeWidth={3}
                                            fillOpacity={1} fill="url(#invGradient)" activeDot={{ r: 6, fill: '#0984E3', stroke: '#fff', strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    <TrendingUp size={40} style={{ color: 'var(--text-quaternary)', opacity: 0.5 }} />
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Chưa đủ dữ liệu lịch sử</div>
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Hệ thống đang thu thập snapshot hàng ngày</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </RoleGuard>
            </div>

            {/* Charts Row 2: Top products + Storage Pie */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="card">
                    <div className="card-header">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TrendingUp size={16} style={{ color: '#00B894' }} /> Top sản phẩm tiêu thụ
                        </h3>
                    </div>
                    <div className="card-body" style={{ height: 280 }}>
                        {stats.topProducts.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.topProducts} layout="vertical" margin={{ left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                                    <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} width={70} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n, p) => [`${v} units`, p.payload.fullName || 'SP']} />
                                    <defs>
                                        <linearGradient id="consumeGrad" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#00B894" />
                                            <stop offset="100%" stopColor="#34D399" />
                                        </linearGradient>
                                    </defs>
                                    <Bar dataKey="qty" name="SL tiêu thụ" fill="url(#consumeGrad)" radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', paddingTop: 'var(--space-8)' }}>Chưa có dữ liệu tiêu thụ</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Thermometer size={16} style={{ color: '#6C5CE7' }} /> Điều kiện bảo quản
                        </h3>
                    </div>
                    <div className="card-body" style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {stats.storagePie.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.storagePie}
                                        cx="50%" cy="50%"
                                        innerRadius={55} outerRadius={90}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {stats.storagePie.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} lô`, 'Số lượng']} />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={8}
                                        formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Chưa có dữ liệu</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart: Monthly consumption trend */}
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="card-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={16} style={{ color: '#0984E3' }} /> Xu hướng tiêu thụ theo tháng
                    </h3>
                </div>
                <div className="card-body" style={{ height: 240 }}>
                    {stats.monthlyTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Area type="monotone" dataKey="qty" name="SL tiêu thụ" stroke="#6C5CE7"
                                    fillOpacity={1} fill="url(#trendGradient)" strokeWidth={2}
                                    dot={{ fill: '#6C5CE7', r: 3, strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: '#6C5CE7', stroke: 'white', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', paddingTop: 'var(--space-8)' }}>Chưa có dữ liệu</div>
                    )}
                </div>
            </div>

            {/* Bottom Row: Alerts + Recent */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="card">
                    <div className="card-header">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={16} style={{ color: '#FDCB6E' }} />
                            Cảnh báo
                            <span style={{
                                marginLeft: 4, fontSize: 11, fontWeight: 700,
                                padding: '2px 8px', borderRadius: 999,
                                background: (stats.expiryAlerts.length + stats.lowStockProducts.length) > 0 ? 'rgba(214,48,49,0.15)' : 'rgba(0,184,148,0.15)',
                                color: (stats.expiryAlerts.length + stats.lowStockProducts.length) > 0 ? '#E17055' : '#00B894',
                            }}>
                                {stats.expiryAlerts.length + stats.lowStockProducts.length}
                            </span>
                        </h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                        {stats.lowStockProducts.map((p, i) => (
                            <div key={`stock-${i}`} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 14px',
                                background: 'rgba(214,48,49,0.06)', borderRadius: 10,
                                border: '1px solid rgba(214,48,49,0.15)', fontSize: 13,
                            }}>
                                <AlertTriangle size={14} style={{ color: '#D63031', flexShrink: 0 }} />
                                <span><strong>{p.name}</strong> — Tồn {p.currentStock}/{p.safety_stock_qty} (thiếu {Math.abs(p.deficit)})</span>
                            </div>
                        ))}
                        {stats.expiryAlerts.map((lot, i) => (
                            <div key={`exp-${i}`} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 14px',
                                background: lot.warning.level === 'danger' ? 'rgba(214,48,49,0.06)' : 'rgba(253,203,110,0.06)',
                                borderRadius: 10,
                                border: `1px solid ${lot.warning.level === 'danger' ? 'rgba(214,48,49,0.15)' : 'rgba(253,203,110,0.15)'}`,
                                fontSize: 13,
                            }}>
                                <Calendar size={14} style={{ color: lot.warning.level === 'danger' ? '#D63031' : '#FDCB6E', flexShrink: 0 }} />
                                <span><strong>{lot.productName}</strong> ({lot.productCode}) — HSD: {formatDate(lot.expiry_date)}</span>
                            </div>
                        ))}
                        {stats.expiryAlerts.length === 0 && stats.lowStockProducts.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--accent-500)', padding: 'var(--space-6)' }}>
                                ✅ Không có cảnh báo
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={16} style={{ color: 'var(--primary-400)' }} /> Phiếu gần đây
                        </h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                        {stats.recentSF.length > 0 ? stats.recentSF.map(sf => (
                            <div key={sf.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px',
                                background: 'var(--bg-tertiary)', borderRadius: 10,
                                fontSize: 13, transition: 'background 0.15s',
                            }}>
                                <div style={{ minWidth: 0 }}>
                                    <code style={{ color: 'var(--primary-400)', fontSize: 11, fontWeight: 600 }}>{sf.code}</code>
                                    <span style={{ marginLeft: 8, color: 'var(--text-primary)' }}>{sf.title}</span>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                                        {formatDate(sf.request_date)}
                                    </div>
                                </div>
                                <StatusBadge status={sf.status} />
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>
                                Chưa có hoạt động
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
