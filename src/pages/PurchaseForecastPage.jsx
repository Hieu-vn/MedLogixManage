import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth, ROLES } from '../lib/auth'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { usePurchaseForecasts } from '../hooks/useSupabaseQuery'
import { generateCode, formatDate, formatCurrency, getExpiryWarning, calculatePriority, STORAGE_CONDITIONS, monthsBetween } from '../lib/helpers'
import ConsumptionHistoryPanel from '../components/ConsumptionHistoryPanel'
import {
    Plus, Eye, Send, ClipboardList, CheckCircle, XCircle,
    AlertTriangle, Package, ArrowRight, Zap, Download
} from 'lucide-react'
import { useExport } from '../hooks/useExport'

// Business Rule: Safety buffer factor for purchase forecast calculation
// Excel template uses ×1.2 (20% buffer) — configurable
const SAFETY_BUFFER_FACTOR = 1.2

export default function PurchaseForecastPage() {
    const { profile, isRole } = useAuth()
    const toast = useToast()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [viewModalOpen, setViewModalOpen] = useState(false)
    const [viewingForecast, setViewingForecast] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')

    // P4: Correct permission flags — director can approve but not create/submit
    const canManage = isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN)
    const canApprove = isRole(ROLES.LOGISTICS_MANAGER, ROLES.DIRECTOR, ROLES.ADMIN)
    const { exportExcel, exportPDF } = useExport()

    // React Query: cached forecast list
    const { data: forecasts = [], isLoading: loading, refetch: fetchForecasts } = usePurchaseForecasts()

    // Export columns
    const exportColumns = [
        { key: 'code', label: 'Mã phiếu' },
        { key: 'consolidation_date', label: 'Ngày TH', exportRender: v => v ? new Date(v).toLocaleDateString('vi-VN') : '—' },
        { key: 'creator', label: 'Người tạo', exportRender: v => v?.full_name || '—' },
        { key: 'items_count', label: 'Số SP', exportRender: (_, r) => r.purchase_forecast_items?.length || 0 },
        { key: 'status', label: 'Trạng thái' },
    ]
    function handleView(f) { setViewingForecast(f); setViewModalOpen(true) }

    async function handleSubmit(f) {
        if (!f.purchase_forecast_items?.length) { toast.warning('Chưa có sản phẩm!'); return }
        try {
            const { error } = await supabase
                .from('purchase_forecasts')
                .update({ status: 'pending' })
                .eq('id', f.id)
            if (error) throw error
            toast.success(`Đã gửi ${f.code} chờ duyệt`)
            fetchForecasts()
        } catch (err) { toast.error('Lỗi: ' + err.message) }
    }

    async function handleApprove(forecast) {
        // P5: Role guard — only authorized roles can approve
        if (!canApprove) { toast.error('Không có quyền duyệt'); return }
        try {
            const items = forecast.purchase_forecast_items || []

            // === VALIDATE: All items must have supplier_id ===
            const missingNCC = items.filter(i => !i.supplier_id && !i.supplier?.id)
            if (missingNCC.length > 0) {
                const names = missingNCC.map(i => i.product?.name || i.product?.code || '?').join(', ')
                toast.error(`Chưa gán NCC cho: ${names}. Vui lòng gán NCC trước khi duyệt.`)
                return
            }

            // Batch update items: set approved_qty = qty_to_purchase (parallel instead of sequential)
            await Promise.all(items.map(item =>
                supabase
                    .from('purchase_forecast_items')
                    .update({ approved_qty: item.qty_to_purchase })
                    .eq('id', item.id)
            ))

            // Mark forecast as approved
            const { error } = await supabase
                .from('purchase_forecasts')
                .update({
                    status: 'approved',
                    approved_by: profile.id,
                    approved_at: new Date().toISOString(),
                })
                .eq('id', forecast.id)
            if (error) throw error

            // === AUTO CREATE POs — group items by supplier_id ===
            const approvedItems = items.filter(i => i.qty_to_purchase > 0)
            const bySupplier = {}
            for (const item of approvedItems) {
                const sid = item.supplier_id || item.supplier?.id
                if (!sid) continue
                if (!bySupplier[sid]) bySupplier[sid] = []
                bySupplier[sid].push(item)
            }

            let poCount = 0
            // A11: Pre-fetch all needed data before the loop
            const allSupplierIds = Object.keys(bySupplier)
            const { data: allSuppliersData } = await supabase
                .from('suppliers').select('id, is_domestic, payment_terms')
                .in('id', allSupplierIds)
            const suppLookup = Object.fromEntries((allSuppliersData || []).map(s => [s.id, s]))

            const { data: allPrices } = await supabase.from('price_list')
                .select('product_id, supplier_id, unit_price')
                .eq('is_current', true)
                .in('supplier_id', allSupplierIds)
            const priceLookup = {}
            ;(allPrices || []).forEach(p => {
                priceLookup[`${p.product_id}_${p.supplier_id}`] = p.unit_price
            })

            for (const [supplierId, supplierItems] of Object.entries(bySupplier)) {
                const suppData = suppLookup[supplierId]
                const poCode = generateCode('PO')

                // Build PO items with pre-fetched price lookup
                const poItems = []
                let totalAmount = 0
                for (const item of supplierItems) {
                    const productId = item.product_id || item.product?.id
                    const unitPrice = priceLookup[`${productId}_${supplierId}`] || 0
                    const qty = item.approved_qty || item.qty_to_purchase
                    const lineTotal = qty * unitPrice
                    totalAmount += lineTotal
                    poItems.push({
                        product_id: productId,
                        quantity: qty,
                        unit_price: unitPrice,
                        price_list_price: unitPrice,
                        price_deviation_pct: 0,
                        line_total: lineTotal,
                    })
                }
                const vatAmount = Math.round(totalAmount * 0.08)
                const grandTotal = totalAmount + vatAmount

                // Insert PO
                const { data: poData, error: poErr } = await supabase
                    .from('purchase_orders').insert({
                        code: poCode,
                        supplier_id: supplierId,
                        purchase_forecast_id: forecast.id,
                        is_domestic: suppData?.is_domestic ?? true,
                        payment_terms: suppData?.payment_terms || '',
                        total_amount: totalAmount,
                        vat_pct: 8,
                        vat_amount: vatAmount,
                        grand_total: grandTotal,
                        status: 'draft',
                        created_by: profile.id,
                    }).select().single()
                if (poErr) throw poErr

                // Insert PO items
                const itemsPayload = poItems.map(i => ({ ...i, po_id: poData.id }))
                const { error: piErr } = await supabase.from('po_items').insert(itemsPayload)
                if (piErr) throw piErr
                poCount++
            }

            // Update forecast status to po_created
            if (poCount > 0) {
                await supabase.from('purchase_forecasts')
                    .update({ status: 'po_created' })
                    .eq('id', forecast.id)
            }

            toast.success(`Đã duyệt ${forecast.code} — Tự động tạo ${poCount} PO`)
            fetchForecasts()
            setViewModalOpen(false)

            // Navigate to PO page after short delay
            if (poCount > 0) {
                setTimeout(() => navigate('/purchase-orders'), 800)
            }
        } catch (err) { toast.error('Lỗi: ' + err.message) }
    }

    const filtered = statusFilter === 'all' ? forecasts : forecasts.filter(f => f.status === statusFilter)

    const columns = [
        {
            key: 'code', label: 'Mã phiếu', sortable: true, width: '140px',
            render: (v) => <code style={{ color: 'var(--primary-400)', fontSize: 'var(--font-xs)' }}>{v}</code>
        },
        {
            key: 'consolidation_date', label: 'Ngày tổng hợp', sortable: true, width: '120px',
            render: (v) => formatDate(v)
        },
        { key: 'creator', label: 'Người tạo', width: '140px', render: (v) => v?.full_name || '—' },
        {
            key: 'purchase_forecast_items', label: 'Số SP', width: '70px',
            render: (v) => <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>{v?.length || 0}</span>
        },
        { key: 'status', label: 'Trạng thái', width: '120px', render: (v) => <StatusBadge status={v} /> },
        {
            key: 'actions', label: '', width: '120px',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleView(row) }} title="Xem"><Eye size={14} /></button>
                    {row.status === 'draft' && canManage && (
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleSubmit(row) }} title="Gửi duyệt" style={{ color: 'var(--accent-500)' }}><Send size={14} /></button>
                    )}
                </div>
            )
        },
    ]

    return (
        <div>
            <PageHeader
                title="Dự trù mua hàng"
                subtitle="Tổng hợp nhu cầu từ phiếu dự trù Sales đã duyệt"
                icon={<ClipboardList size={20} />}
                actions={
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {canManage && (
                            <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
                                <Plus size={16} /> Tạo phiếu tổng hợp
                            </button>
                        )}
                        <button className="btn btn-ghost" onClick={() => exportExcel(exportColumns, filtered, 'du_tru_mua', 'Dự Trù Mua')}>
                            <Download size={14} /> Excel
                        </button>
                        <button className="btn btn-ghost" onClick={() => exportPDF(exportColumns, filtered, 'Danh sách Dự Trù Mua Hàng', 'du_tru_mua')}>
                            <Download size={14} /> PDF
                        </button>
                    </div>
                }
            />

            {/* Stat Cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 'var(--space-3)', marginBottom: 'var(--space-5)',
            }}>
                {[
                    { label: 'Tổng phiếu', value: forecasts.length, color: '#6C5CE7', icon: <ClipboardList size={18} /> },
                    { label: 'Nháp', value: forecasts.filter(f => f.status === 'draft').length, color: '#718096', icon: <Package size={18} /> },
                    { label: 'Chờ duyệt', value: forecasts.filter(f => f.status === 'pending').length, color: '#FDCB6E', icon: <AlertTriangle size={18} /> },
                    { label: 'Đã duyệt', value: forecasts.filter(f => f.status === 'approved').length, color: '#00B894', icon: <CheckCircle size={18} /> },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0,
                        }}>{s.icon}</div>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{s.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                {[
                    { key: 'all', label: 'Tất cả', count: forecasts.length },
                    { key: 'draft', label: '📝 Nháp', count: forecasts.filter(f => f.status === 'draft').length },
                    { key: 'pending', label: '⏳ Chờ duyệt', count: forecasts.filter(f => f.status === 'pending').length },
                    { key: 'approved', label: '✅ Đã duyệt', count: forecasts.filter(f => f.status === 'approved').length },
                ].map(c => (
                    <button key={c.key} className={`btn btn-sm ${statusFilter === c.key ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setStatusFilter(c.key)}>
                        {c.label} ({c.count})
                    </button>
                ))}
            </div>

            <DataTable columns={columns} data={filtered} loading={loading}
                searchPlaceholder="Tìm mã phiếu..." searchKeys={['code']}
                emptyMessage="Chưa có phiếu dự trù mua hàng"
                exportable exportFilename="du_tru_mua_hang" />

            <CreatePurchaseForecastModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onCreated={() => { setCreateModalOpen(false); fetchForecasts() }}
                profile={profile}
            />

            <ViewPurchaseForecastModal
                isOpen={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                forecast={viewingForecast}
                isLogistics={canApprove}
                onApprove={handleApprove}
            />
        </div>
    )
}

// ========================================
// Create Modal — consolidate from approved sales forecasts
// ========================================
function CreatePurchaseForecastModal({ isOpen, onClose, onCreated, profile }) {
    const toast = useToast()
    const [approvedSFs, setApprovedSFs] = useState([])
    const [selectedSFs, setSelectedSFs] = useState([])
    const [consolidatedItems, setConsolidatedItems] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [inventoryLots, setInventoryLots] = useState([])
    const [saving, setSaving] = useState(false)
    const [step, setStep] = useState(1) // 1: select SFs, 2: review items

    useEffect(() => {
        if (isOpen) {
            setStep(1); setSelectedSFs([]); setConsolidatedItems([])
            loadData()
        }
    }, [isOpen])

    async function loadData() {
        const [sfRes, suppRes, invRes] = await Promise.all([
            supabase.from('sales_forecasts')
                .select(`*, sales_forecast_items(*, product:product_id(*), hospital:hospital_id(*))`)
                .eq('status', 'approved').order('created_at', { ascending: false }),
            supabase.from('suppliers').select('id, name, is_domestic').eq('is_active', true).order('name'),
            supabase.from('inventory_lots').select('product_id, quantity, expiry_date')
                .eq('status', 'available')
                .neq('status', 'quarantine'),
        ])
        setApprovedSFs(sfRes.data || [])
        setSuppliers(suppRes.data || [])
        setInventoryLots(invRes.data || [])
    }

    function toggleSF(sf) {
        setSelectedSFs(prev =>
            prev.some(s => s.id === sf.id) ? prev.filter(s => s.id !== sf.id) : [...prev, sf]
        )
    }

    function consolidate() {
        const itemMap = new Map()

        for (const sf of selectedSFs) {
            for (const item of (sf.sales_forecast_items || [])) {
                const key = item.product?.id
                if (!key) continue

                if (itemMap.has(key)) {
                    const existing = itemMap.get(key)
                    existing.total_requested += item.quantity
                    if (item.needed_date < existing.earliest_needed_date) {
                        existing.earliest_needed_date = item.needed_date
                    }
                } else {
                    // Calculate current stock from inventory lots
                    // FR-2.2: Loại bỏ lô có HSD < 8 tháng khỏi tồn kho khả dụng
                    const allLots = inventoryLots.filter(l => l.product_id === key)
                    const usableLots = allLots.filter(l => {
                        if (!l.expiry_date) return true
                        return monthsBetween(new Date(), l.expiry_date) >= 8
                    })
                    const currentStock = usableLots.reduce((sum, l) => sum + l.quantity, 0)
                    const nearExpiry = allLots.filter(l => l.expiry_date && monthsBetween(new Date(), l.expiry_date) < 8)
                    const nearExpiryQty = nearExpiry.reduce((sum, l) => sum + l.quantity, 0)
                    const nearestExpiry = allLots.length > 0
                        ? allLots.reduce((min, l) => l.expiry_date && l.expiry_date < min ? l.expiry_date : min, allLots[0]?.expiry_date || null)
                        : null

                    itemMap.set(key, {
                        product_id: key,
                        product: item.product,
                        total_requested: item.quantity,
                        current_stock: currentStock,
                        near_expiry_qty: nearExpiryQty,
                        qty_to_purchase: Math.max(0, Math.round((item.quantity - currentStock) * SAFETY_BUFFER_FACTOR)),
                        earliest_needed_date: item.needed_date,
                        nearest_expiry: nearestExpiry,
                        priority: 'normal',
                        supplier_id: '',
                        notes: '',
                    })
                }
            }
        }

        // Recalculate qty_to_purchase and priority
        const items = Array.from(itemMap.values()).map(item => {
            item.qty_to_purchase = Math.max(0, Math.round((item.total_requested - item.current_stock) * SAFETY_BUFFER_FACTOR))
            item.priority = calculatePriority(item.earliest_needed_date, item.current_stock, item.total_requested)
            return item
        })

        // Sort by priority: urgent first
        items.sort((a, b) => {
            const order = { urgent: 0, normal: 1, low: 2 }
            return (order[a.priority] || 1) - (order[b.priority] || 1)
        })

        setConsolidatedItems(items)
        setStep(2)
    }

    function updateItem(index, key, value) {
        setConsolidatedItems(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item))
    }

    async function handleSave() {
        setSaving(true)
        try {
            const code = generateCode('PF')
            const { data: pf, error: pfErr } = await supabase
                .from('purchase_forecasts')
                .insert({
                    code,
                    consolidation_date: new Date().toISOString().split('T')[0],
                    status: 'draft',
                    created_by: profile.id,
                })
                .select()
                .single()
            if (pfErr) throw pfErr

            const pfItems = consolidatedItems.map(item => ({
                forecast_id: pf.id,
                product_id: item.product_id,
                supplier_id: item.supplier_id || null,
                total_requested: item.total_requested,
                current_stock: item.current_stock,
                qty_to_purchase: item.qty_to_purchase,
                priority: item.priority,
                earliest_needed_date: item.earliest_needed_date,
                notes: item.notes,
            }))

            const { error: itemsErr } = await supabase.from('purchase_forecast_items').insert(pfItems)
            if (itemsErr) throw itemsErr

            // Mark selected SFs as transferred
            for (const sf of selectedSFs) {
                await supabase.from('sales_forecasts').update({ status: 'transferred' }).eq('id', sf.id)
            }

            toast.success(`Tạo phiếu ${code} thành công (${consolidatedItems.length} SP)`)
            onCreated()
        } catch (err) {
            toast.error('Lỗi: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose}
            title={step === 1 ? 'Bước 1: Chọn phiếu dự trù đã duyệt' : 'Bước 2: Xác nhận tổng hợp'}
            size="xl"
            footer={
                step === 1 ? (
                    <>
                        <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
                        <button className="btn btn-primary" onClick={consolidate} disabled={selectedSFs.length === 0}>
                            <ArrowRight size={16} /> Tổng hợp ({selectedSFs.length} phiếu)
                        </button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-ghost" onClick={() => setStep(1)}>← Quay lại</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Đang lưu...</> : 'Tạo phiếu'}
                        </button>
                    </>
                )
            }>
            {step === 1 ? (
                /* Step 1: Select approved SFs */
                approvedSFs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                        Không có phiếu dự trù nào đã duyệt. Vui lòng duyệt phiếu từ Sales trước.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {approvedSFs.map(sf => {
                            const selected = selectedSFs.some(s => s.id === sf.id)
                            return (
                                <div key={sf.id} onClick={() => toggleSF(sf)} style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                    padding: 'var(--space-3) var(--space-4)',
                                    background: selected ? 'rgba(108,92,231,0.1)' : 'var(--bg-tertiary)',
                                    border: `1px solid ${selected ? 'var(--primary-500)' : 'var(--border-secondary)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer', transition: 'all var(--transition-fast)',
                                }}>
                                    <input type="checkbox" checked={selected} readOnly style={{ width: 18, height: 18 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                            <code style={{ color: 'var(--primary-400)', fontSize: 'var(--font-xs)' }}>{sf.code}</code>
                                            <span style={{ fontWeight: 500 }}>{sf.title}</span>
                                        </div>
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                            {sf.sales_forecast_items?.length || 0} SP  •  {formatDate(sf.request_date)}
                                        </div>
                                    </div>
                                    <StatusBadge status={sf.status} />
                                </div>
                            )
                        })}
                    </div>
                )
            ) : (
                /* Step 2: Review consolidated items */
                <div>
                    <div style={{
                        padding: 'var(--space-3) var(--space-4)', background: 'rgba(9,132,227,0.08)',
                        borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)',
                        fontSize: 'var(--font-sm)', color: 'var(--blue-500)',
                    }}>
                        ℹ️ Tổng hợp từ {selectedSFs.length} phiếu → {consolidatedItems.length} sản phẩm. Kiểm tra và điều chỉnh SL mua, NCC, ưu tiên.
                    </div>

                    <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '35px' }}>#</th>
                                    <th>Sản phẩm</th>
                                    <th style={{ width: '75px' }}>Yêu cầu</th>
                                    <th style={{ width: '75px' }}>Tồn kho</th>
                                    <th style={{ width: '85px' }}>Cần mua</th>
                                    <th style={{ width: '90px' }}>Ưu tiên</th>
                                    <th style={{ width: '130px' }}>NCC</th>
                                    <th style={{ width: '100px' }}>Ngày cần</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consolidatedItems.map((item, i) => (
                                    <tr key={i} style={item.priority === 'urgent' ? { background: 'rgba(214,48,49,0.05)' } : {}}>
                                        <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{i + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 500, fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                {item.product?.name}
                                                {/* FR-2.4: Cảnh báo bảo quản đặc biệt */}
                                                {item.product?.storage_condition && item.product.storage_condition !== 'normal' && (
                                                    <span title={STORAGE_CONDITIONS[item.product.storage_condition]?.label} style={{
                                                        fontSize: '0.7rem', background: `${STORAGE_CONDITIONS[item.product.storage_condition]?.color}15`,
                                                        padding: '1px 5px', borderRadius: 4, color: STORAGE_CONDITIONS[item.product.storage_condition]?.color,
                                                    }}>{STORAGE_CONDITIONS[item.product.storage_condition]?.icon} {STORAGE_CONDITIONS[item.product.storage_condition]?.label}</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)' }}>{item.product?.code} • {item.product?.unit}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.total_requested}</td>
                                        <td style={{ textAlign: 'center', color: item.current_stock === 0 ? 'var(--red-400)' : 'var(--text-secondary)' }}>
                                            {item.current_stock}
                                            {/* FR-2.2/2.3: Cảnh báo lô HSD sắp hết */}
                                            {item.near_expiry_qty > 0 && (
                                                <div style={{ fontSize: '0.6rem', color: '#D63031', marginTop: 1 }}
                                                     title={`${item.near_expiry_qty} đvt tồn kho HSD < 8 tháng đã bị loại`}>
                                                    ⚠️ -{item.near_expiry_qty} HSD sát
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <input type="number" className="form-input" value={item.qty_to_purchase} min={0}
                                                onChange={(e) => updateItem(i, 'qty_to_purchase', Number(e.target.value))}
                                                style={{ fontSize: 'var(--font-xs)', padding: '3px 6px', textAlign: 'center', fontWeight: 700, color: 'var(--accent-500)' }} />
                                        </td>
                                        <td>
                                            <select className="form-select" value={item.priority}
                                                onChange={(e) => updateItem(i, 'priority', e.target.value)}
                                                style={{ fontSize: 'var(--font-xs)', padding: '3px 6px' }}>
                                                <option value="urgent">🔴 Gấp</option>
                                                <option value="normal">🟡 Bình thường</option>
                                                <option value="low">🟢 Thấp</option>
                                            </select>
                                        </td>
                                        <td>
                                            <select className="form-select" value={item.supplier_id}
                                                onChange={(e) => updateItem(i, 'supplier_id', e.target.value)}
                                                style={{ fontSize: 'var(--font-xs)', padding: '3px 6px' }}>
                                                <option value="">Chọn...</option>
                                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ fontSize: 'var(--font-xs)' }}>{formatDate(item.earliest_needed_date)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    )
}

// ========================================
// View Modal
// ========================================
function ViewPurchaseForecastModal({ isOpen, onClose, forecast, isLogistics, onApprove }) {
    // FR-2.7: Consumption history state
    const [historyProduct, setHistoryProduct] = useState(null)
    if (!isOpen || !forecast) return null
    const items = forecast.purchase_forecast_items || []
    const canApprove = isLogistics && forecast.status === 'pending'

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Phiếu: ${forecast.code}`} size="xl"
            footer={
                canApprove ? (
                    <>
                        <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
                        <button className="btn btn-success" onClick={() => onApprove(forecast)}>
                            <CheckCircle size={16} /> Duyệt phiếu
                        </button>
                    </>
                ) : <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
            }>
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 'var(--space-4)', marginBottom: 'var(--space-5)',
                padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
            }}>
                <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Ngày tổng hợp</div>
                    <div style={{ fontWeight: 600 }}>{formatDate(forecast.consolidation_date)}</div>
                </div>
                <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Người tạo</div>
                    <div style={{ fontWeight: 600 }}>{forecast.creator?.full_name || '—'}</div>
                </div>
                <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Trạng thái</div>
                    <div><StatusBadge status={forecast.status} /></div>
                </div>
                <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Tổng SP</div>
                    <div style={{ fontWeight: 600 }}>{items.length}</div>
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '35px' }}>#</th>
                            <th>Sản phẩm</th>
                            <th style={{ width: '70px' }}>YC</th>
                            <th style={{ width: '70px' }}>Tồn</th>
                            <th style={{ width: '80px' }}>Cần mua</th>
                            <th style={{ width: '80px' }}>Ưu tiên</th>
                            <th>NCC</th>
                            <th style={{ width: '100px' }}>Ngày cần</th>
                            <th style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, i) => (
                            <tr key={item.id} style={item.priority === 'urgent' ? { background: 'rgba(214,48,49,0.05)' } : {}}>
                                <td style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                                <td>
                                    <div style={{ fontWeight: 500 }}>{item.product?.name || '—'}</div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{item.product?.code}</div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.total_requested}</td>
                                <td style={{ textAlign: 'center', color: item.current_stock === 0 ? 'var(--red-400)' : '' }}>{item.current_stock}</td>
                                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent-500)' }}>{item.qty_to_purchase}</td>
                                <td><PriorityBadge priority={item.priority} /></td>
                                <td style={{ fontSize: 'var(--font-sm)' }}>{item.supplier?.name || '—'}</td>
                                <td style={{ fontSize: 'var(--font-xs)' }}>{formatDate(item.earliest_needed_date)}</td>
                                <td>
                                    <button className="btn btn-icon btn-ghost btn-sm" title="Lịch sử tiêu thụ"
                                        onClick={() => setHistoryProduct(historyProduct?.id === item.product?.id ? null : { id: item.product?.id, name: item.product?.name })}
                                        style={{ color: historyProduct?.id === item.product?.id ? 'var(--primary-400)' : 'var(--text-tertiary)' }}>
                                        📊
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* FR-2.7: Consumption History Panel */}
            {historyProduct && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                    <ConsumptionHistoryPanel
                        productId={historyProduct.id}
                        productName={historyProduct.name}
                    />
                </div>
            )}
        </Modal>
    )
}
