import { useState, useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import {
    Package, Search, AlertTriangle,
    Archive, Eye, Download, BarChart3, Calendar, Clock
} from 'lucide-react'
import { formatDate, formatCurrency, STORAGE_CONDITIONS, monthsBetween } from '../lib/helpers'
import { useInventoryData } from '../hooks/useSupabaseQuery'
import { useExport } from '../hooks/useExport'
import OverviewTab from '../components/inventory/OverviewTab'
import MovementsTab from '../components/inventory/MovementsTab'
import ExpiryTab from '../components/inventory/ExpiryTab'

const STATUS_CONFIG = {
    available: { label: 'Sẵn sàng', color: '#00B894', icon: '✅' },
    quarantine: { label: 'Biệt trữ', color: '#D63031', icon: '🔒' },
    expired: { label: 'Hết hạn', color: '#636E72', icon: '⏰' },
}

function getExpiryLevel(expiryDate) {
    if (!expiryDate) return null
    const months = monthsBetween(new Date(), expiryDate)
    if (months <= 0) return { level: 'expired', label: 'Đã hết hạn', color: '#636E72', bg: 'rgba(99,110,114,0.1)' }
    if (months <= 3) return { level: 'danger', label: `${months} tháng`, color: '#D63031', bg: 'rgba(214,48,49,0.08)' }
    if (months <= 6) return { level: 'warning', label: `${months} tháng`, color: '#FDCB6E', bg: 'rgba(253,203,110,0.1)' }
    return { level: 'ok', label: `${months} tháng`, color: '#00B894', bg: 'transparent' }
}

const TABS = [
    { key: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { key: 'lots', label: 'Tồn kho Lot', icon: Package },
    { key: 'movements', label: 'Biến động kho', icon: Calendar },
    { key: 'expiry', label: 'Cảnh báo HSD', icon: Clock },
]

export default function InventoryPage() {
    const { isRole } = useAuth()
    const toast = useToast()
    const [activeTab, setActiveTab] = useState('overview')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [storageFilter, setStorageFilter] = useState('all')
    const [showDetail, setShowDetail] = useState(null)
    const { exportExcel, exportPDF } = useExport()

    const { data: inventoryData, isLoading: loading } = useInventoryData()
    const lots = inventoryData?.lots || []

    // Aggregate product-level stock
    const productStock = useMemo(() => {
        const map = {}
        lots.forEach(lot => {
            const pid = lot.product_id
            if (!map[pid]) {
                map[pid] = { product: lot.product, totalQty: 0, totalValue: 0, lotCount: 0, earliestExpiry: null, hasLowStock: false, lots: [] }
            }
            map[pid].totalQty += lot.quantity || 0
            map[pid].totalValue += (lot.quantity || 0) * (parseFloat(lot.unit_cost) || 0)
            map[pid].lotCount++
            map[pid].lots.push(lot)
            if (!map[pid].earliestExpiry || (lot.expiry_date && lot.expiry_date < map[pid].earliestExpiry)) {
                map[pid].earliestExpiry = lot.expiry_date
            }
        })
        Object.values(map).forEach(ps => {
            if (ps.product?.safety_stock_qty && ps.totalQty <= ps.product.safety_stock_qty) ps.hasLowStock = true
        })
        return map
    }, [lots])

    // Filtered lots (for Lot tab)
    const filteredLots = useMemo(() => {
        let result = lots
        if (statusFilter !== 'all') result = result.filter(l => l.status === statusFilter)
        if (storageFilter !== 'all') result = result.filter(l => l.storage_condition === storageFilter)
        if (search) {
            const q = search.toLowerCase()
            result = result.filter(l =>
                l.product?.code?.toLowerCase().includes(q) ||
                l.product?.name?.toLowerCase().includes(q) ||
                l.lot_number?.toLowerCase().includes(q) ||
                l.product?.manufacturer?.toLowerCase().includes(q)
            )
        }
        return result
    }, [lots, statusFilter, storageFilter, search])

    const exportColumns = [
        { key: 'product_code', label: 'Mã SP', exportRender: (_, r) => r.product?.code || '' },
        { key: 'product_name', label: 'Tên SP', exportRender: (_, r) => r.product?.name || '' },
        { key: 'manufacturer', label: 'Hãng SX', exportRender: (_, r) => r.product?.manufacturer || '' },
        { key: 'lot_number', label: 'Số Lot' },
        { key: 'expiry_date', label: 'HSD', exportRender: v => v ? new Date(v).toLocaleDateString('vi-VN') : '' },
        { key: 'quantity', label: 'Tồn kho' },
        { key: 'unit', label: 'ĐVT', exportRender: (_, r) => r.product?.unit || '' },
        { key: 'storage_condition', label: 'Bảo quản', exportRender: v => STORAGE_CONDITIONS[v]?.label || v },
        { key: 'storage_location', label: 'Vị trí' },
        { key: 'status', label: 'Trạng thái', exportRender: v => STATUS_CONFIG[v]?.label || v },
    ]

    const tabStyle = (key) => ({
        padding: 'var(--space-2) var(--space-4)',
        background: activeTab === key ? 'var(--primary)' : 'transparent',
        color: activeTab === key ? '#fff' : 'var(--text-secondary)',
        border: 'none', borderRadius: 'var(--radius-md)',
        cursor: 'pointer', fontWeight: activeTab === key ? 700 : 500,
        fontSize: 'var(--font-sm)',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.2s ease',
    })

    return (
        <div>
            <PageHeader
                title="Quản lý kho"
                subtitle="Tổng quan, tồn kho, biến động, cảnh báo HSD"
                icon={<Archive size={20} />}
                actions={activeTab === 'lots' ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={() => exportExcel(exportColumns, filteredLots, 'ton_kho', 'Tồn Kho')}>
                            <Download size={14} /> Excel
                        </button>
                        <button className="btn btn-ghost" onClick={() => exportPDF(exportColumns, filteredLots, 'Báo cáo Tồn Kho', 'ton_kho')}>
                            <Download size={14} /> PDF
                        </button>
                    </div>
                ) : null}
            />

            {/* Tab Navigation */}
            <div style={{
                display: 'flex', gap: 'var(--space-1)',
                padding: 'var(--space-1)', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)',
                width: 'fit-content',
            }}>
                {TABS.map(tab => (
                    <button key={tab.key} style={tabStyle(tab.key)} onClick={() => setActiveTab(tab.key)}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : (
                <>
                    {/* Tab: Tổng quan */}
                    {activeTab === 'overview' && (
                        <OverviewTab lots={lots} productStock={productStock} />
                    )}

                    {/* Tab: Tồn kho Lot */}
                    {activeTab === 'lots' && (
                        <div>
                            {/* Filters */}
                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
                                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                    <input className="form-input" placeholder="Tìm mã SP, tên SP, lot, hãng SX..."
                                        value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    {[
                                        { key: 'all', label: `Tất cả (${lots.length})` },
                                        { key: 'available', label: `✅ Sẵn sàng (${lots.filter(l => l.status === 'available').length})` },
                                        { key: 'quarantine', label: `🔒 Biệt trữ (${lots.filter(l => l.status === 'quarantine').length})` },
                                        { key: 'expired', label: `⏰ Hết hạn (${lots.filter(l => l.status === 'expired').length})` },
                                    ].map(f => (
                                        <button key={f.key} className={`btn btn-sm ${statusFilter === f.key ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setStatusFilter(f.key)}>{f.label}</button>
                                    ))}
                                </div>
                                <select className="form-input" style={{ width: 'auto', minWidth: 140 }}
                                    value={storageFilter} onChange={e => setStorageFilter(e.target.value)}>
                                    <option value="all">🏠 Tất cả BQ</option>
                                    <option value="normal">🏠 Thường</option>
                                    <option value="cool">❄️ Mát 2-8°C</option>
                                    <option value="cold">🧊 Lạnh -20°C</option>
                                </select>
                            </div>

                            {filteredLots.length === 0 ? (
                                <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
                                    <Archive size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }} />
                                    <h3>Chưa có dữ liệu tồn kho</h3>
                                </div>
                            ) : (
                                <div className="card">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>#</th><th>Mã SP</th><th>Tên sản phẩm</th><th>Hãng SX</th>
                                                <th>Lot</th><th>HSD</th><th>Tồn kho</th><th>ĐVT</th>
                                                <th>Bảo quản</th><th>Vị trí</th><th>Trạng thái</th><th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredLots.map((lot, idx) => {
                                                const expiry = getExpiryLevel(lot.expiry_date)
                                                const ps = productStock[lot.product_id]
                                                const isLowStock = ps?.hasLowStock
                                                const sc = STORAGE_CONDITIONS[lot.storage_condition] || {}
                                                const stCfg = STATUS_CONFIG[lot.status] || {}
                                                return (
                                                    <tr key={lot.id} style={{
                                                        background: expiry?.level === 'expired' ? 'rgba(99,110,114,0.06)'
                                                            : expiry?.level === 'danger' ? 'rgba(214,48,49,0.04)'
                                                            : isLowStock ? 'rgba(253,203,110,0.04)' : undefined,
                                                    }}>
                                                        <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{idx + 1}</td>
                                                        <td><span className="code-badge">{lot.product?.code}</span></td>
                                                        <td>
                                                            <div>{lot.product?.name}</div>
                                                            {lot.product?.packaging && (
                                                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{lot.product.packaging}</div>
                                                            )}
                                                        </td>
                                                        <td style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{lot.product?.manufacturer || '—'}</td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)' }}>{lot.lot_number}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <span>{formatDate(lot.expiry_date)}</span>
                                                                {expiry && expiry.level !== 'ok' && (
                                                                    <span style={{ fontSize: '0.625rem', fontWeight: 700, color: expiry.color, whiteSpace: 'nowrap' }}>
                                                                        {expiry.level === 'expired' ? '⏰ HẾT HẠN' : `⚠️ ${expiry.label}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700, color: isLowStock ? '#FDCB6E' : 'var(--text-primary)' }}>
                                                            {lot.quantity}
                                                            {isLowStock && <AlertTriangle size={12} style={{ marginLeft: 4, color: '#FDCB6E' }} />}
                                                        </td>
                                                        <td style={{ fontSize: 'var(--font-sm)' }}>{lot.product?.unit || '—'}</td>
                                                        <td><span style={{ color: sc.color, fontSize: 'var(--font-xs)' }}>{sc.icon} {sc.label}</span></td>
                                                        <td style={{ fontSize: 'var(--font-sm)' }}>{lot.storage_location || '—'}</td>
                                                        <td>
                                                            <span className="status-badge" style={{ background: `${stCfg.color}20`, color: stCfg.color }}>
                                                                {stCfg.icon} {stCfg.label}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-ghost btn-sm" onClick={() => setShowDetail(lot.product_id)}>
                                                                <Eye size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab: Biến động kho */}
                    {activeTab === 'movements' && <MovementsTab lots={lots} />}

                    {/* Tab: Cảnh báo HSD */}
                    {activeTab === 'expiry' && <ExpiryTab lots={lots} />}
                </>
            )}

            {/* Product detail modal */}
            {showDetail && productStock[showDetail] && (
                <Modal title={`Tồn kho: ${productStock[showDetail].product?.name}`} onClose={() => setShowDetail(null)} size="lg">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                            <div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Mã SP</div>
                                <div style={{ fontWeight: 600 }}>{productStock[showDetail].product?.code}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Hãng SX</div>
                                <div>{productStock[showDetail].product?.manufacturer || '—'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Tổng tồn kho</div>
                                <div style={{ fontWeight: 800, fontSize: 'var(--font-lg)', color: '#6C5CE7' }}>
                                    {productStock[showDetail].totalQty} {productStock[showDetail].product?.unit}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Tổng giá trị</div>
                                <div style={{ fontWeight: 600 }}>{formatCurrency(productStock[showDetail].totalValue)}</div>
                            </div>
                        </div>
                        {productStock[showDetail].hasLowStock && (
                            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(253,203,110,0.1)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: '#FDCB6E', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={16} />
                                <span><strong>Tồn kho thấp!</strong> Tồn hiện tại ({productStock[showDetail].totalQty}) ≤ mức an toàn ({productStock[showDetail].product?.safety_stock_qty})</span>
                            </div>
                        )}
                        <div>
                            <h4 style={{ marginBottom: 'var(--space-2)' }}>Chi tiết theo Lot ({productStock[showDetail].lotCount} lots)</h4>
                            <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                                <thead><tr><th>#</th><th>Lot Number</th><th>HSD</th><th>Tồn kho</th><th>Giá vốn</th><th>Bảo quản</th><th>Vị trí</th><th>TT</th></tr></thead>
                                <tbody>
                                    {productStock[showDetail].lots.map((lot, idx) => {
                                        const expiry = getExpiryLevel(lot.expiry_date)
                                        const sc = STORAGE_CONDITIONS[lot.storage_condition] || {}
                                        const stCfg = STATUS_CONFIG[lot.status] || {}
                                        return (
                                            <tr key={lot.id} style={{ background: expiry?.bg }}>
                                                <td>{idx + 1}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{lot.lot_number}</td>
                                                <td>{formatDate(lot.expiry_date)} {expiry && expiry.level !== 'ok' && <span style={{ color: expiry.color, fontSize: 'var(--font-xs)', marginLeft: 4 }}>{expiry.level === 'expired' ? '⏰' : '⚠️'}</span>}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{lot.quantity}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(lot.unit_cost)}</td>
                                                <td><span style={{ color: sc.color, fontSize: 'var(--font-xs)' }}>{sc.icon} {sc.label}</span></td>
                                                <td>{lot.storage_location || '—'}</td>
                                                <td><span style={{ color: stCfg.color, fontSize: 'var(--font-xs)' }}>{stCfg.icon}</span></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
