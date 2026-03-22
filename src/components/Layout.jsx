import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../lib/auth'
import {
    LayoutDashboard, FileText, ClipboardList, ShoppingCart,
    Ship, Warehouse, Truck, Database, LogOut,
    Sun, Moon, ChevronRight, ChevronLeft, Shield, PanelLeftClose, PanelLeftOpen,
    PackageOpen, LogOut as LogOutIcon
} from 'lucide-react'
import NotificationBell from './NotificationBell'

const NAV_ITEMS = [
    {
        section: 'Tổng quan',
        items: [
            { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
        ]
    },
    {
        section: 'Quy trình',
        items: [
            { path: '/sales-forecast', label: 'Dự trù Sales', icon: FileText, module: 'sales_forecast' },
            { path: '/purchase-forecast', label: 'Dự trù mua hàng', icon: ClipboardList, module: 'purchase_forecast' },
            { path: '/purchase-orders', label: 'Đặt hàng', icon: ShoppingCart, module: 'purchase_order' },
            { path: '/import-shipments', label: 'Nhập khẩu', icon: Ship, module: 'import_shipment' },
            { path: '/warehouse', label: 'Nhập kho', icon: Warehouse, module: 'warehouse' },
            { path: '/inventory', label: 'Quản lý kho', icon: PackageOpen, module: 'inventory' },
            { path: '/stock-exports', label: 'Xuất kho', icon: LogOutIcon, module: 'stock_export' },
            { path: '/delivery', label: 'Vận chuyển', icon: Truck, module: 'delivery' },
        ]
    },
    {
        section: 'Hệ thống',
        items: [
            { path: '/master-data', label: 'Danh mục', icon: Database, module: 'master_data' },
            { path: '/audit-trail', label: 'Audit Trail', icon: Shield, module: 'audit_trail' },
        ]
    },
]

const PAGE_TITLES = {
    '/dashboard': 'Dashboard',
    '/sales-forecast': 'Dự trù từ Sales',
    '/purchase-forecast': 'Dự trù mua hàng',
    '/purchase-orders': 'Đặt hàng',
    '/import-shipments': 'Nhập khẩu',
    '/warehouse': 'Nhập kho',
    '/inventory': 'Quản lý kho',
    '/stock-exports': 'Xuất kho',
    '/delivery': 'Vận chuyển & Giao hàng',
    '/master-data': 'Danh mục dữ liệu',
    '/audit-trail': 'Audit Trail',
    '/profile': 'Hồ sơ cá nhân',
}

export default function Layout({ children }) {
    const { profile, signOut, hasAccess } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true')

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('theme', theme)
    }, [theme])

    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', collapsed)
    }, [collapsed])

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark')
    }

    const currentPageTitle = PAGE_TITLES[location.pathname] || 'MedLogixManage'
    const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(-2).toUpperCase() || '?'

    return (
        <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">M</div>
                    {!collapsed && (
                        <div className="sidebar-brand">
                            <span className="sidebar-brand-name">MedLogix</span>
                            <span className="sidebar-brand-sub">Manage</span>
                        </div>
                    )}
                    <button
                        className="sidebar-collapse-btn"
                        onClick={() => setCollapsed(prev => !prev)}
                        title={collapsed ? 'Mở rộng' : 'Thu gọn'}
                    >
                        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map(section => {
                        const visibleItems = section.items.filter(item => hasAccess(item.module))
                        if (visibleItems.length === 0) return null
                        return (
                            <div key={section.section} className="sidebar-section">
                                {!collapsed && <div className="sidebar-section-title">{section.section}</div>}
                                {visibleItems.map(item => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        <item.icon size={18} />
                                        {!collapsed && <span>{item.label}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        )
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div
                            className="sidebar-avatar"
                            style={{ background: ROLE_COLORS[profile?.role] || '#636E72', cursor: 'pointer' }}
                            onClick={() => navigate('/profile')}
                            title="Xem hồ sơ"
                        >
                            {initials}
                        </div>
                        {!collapsed && (
                            <div className="sidebar-user-info" style={{ cursor: 'pointer' }}
                                onClick={() => navigate('/profile')}>
                                <div className="sidebar-user-name">{profile?.full_name || 'User'}</div>
                                <div className="sidebar-user-role">{ROLE_LABELS[profile?.role] || profile?.role}</div>
                            </div>
                        )}
                        <LogOut size={16} style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                            onClick={signOut} title="Đăng xuất" />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                {/* Topbar */}
                <header className="topbar">
                    <div className="topbar-left">
                        <div className="topbar-breadcrumb">
                            <span>MedLogixManage</span>
                            <ChevronRight size={14} />
                            <span>{currentPageTitle}</span>
                        </div>
                    </div>
                    <div className="topbar-right">
                        <button className="theme-toggle" onClick={toggleTheme} title="Đổi giao diện">
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <NotificationBell />
                    </div>
                </header>

                {/* Content Area */}
                <main className="content-area">
                    {children}
                </main>
            </div>
        </div>
    )
}
