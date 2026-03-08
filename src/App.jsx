import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import RoleGuard from './components/RoleGuard'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MasterDataPage from './pages/MasterDataPage'
import SalesForecastPage from './pages/SalesForecastPage'
import PurchaseForecastPage from './pages/PurchaseForecastPage'
import PurchaseOrderPage from './pages/PurchaseOrderPage'
import ImportShipmentPage from './pages/ImportShipmentPage'
import WarehouseReceiptPage from './pages/WarehouseReceiptPage'
import AuditTrailPage from './pages/AuditTrailPage'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-secondary)' }}>Đang tải...</p>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return children
}

export default function App() {
    return (
        <ToastProvider>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                    path="/*"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Routes>
                                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                    <Route path="/dashboard" element={<DashboardPage />} />
                                    <Route path="/profile" element={<ProfilePage />} />
                                    <Route path="/master-data" element={
                                        <RoleGuard module="master_data"><MasterDataPage /></RoleGuard>
                                    } />
                                    <Route path="/sales-forecast" element={
                                        <RoleGuard module="sales_forecast"><SalesForecastPage /></RoleGuard>
                                    } />
                                    <Route path="/purchase-forecast" element={
                                        <RoleGuard module="purchase_forecast"><PurchaseForecastPage /></RoleGuard>
                                    } />
                                    <Route path="/purchase-orders" element={
                                        <RoleGuard module="purchase_order"><PurchaseOrderPage /></RoleGuard>
                                    } />
                                    <Route path="/import-shipments" element={
                                        <RoleGuard module="import_shipment"><ImportShipmentPage /></RoleGuard>
                                    } />
                                    <Route path="/warehouse" element={
                                        <RoleGuard module="warehouse"><WarehouseReceiptPage /></RoleGuard>
                                    } />
                                    <Route path="/audit-trail" element={
                                        <RoleGuard module="audit_trail"><AuditTrailPage /></RoleGuard>
                                    } />
                                    <Route path="*" element={
                                        <div className="empty-state">
                                            <h3>🚧 Đang phát triển</h3>
                                            <p style={{ color: 'var(--text-tertiary)', marginTop: '8px' }}>Module này sẽ sớm được hoàn thiện</p>
                                        </div>
                                    } />
                                </Routes>
                            </Layout>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </ToastProvider>
    )
}
