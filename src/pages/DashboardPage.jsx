import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, getExpiryWarning } from '../lib/helpers'
import { StatusBadge } from '../components/Badges'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import SkeletonLoader from '../components/SkeletonLoader'
import {
    FileText, ClipboardList, ShoppingCart, Ship,
    Warehouse, AlertTriangle, ArrowRight,
    Package, Clock, Calendar, DollarSign, LayoutDashboard, Hospital, Users
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts'

const TOOLTIP_STYLE = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)',
    borderRadius: 8, color: 'var(--text-primary)', fontSize: 12,
}

export default function DashboardPage() {
    const { profile } = useAuth()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { fetchDashboardData() }, [])

    async function fetchDashboardData() {
        try {
            const [
                { data: salesForecasts },
                { data: purchaseForecasts },
                { data: products },
                { data: inventoryLots },
                { data: hospitals },
                { data: suppliers },
                { data: recentSF },
                { data: purchaseOrders },
                { data: importShipments },
                { data: warehouseReceipts },
                { data: consumption },
            ] = await Promise.all([
                supabase.from('sales_forecasts').select('id, status, code, title, request_date, created_by(full_name)'),
                supabase.from('purchase_forecasts').select('id, status, code'),
                supabase.from('products').select('id, name, code, storage_condition, safety_stock_qty, is_active, category'),
                supabase.from('inventory_lots').select('id, product_id, quantity, expiry_date, status, storage_condition, unit_cost'),
                supabase.from('hospitals').select('id').eq('is_active', true),
                supabase.from('suppliers').select('id').eq('is_active', true),
                supabase.from('sales_forecasts')
                    .select('id, code, title, status, request_date, created_by(full_name)')
                    .order('created_at', { ascending: false }).limit(5),
                supabase.from('purchase_orders').select('id, status, code'),
                supabase.from('import_shipments').select('id, status, code'),
                supabase.from('warehouse_receipts').select('id, status, code'),
                supabase.from('mock_consumption').select('product_id, qty_delivered, month'),
            ])

            const sf = salesForecasts || []
            const pf = purchaseForecasts || []
            const lots = inventoryLots || []
            const prods = products || []
            const po = purchaseOrders || []
            const nk = importShipments || []
            const wr = warehouseReceipts || []
            const cons = consumption || []

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

            // Pipeline
            const pipeline = [
                { label: 'Dự trù Sales', count: sf.filter(f => ['draft', 'pending'].includes(f.status)).length, icon: FileText, color: '#6C5CE7' },
                { label: 'Dự trù MH', count: pf.filter(f => ['draft', 'pending'].includes(f.status)).length, icon: ClipboardList, color: '#0984E3' },
                { label: 'Đặt hàng', count: po.filter(f => !['received', 'cancelled'].includes(f.status)).length, icon: ShoppingCart, color: '#00B894' },
                { label: 'Nhập khẩu', count: nk.filter(f => f.status !== 'completed').length, icon: Ship, color: '#FDCB6E' },
                { label: 'Nhập kho', count: wr.filter(f => f.status !== 'completed').length, icon: Warehouse, color: '#E17055' },
            ]

            // Chart 1: Inventory by category
            const categoryMap = {}
            prods.forEach(p => {
                if (!p.is_active) return
                const cat = p.category || 'Khác'
                if (!categoryMap[cat]) categoryMap[cat] = { name: cat, stock: 0, products: 0 }
                categoryMap[cat].products++
                categoryMap[cat].stock += stockByProduct[p.id] || 0
            })
            const categoryData = Object.values(categoryMap).sort((a, b) => b.stock - a.stock)

            // Chart 2: Storage condition pie
            const storagePie = [
                { name: 'Thường', value: lots.filter(l => l.storage_condition === 'normal').length, color: '#00B894' },
                { name: 'Mát 2-8°C', value: lots.filter(l => l.storage_condition === 'cool').length, color: '#0984E3' },
                { name: 'Lạnh -20°C', value: lots.filter(l => l.storage_condition === 'cold').length, color: '#6C5CE7' },
            ].filter(s => s.value > 0)

            // Chart 3: Top products by consumption (last 6 months)
            const consMap = {}
            cons.forEach(c => {
                if (!consMap[c.product_id]) consMap[c.product_id] = 0
                consMap[c.product_id] += c.qty_delivered
            })
            const topProducts = Object.entries(consMap)
                .map(([pid, qty]) => {
                    const prod = prods.find(p => p.id === pid)
                    return { name: prod?.code || pid.substring(0, 8), qty, fullName: prod?.name }
                })
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 8)

            // Monthly consumption trend
            const monthlyMap = {}
            cons.forEach(c => {
                const key = c.month?.substring(0, 7)
                if (key) {
                    if (!monthlyMap[key]) monthlyMap[key] = { month: key, qty: 0 }
                    monthlyMap[key].qty += c.qty_delivered
                }
            })
            const monthlyTrend = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month))

            setStats({
                pendingCount,
                totalProducts: prods.filter(p => p.is_active).length,
                totalHospitals: (hospitals || []).length,
                totalSuppliers: (suppliers || []).length,
                expiryAlerts,
                lowStockProducts,
                pipeline,
                storagePie,
                categoryData,
                topProducts,
                monthlyTrend,
                recentSF: recentSF || [],
                expiryCount90,
                stockValue,
            })
        } catch (err) {
            console.error('Dashboard error:', err)
        } finally { setLoading(false) }
    }

    if (loading) return <SkeletonLoader type="cards" rows={6} />
    if (!stats) return null

    return (
        <div>
            <PageHeader
                title="Dashboard"
                subtitle={`Xin chào, ${profile?.full_name}! Tổng quan hệ thống hôm nay.`}
                icon={<LayoutDashboard size={20} />}
            />

            {/* KPI Cards — using StatCard */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
            }}>
                <StatCard icon={<Clock size={22} />} label="Chờ duyệt" value={stats.pendingCount} color="#FDCB6E" />
                <StatCard icon={<Package size={22} />} label="Sản phẩm" value={stats.totalProducts} color="#6C5CE7" />
                <StatCard icon={<Hospital size={22} />} label="Bệnh viện" value={stats.totalHospitals} color="#0984E3" />
                <StatCard icon={<Users size={22} />} label="Nhà cung cấp" value={stats.totalSuppliers} color="#00B894" />
                <StatCard icon={<Calendar size={22} />} label="HSD <90 ngày" value={stats.expiryCount90} color={stats.expiryCount90 > 0 ? '#E17055' : '#00B894'} />
                <StatCard icon={<DollarSign size={22} />} label="Giá trị tồn kho" value={formatCurrency(stats.stockValue)} color="#0984E3" />
            </div>

            {/* Pipeline */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header"><h3>📊 Pipeline — Luồng quy trình</h3></div>
                <div className="card-body">
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                        overflowX: 'auto', padding: 'var(--space-2) 0',
                    }}>
                        {stats.pipeline.map((step, i) => (
                            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)',
                                    background: `${step.color}15`, border: `1px solid ${step.color}30`,
                                    borderRadius: 'var(--radius-lg)', minWidth: 120, textAlign: 'center',
                                    transition: 'all 0.2s', cursor: 'default',
                                }}>
                                    <step.icon size={20} style={{ color: step.color }} />
                                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{step.label}</span>
                                    <span style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: step.color }}>{step.count}</span>
                                </div>
                                {i < stats.pipeline.length - 1 && (
                                    <ArrowRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Charts Row 1: Category bar + Storage pie */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="card">
                    <div className="card-header"><h3>📦 Tồn kho theo danh mục</h3></div>
                    <div className="card-body" style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.categoryData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                                <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={80} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Bar dataKey="stock" name="Tồn kho" fill="#6C5CE7" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header"><h3>🌡️ Điều kiện bảo quản</h3></div>
                    <div className="card-body" style={{ height: 260, display: 'flex', alignItems: 'center' }}>
                        {stats.storagePie.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.storagePie} cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                                        dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                        {stats.storagePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', width: '100%', color: 'var(--text-tertiary)' }}>Chưa có dữ liệu</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts Row 2: Top products + Monthly trend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="card">
                    <div className="card-header"><h3>🏆 Top sản phẩm (tiêu thụ)</h3></div>
                    <div className="card-body" style={{ height: 260 }}>
                        {stats.topProducts.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.topProducts} layout="vertical" margin={{ left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                                    <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} width={70} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n, p) => [`${v} units`, p.payload.fullName || 'SP']} />
                                    <Bar dataKey="qty" name="SL tiêu thụ" fill="#00B894" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', paddingTop: 'var(--space-8)' }}>Chưa có dữ liệu tiêu thụ</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header"><h3>📈 Xu hướng tiêu thụ theo tháng</h3></div>
                    <div className="card-body" style={{ height: 260 }}>
                        {stats.monthlyTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.monthlyTrend} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0984E3" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#0984E3" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                                    <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                    <Area type="monotone" dataKey="qty" name="SL tiêu thụ" stroke="#0984E3"
                                        fillOpacity={1} fill="url(#trendGradient)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', paddingTop: 'var(--space-8)' }}>Chưa có dữ liệu</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Alerts + Recent */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="card">
                    <div className="card-header"><h3>⚠️ Cảnh báo ({stats.expiryAlerts.length + stats.lowStockProducts.length})</h3></div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 300, overflowY: 'auto' }}>
                        {stats.lowStockProducts.map((p, i) => (
                            <div key={`stock-${i}`} style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                padding: 'var(--space-2) var(--space-3)',
                                background: 'rgba(214,48,49,0.08)', borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(214,48,49,0.2)', fontSize: 'var(--font-sm)',
                            }}>
                                <AlertTriangle size={14} style={{ color: '#D63031', flexShrink: 0 }} />
                                <span><strong>{p.name}</strong> — Tồn {p.currentStock}/{p.safety_stock_qty} (thiếu {Math.abs(p.deficit)})</span>
                            </div>
                        ))}
                        {stats.expiryAlerts.map((lot, i) => (
                            <div key={`exp-${i}`} style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                padding: 'var(--space-2) var(--space-3)',
                                background: lot.warning.level === 'danger' ? 'rgba(214,48,49,0.08)' : 'rgba(253,203,110,0.08)',
                                borderRadius: 'var(--radius-md)',
                                border: `1px solid ${lot.warning.level === 'danger' ? 'rgba(214,48,49,0.2)' : 'rgba(253,203,110,0.2)'}`,
                                fontSize: 'var(--font-sm)',
                            }}>
                                <Calendar size={14} style={{ color: lot.warning.level === 'danger' ? '#D63031' : '#FDCB6E', flexShrink: 0 }} />
                                <span><strong>{lot.productName}</strong> ({lot.productCode}) — HSD: {formatDate(lot.expiry_date)}</span>
                            </div>
                        ))}
                        {stats.expiryAlerts.length === 0 && stats.lowStockProducts.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--accent-500)', padding: 'var(--space-4)' }}>
                                ✅ Không có cảnh báo
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header"><h3>🕐 Phiếu gần đây</h3></div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 300, overflowY: 'auto' }}>
                        {stats.recentSF.length > 0 ? stats.recentSF.map(sf => (
                            <div key={sf.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: 'var(--space-2) var(--space-3)',
                                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-sm)',
                            }}>
                                <div>
                                    <code style={{ color: 'var(--primary-400)', fontSize: 'var(--font-xs)' }}>{sf.code}</code>
                                    <span style={{ marginLeft: 'var(--space-2)' }}>{sf.title}</span>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                        {sf.created_by?.full_name} • {formatDate(sf.request_date)}
                                    </div>
                                </div>
                                <StatusBadge status={sf.status} />
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)' }}>
                                Chưa có hoạt động
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
