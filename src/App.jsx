import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { useAuth } from './lib/auth'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import RoleGuard from './components/RoleGuard'

// Code-splitting: each page loads on-demand instead of all upfront
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MasterDataPage = lazy(() => import('./pages/MasterDataPage'))
const SalesForecastPage = lazy(() => import('./pages/SalesForecastPage'))
const PurchaseForecastPage = lazy(() => import('./pages/PurchaseForecastPage'))
const PurchaseOrderPage = lazy(() => import('./pages/PurchaseOrderPage'))
const ImportShipmentPage = lazy(() => import('./pages/ImportShipmentPage'))
const WarehouseReceiptPage = lazy(() => import('./pages/WarehouseReceiptPage'))
const AuditTrailPage = lazy(() => import('./pages/AuditTrailPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

function PageLoader() {
    return (
        <div className="loading-screen" style={{ minHeight: '60vh' }}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Đang tải trang...</p>
        </div>
    )
}

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
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
                <ToastProvider>
                    <Suspense fallback={<PageLoader />}>
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
                    </Suspense>
                </ToastProvider>
            </ErrorBoundary>
        </QueryClientProvider>
    )
}
