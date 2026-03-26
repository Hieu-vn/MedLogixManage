import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth, ROLES } from '../lib/auth'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import {
    Plus, Eye, Edit2, Send, Trash2, Check, X,
    ShoppingCart, AlertTriangle, TrendingUp, TrendingDown,
    Package, DollarSign, FileText, CheckCircle, Clock,
    Filter, Calendar, Download
} from 'lucide-react'
import { formatDate, formatCurrency } from '../lib/helpers'
import { usePurchaseOrders, usePOMasterData } from '../hooks/useSupabaseQuery'
import POTimeline, { getOverdueBadge } from '../components/POTimeline'
import { useExport } from '../hooks/useExport'

// Business Rule: PO > 200,000,000 VNĐ requires Director approval
const DIRECTOR_APPROVAL_THRESHOLD = 200_000_000

const PO_STATUS_CONFIG = {
    draft: { label: 'Nháp', color: '#636E72' },
    pending: { label: 'Chờ GĐ duyệt', color: '#FDCB6E' },
    approved: { label: 'GĐ đã duyệt', color: '#00B894' },
    rejected: { label: 'GĐ từ chối', color: '#D63031' },
    sent: { label: 'Đã gửi NCC', color: '#0984E3' },
    confirmed: { label: 'NCC xác nhận', color: '#6C5CE7' },
    delivering: { label: 'Đang giao', color: '#E17055' },
    received: { label: 'Đã nhận', color: '#00B894' },
    cancelled: { label: 'Đã hủy', color: '#636E72' },
}

const STATUS_FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'draft', label: 'Nháp' },
    { key: 'pending', label: 'Chờ duyệt' },
    { key: 'approved', label: 'Đã duyệt' },
    { key: 'sent', label: 'Đã gửi' },
]

export default function PurchaseOrderPage() {
    const { profile, isRole } = useAuth()
    const toast = useToast()
    const queryClient = useQueryClient()

    // State
    const [statusFilter, setStatusFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [supplierFilter, setSupplierFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [showView, setShowView] = useState(null)
    const [showEdit, setShowEdit] = useState(null)

    // React Query: cached data
    const { data: orders = [], isLoading: loading, refetch: fetchAll } = usePurchaseOrders()
    const { data: masterData } = usePOMasterData()
    const suppliers = masterData?.suppliers || []
    const products = masterData?.products || []
    const priceList = masterData?.priceList || []

    // Filtered orders
    const filteredOrders = useMemo(() => {
        let list = orders
        if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter)
        if (search) {
            const s = search.toLowerCase()
            list = list.filter(o =>
                o.code?.toLowerCase().includes(s) ||
                o.supplier?.name?.toLowerCase().includes(s)
            )
        }
        if (supplierFilter) list = list.filter(o => o.supplier_id === supplierFilter)
        if (dateFrom) list = list.filter(o => o.created_at >= dateFrom)
        if (dateTo) list = list.filter(o => o.created_at <= dateTo + 'T23:59:59')
        return list
    }, [orders, statusFilter, search, supplierFilter, dateFrom, dateTo])

    // Status counts
    const statusCounts = useMemo(() => {
        const counts = { all: orders.length }
        orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1 })
        return counts
    }, [orders])

    // PO stats for stat cards (wireframe P1)
    const poStats = useMemo(() => {
        const overdueCount = orders.filter(o => {
            if (['received', 'cancelled'].includes(o.status)) return false
            if (!o.expected_delivery) return false
            return new Date(o.expected_delivery) < new Date()
        }).length
        const sentCount = (statusCounts.sent || 0) + (statusCounts.confirmed || 0) + (statusCounts.delivering || 0)
        const totalValue = orders.reduce((s, o) => s + (o.grand_total || 0), 0)
        return {
            total: orders.length,
            pending: statusCounts.pending || 0,
            sent: sentCount,
            overdue: overdueCount,
            totalValue,
        }
    }, [orders, statusCounts])

    // Generate next PO code
    async function getNextCode() {
        const year = new Date().getFullYear()
        const { count } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true })
        return `PO-${year}-${String((count || 0) + 1).padStart(4, '0')}`
    }

    // Get price from price list
    function getPriceInfo(productId, supplierId) {
        const entry = priceList.find(p =>
            p.product_id === productId && p.supplier_id === supplierId
        )
        return entry || null
    }

    // ========== CREATE/EDIT PO ==========
    function CreateEditModal({ po, onClose }) {
        const isEdit = !!po
        const [form, setForm] = useState({
            supplier_id: po?.supplier_id || '',
            payment_terms: po?.payment_terms || '',
            expected_delivery: po?.expected_delivery || '',
            vat_pct: po?.vat_pct || 8,
            shipping_cost: po?.shipping_cost || 0,
            notes: po?.notes || '',
        })
        const [items, setItems] = useState(
            po?.po_items?.map(i => ({
                id: i.id,
                product_id: i.product_id,
                lot_number: i.lot_number || '',
                expiry_date: i.expiry_date || '',
                quantity: i.quantity,
                unit_price: i.unit_price,
                price_list_price: i.price_list_price,
                price_deviation_pct: i.price_deviation_pct,
                pick_now_qty: i.pick_now_qty || i.quantity,
                backorder_qty: i.backorder_qty || 0,
                notes: i.notes || '',
            })) || [{ product_id: '', lot_number: '', expiry_date: '', quantity: 1, unit_price: 0, price_list_price: null, price_deviation_pct: 0, pick_now_qty: 1, backorder_qty: 0, notes: '' }]
        )
        const [saving, setSaving] = useState(false)

        function addItem() {
            setItems(prev => [...prev, { product_id: '', lot_number: '', expiry_date: '', quantity: 1, unit_price: 0, price_list_price: null, price_deviation_pct: 0, pick_now_qty: 1, backorder_qty: 0, notes: '' }])
        }

        function removeItem(idx) {
            if (items.length <= 1) return
            setItems(prev => prev.filter((_, i) => i !== idx))
        }

        function updateItem(idx, field, value) {
            setItems(prev => {
                const next = [...prev]
                next[idx] = { ...next[idx], [field]: value }

                // Auto price check when product or price changes
                if (field === 'product_id' || field === 'unit_price') {
                    const pi = getPriceInfo(
                        field === 'product_id' ? value : next[idx].product_id,
                        form.supplier_id
                    )
                    if (pi) {
                        next[idx].price_list_price = pi.unit_price
                        const price = field === 'unit_price' ? parseFloat(value) || 0 : parseFloat(next[idx].unit_price) || 0
                        if (pi.unit_price > 0) {
                            next[idx].price_deviation_pct = ((price - pi.unit_price) / pi.unit_price * 100).toFixed(1)
                        }
                    } else {
                        next[idx].price_list_price = null
                        next[idx].price_deviation_pct = 0
                    }
                }
                return next
            })
        }

        // Calculations
        const totalAmount = items.reduce((sum, i) => sum + (i.quantity * (parseFloat(i.unit_price) || 0)), 0)
        const vatAmount = totalAmount * (form.vat_pct / 100)
        const grandTotal = totalAmount + vatAmount + (parseFloat(form.shipping_cost) || 0)

        async function handleSave() {
            if (!form.supplier_id) { toast.warning('Chọn nhà cung cấp'); return }
            if (items.some(i => !i.product_id || !i.quantity)) { toast.warning('Điền đầy đủ sản phẩm và SL'); return }

            setSaving(true)
            try {
                const orderData = {
                    supplier_id: form.supplier_id,
                    is_domestic: suppliers.find(s => s.id === form.supplier_id)?.is_domestic ?? true,
                    payment_terms: form.payment_terms,
                    expected_delivery: form.expected_delivery || null,
                    vat_pct: form.vat_pct,
                    shipping_cost: parseFloat(form.shipping_cost) || 0,
                    total_amount: totalAmount,
                    vat_amount: vatAmount,
                    grand_total: grandTotal,
                    notes: form.notes,
                    updated_at: new Date().toISOString(),
                }

                let orderId
                if (isEdit) {
                    const { error } = await supabase.from('purchase_orders').update(orderData).eq('id', po.id)
                    if (error) throw error
                    orderId = po.id
                    // A16: Smart delete — only remove items no longer in the list
                    const { data: existingPoItems } = await supabase.from('po_items')
                        .select('id, product_id').eq('po_id', po.id)
                    const incomingProductIds = new Set(items.map(i => i.product_id))
                    const toRemove = (existingPoItems || []).filter(e => !incomingProductIds.has(e.product_id))
                    if (toRemove.length > 0) {
                        await supabase.from('po_items').delete().in('id', toRemove.map(d => d.id))
                    }
                } else {
                    const code = await getNextCode()
                    const { data, error } = await supabase.from('purchase_orders').insert({
                        ...orderData,
                        code,
                        status: 'draft',
                        created_by: profile.id,
                    }).select().single()
                    if (error) throw error
                    orderId = data.id
                }

                // Upsert items (insert new, update existing)
                const itemsData = items.map(i => ({
                    po_id: orderId,
                    product_id: i.product_id,
                    lot_number: i.lot_number || null,
                    expiry_date: i.expiry_date || null,
                    quantity: parseInt(i.quantity),
                    unit_price: parseFloat(i.unit_price) || 0,
                    price_list_price: i.price_list_price,
                    price_deviation_pct: parseFloat(i.price_deviation_pct) || 0,
                    line_total: parseInt(i.quantity) * (parseFloat(i.unit_price) || 0),
                    pick_now_qty: parseInt(i.pick_now_qty) || 0,
                    backorder_qty: parseInt(i.backorder_qty) || 0,
                    notes: i.notes || null,
                }))

                const { error: itemsErr } = await supabase.from('po_items').upsert(itemsData, {
                    onConflict: 'po_id,product_id',
                    ignoreDuplicates: false,
                })
                if (itemsErr) {
                    // Fallback if no unique constraint
                    if (isEdit) await supabase.from('po_items').delete().eq('po_id', orderId)
                    const { error: fallbackErr } = await supabase.from('po_items').insert(itemsData)
                    if (fallbackErr) throw fallbackErr
                }

                toast.success(isEdit ? 'Cập nhật PO thành công!' : 'Tạo PO thành công!')
                onClose()
                fetchAll()
            } catch (err) {
                toast.error('Lỗi: ' + err.message)
            } finally { setSaving(false) }
        }

        const selectedSupplier = suppliers.find(s => s.id === form.supplier_id)

        return (
            <Modal title={isEdit ? `Sửa ${po.code}` : 'Tạo Purchase Order mới'} onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Supplier + Terms */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label required">Nhà cung cấp</label>
                            <select className="form-input" value={form.supplier_id}
                                onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}>
                                <option value="">-- Chọn NCC --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} {s.is_domestic ? '🇻🇳' : '🌏'}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Điều khoản TT</label>
                            <input className="form-input" value={form.payment_terms}
                                onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))}
                                placeholder="COD, 30 ngày, LC..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ngày giao dự kiến</label>
                            <input type="date" className="form-input" value={form.expected_delivery}
                                onChange={e => setForm(p => ({ ...p, expected_delivery: e.target.value }))} />
                        </div>
                    </div>

                    {selectedSupplier && (
                        <div style={{
                            padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                            background: 'rgba(108,92,231,0.08)', fontSize: 'var(--font-sm)',
                        }}>
                            📦 {selectedSupplier.name} | {selectedSupplier.is_domestic ? '🇻🇳 Nội địa' : '🌏 Nhập khẩu'} | {selectedSupplier.address || '—'}
                        </div>
                    )}

                    {/* Items Table */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                            <h4>Chi tiết đơn hàng</h4>
                            <button className="btn btn-ghost btn-sm" onClick={addItem}><Plus size={14} /> Thêm dòng</button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}>#</th>
                                        <th>Sản phẩm</th>
                                        <th style={{ width: 100 }}>Lot No.</th>
                                        <th style={{ width: 110 }}>HSD</th>
                                        <th style={{ width: 70 }}>SL</th>
                                        <th style={{ width: 70 }}>Pick</th>
                                        <th style={{ width: 70 }}>BO</th>
                                        <th style={{ width: 110 }}>Đơn giá</th>
                                        <th style={{ width: 100 }}>Giá PL</th>
                                        <th style={{ width: 80 }}>Biến động</th>
                                        <th style={{ width: 110 }}>Thành tiền</th>
                                        <th style={{ width: 40 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const lineTotal = item.quantity * (parseFloat(item.unit_price) || 0)
                                        const deviation = parseFloat(item.price_deviation_pct) || 0
                                        const hasWarning = Math.abs(deviation) > 10
                                        const product = products.find(p => p.id === item.product_id)

                                        return (
                                            <tr key={idx}>
                                                <td>{idx + 1}</td>
                                                <td>
                                                    <select className="form-input" value={item.product_id} style={{ minWidth: 180 }}
                                                        onChange={e => updateItem(idx, 'product_id', e.target.value)}>
                                                        <option value="">-- Chọn SP --</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td><input className="form-input" value={item.lot_number}
                                                    onChange={e => updateItem(idx, 'lot_number', e.target.value)} placeholder="Lot" /></td>
                                                <td><input type="date" className="form-input" value={item.expiry_date}
                                                    onChange={e => updateItem(idx, 'expiry_date', e.target.value)} /></td>
                                                <td><input type="number" className="form-input" value={item.quantity} min="1"
                                                    onChange={e => {
                                                        const qty = parseInt(e.target.value) || 1
                                                        updateItem(idx, 'quantity', qty)
                                                        // Auto-update pick_now_qty to match, backorder to 0
                                                        const updated = [...items]; updated[idx] = { ...updated[idx], quantity: qty, pick_now_qty: qty, backorder_qty: 0 }; setItems(updated)
                                                    }} /></td>
                                                <td><input type="number" className="form-input" value={item.pick_now_qty} min="0"
                                                    max={item.quantity}
                                                    onChange={e => {
                                                        const pick = Math.min(parseInt(e.target.value) || 0, item.quantity)
                                                        const updated = [...items]; updated[idx] = { ...updated[idx], pick_now_qty: pick, backorder_qty: item.quantity - pick }; setItems(updated)
                                                    }}
                                                    style={{ background: item.backorder_qty > 0 ? 'rgba(0,184,148,0.1)' : '' }} /></td>
                                                <td><input type="number" className="form-input" value={item.backorder_qty} min="0"
                                                    readOnly
                                                    style={{ background: item.backorder_qty > 0 ? 'rgba(214,48,49,0.1)' : '', color: item.backorder_qty > 0 ? '#D63031' : '', fontWeight: item.backorder_qty > 0 ? 700 : 400 }} /></td>
                                                <td>
                                                    <input type="number" className="form-input" value={item.unit_price}
                                                        onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                                                        style={hasWarning ? { borderColor: '#D63031' } : {}} />
                                                </td>
                                                <td style={{ textAlign: 'right', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                                    {item.price_list_price ? formatCurrency(item.price_list_price) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {item.price_list_price ? (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 2,
                                                            color: hasWarning ? '#D63031' : '#00B894',
                                                            fontWeight: hasWarning ? 700 : 400,
                                                            fontSize: 'var(--font-xs)',
                                                        }}>
                                                            {deviation > 0 ? <TrendingUp size={12} /> : deviation < 0 ? <TrendingDown size={12} /> : null}
                                                            {deviation > 0 ? '+' : ''}{deviation}%
                                                            {hasWarning && <AlertTriangle size={12} />}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(lineTotal)}</td>
                                                <td>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => removeItem(idx)}
                                                        style={{ color: '#D63031' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Price warnings */}
                        {items.some(i => Math.abs(parseFloat(i.price_deviation_pct) || 0) > 10) && (
                            <div style={{
                                marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                                background: 'rgba(214,48,49,0.1)', borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-sm)', color: '#D63031',
                                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                            }}>
                                <AlertTriangle size={16} />
                                <span><strong>Cảnh báo:</strong> Một số SP có biến động giá &gt;10% so với Price List. Vui lòng kiểm tra.</span>
                            </div>
                        )}
                    </div>

                    {/* Totals */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-4)',
                        borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)',
                    }}>
                        <div className="form-group">
                            <label className="form-label">Ghi chú</label>
                            <textarea className="form-input" value={form.notes} rows={2}
                                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <div style={{ minWidth: 260 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--font-sm)' }}>
                                <span>Tổng tiền hàng:</span>
                                <span style={{ fontWeight: 500 }}>{formatCurrency(totalAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--font-sm)' }}>
                                <span>VAT ({form.vat_pct}%):</span>
                                <span>{formatCurrency(vatAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--font-sm)' }}>
                                <span>Phí vận chuyển:</span>
                                <input type="number" className="form-input" value={form.shipping_cost}
                                    onChange={e => setForm(p => ({ ...p, shipping_cost: e.target.value }))}
                                    style={{ width: 100, textAlign: 'right' }} />
                            </div>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                                borderTop: '2px solid var(--border)', marginTop: 4,
                                fontWeight: 700, fontSize: 'var(--font-md)',
                            }}>
                                <span>TỔNG GIÁ TRỊ:</span>
                                <span style={{ color: 'var(--primary)' }}>{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            <ShoppingCart size={16} /> {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo PO'}
                        </button>
                    </div>
                </div>
            </Modal>
        )
    }

    // ========== VIEW PO ==========
    function ViewModal({ po, onClose }) {
        const canApprove = isRole(ROLES.DIRECTOR, ROLES.ADMIN) && po.status === 'pending'
        const canSendToSupplier = isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && po.status === 'approved'
        const [rejectionReason, setRejectionReason] = useState('')
        const [showReject, setShowReject] = useState(false)

        async function handleApprove() {
            const { error } = await supabase.from('purchase_orders').update({
                status: 'approved',
                approved_by: profile.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', po.id)
            if (error) { toast.error('Lỗi: ' + error.message); return }
            toast.success('Đã duyệt PO!')
            onClose(); fetchAll()
        }

        async function handleReject() {
            if (!rejectionReason.trim()) { toast.warning('Nhập lý do từ chối'); return }
            const { error } = await supabase.from('purchase_orders').update({
                status: 'rejected',
                rejection_reason: rejectionReason,
                approved_by: profile.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', po.id)
            if (error) { toast.error('Lỗi: ' + error.message); return }
            toast.success('Đã từ chối PO')
            onClose(); fetchAll()
        }

        async function handleSendToSupplier() {
            const { error } = await supabase.from('purchase_orders').update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', po.id)
            if (error) { toast.error('Lỗi: ' + error.message); return }
            toast.success('Đã gửi PO cho NCC!')
            onClose(); fetchAll()
        }

        const stConfig = PO_STATUS_CONFIG[po.status] || {}

        return (
            <Modal title={`Chi tiết ${po.code}`} onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* PO Timeline */}
                    <POTimeline po={po} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Trạng thái</div>
                            <span className="status-badge" style={{ background: `${stConfig.color}20`, color: stConfig.color }}>
                                {stConfig.label}
                            </span>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>NCC</div>
                            <div style={{ fontWeight: 600 }}>{po.supplier?.name} {po.is_domestic ? '🇻🇳' : '🌏'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Ngày tạo</div>
                            <div>{formatDate(po.created_at)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Người tạo</div>
                            <div>{po.created_by_profile?.full_name}</div>
                        </div>
                    </div>

                    {/* Items */}
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th><th>Code</th><th>Sản phẩm</th><th>ĐVT</th>
                                <th>Lot</th><th>HSD</th><th>SL</th><th>Pick</th><th>BO</th>
                                <th>Đơn giá</th><th>Giá PL</th><th>Biến động</th><th>Thành tiền</th><th>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {po.po_items?.map((item, idx) => {
                                const dev = parseFloat(item.price_deviation_pct) || 0
                                const hasWarn = Math.abs(dev) > 10
                                return (
                                    <tr key={item.id}>
                                        <td>{idx + 1}</td>
                                        <td><span className="code-badge">{item.product?.code}</span></td>
                                        <td>{item.product?.name}</td>
                                        <td>{item.product?.unit}</td>
                                        <td>{item.lot_number || '—'}</td>
                                        <td>{item.expiry_date ? formatDate(item.expiry_date) : '—'}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--accent-500)' }}>{item.pick_now_qty ?? item.quantity}</td>
                                        <td style={{ textAlign: 'right', color: (item.backorder_qty || 0) > 0 ? '#D63031' : '', fontWeight: (item.backorder_qty || 0) > 0 ? 700 : 400 }}>{item.backorder_qty || 0}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>
                                            {item.price_list_price ? formatCurrency(item.price_list_price) : '—'}
                                        </td>
                                        <td style={{ textAlign: 'center', color: hasWarn ? '#D63031' : '#00B894', fontWeight: hasWarn ? 700 : 400 }}>
                                            {item.price_list_price ? `${dev > 0 ? '+' : ''}${dev}%` : '—'}
                                            {hasWarn && ' ⚠️'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.line_total)}</td>
                                        <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{item.notes || '—'}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ minWidth: 250 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>Tổng tiền hàng:</span><span>{formatCurrency(po.total_amount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>VAT ({po.vat_pct}%):</span><span>{formatCurrency(po.vat_amount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>Phí VC:</span><span>{formatCurrency(po.shipping_cost)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid var(--border)', fontWeight: 700, color: 'var(--primary)' }}>
                                <span>TỔNG:</span><span>{formatCurrency(po.grand_total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Director Approval Section */}
                    {canApprove && !showReject && (
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: 'var(--space-3)',
                            padding: 'var(--space-4)', background: 'rgba(253,203,110,0.08)',
                            borderRadius: 'var(--radius-md)', border: '1px solid rgba(253,203,110,0.3)',
                        }}>
                            <button className="btn btn-primary" onClick={handleApprove}>
                                <Check size={16} /> Duyệt PO
                            </button>
                            <button className="btn btn-danger" onClick={() => setShowReject(true)}>
                                <X size={16} /> Từ chối
                            </button>
                        </div>
                    )}

                    {showReject && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <label className="form-label required">Lý do từ chối</label>
                            <textarea className="form-input" value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)} rows={2}
                                placeholder="Nhập lý do từ chối PO..." />
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button className="btn btn-danger btn-sm" onClick={handleReject}>Xác nhận từ chối</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowReject(false)}>Hủy</button>
                            </div>
                        </div>
                    )}

                    {/* Send to supplier */}
                    {canSendToSupplier && (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={handleSendToSupplier}>
                                <Send size={16} /> Gửi PO cho NCC
                            </button>
                        </div>
                    )}

                    {/* Director Confirm (after sent) */}
                    {isRole(ROLES.DIRECTOR, ROLES.ADMIN) && po.status === 'sent' && (
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: 'var(--space-3)',
                            padding: 'var(--space-4)', background: 'rgba(108,92,231,0.08)',
                            borderRadius: 'var(--radius-md)', border: '1px solid rgba(108,92,231,0.2)',
                        }}>
                            <button className="btn btn-primary" onClick={async () => {
                                await supabase.from('purchase_orders').update({
                                    status: 'confirmed', updated_at: new Date().toISOString(),
                                }).eq('id', po.id)
                                toast.success('GĐ đã xác nhận PO!')
                                onClose(); fetchAll()
                            }}>
                                <CheckCircle size={16} /> GĐ xác nhận PO
                            </button>
                        </div>
                    )}
                </div>
            </Modal>
        )
    }

    // ========== ACTIONS ==========
    const { exportExcel, exportPDF } = useExport()

    // Export columns for PO
    const exportColumns = [
        { key: 'code', label: 'Mã PO' },
        { key: 'supplier_name', label: 'Nhà cung cấp', exportRender: (_, row) => row.supplier?.name || '' },
        { key: 'grand_total', label: 'Tổng giá trị', exportRender: (_, row) => row.grand_total || 0 },
        { key: 'status', label: 'Trạng thái', exportRender: (_, row) => PO_STATUS_CONFIG[row.status]?.label || row.status },
        { key: 'created_at', label: 'Ngày tạo', exportRender: (_, row) => formatDate(row.created_at) },
        { key: 'expected_delivery', label: 'Ngày giao DK', exportRender: (_, row) => formatDate(row.expected_delivery) },
    ]

    async function handleSubmitForApproval(po) {
        if (po.po_items?.length === 0) { toast.warning('PO chưa có sản phẩm'); return }

        // Business Rule: PO > 200M VNĐ → Director approval required
        const needsDirector = (po.grand_total || 0) > DIRECTOR_APPROVAL_THRESHOLD

        if (needsDirector) {
            const { error } = await supabase.from('purchase_orders').update({
                status: 'pending', updated_at: new Date().toISOString(),
            }).eq('id', po.id)
            if (error) { toast.error('Lỗi: ' + error.message); return }
            toast.success(`PO ${po.code} (${formatCurrency(po.grand_total)}) > 200 triệu → Gửi GĐ duyệt`)
        } else {
            // Auto-approve PO under threshold
            const { error } = await supabase.from('purchase_orders').update({
                status: 'approved',
                approved_by: profile.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', po.id)
            if (error) { toast.error('Lỗi: ' + error.message); return }
            toast.success(`PO ${po.code} (${formatCurrency(po.grand_total)}) ≤ 200 triệu → Tự động duyệt ✅`)
        }
        fetchAll()
    }

    async function handleDelete(po) {
        if (!confirm(`Xóa ${po.code}?`)) return
        const { error } = await supabase.from('purchase_orders').delete().eq('id', po.id)
        if (error) { toast.error('Lỗi: ' + error.message); return }
        toast.success('Đã xóa!')
        fetchAll()
    }

    // ========== COLUMNS ==========
    const columns = [
        {
            key: 'code', label: 'Mã PO', sortable: true,
            render: (_, row) => <span className="code-badge">{row.code}</span>,
        },
        {
            key: 'supplier', label: 'Nhà cung cấp', sortable: true,
            render: (_, row) => (
                <span>{row.supplier?.name} {row.is_domestic ? '🇻🇳' : '🌏'}</span>
            ),
        },
        {
            key: 'priority', label: 'Ưu tiên',
            render: (_, row) => {
                const p = row.priority || 'medium'
                const cfg = { high: { label: 'High', bg: '#D6303120', color: '#D63031' }, medium: { label: 'Medium', bg: '#FDCB6E20', color: '#FDCB6E' }, low: { label: 'Low', bg: '#00B89420', color: '#00B894' } }
                const c = cfg[p] || cfg.medium
                return <span className="status-badge" style={{ background: c.bg, color: c.color, fontSize: 'var(--font-xs)' }}>{c.label}</span>
            },
        },
        {
            key: 'items_count', label: 'Số SP',
            render: (_, row) => <span className="count-badge">{row.po_items?.length || 0}</span>,
        },
        {
            key: 'grand_total', label: 'Tổng giá trị', sortable: true,
            render: (_, row) => <span style={{ fontWeight: 600 }}>{formatCurrency(row.grand_total)}</span>,
        },
        {
            key: 'created_at', label: 'Ngày tạo', sortable: true,
            render: (_, row) => formatDate(row.created_at),
        },
        {
            key: 'status', label: 'Trạng thái',
            render: (_, row) => {
                const c = PO_STATUS_CONFIG[row.status] || {}
                return (
                    <span>
                        <span className="status-badge" style={{ background: `${c.color}20`, color: c.color }}>{c.label}</span>
                        {getOverdueBadge(row)}
                    </span>
                )
            },
        },
        {
            key: 'actions', label: '',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowView(row)} title="Xem">
                        <Eye size={14} />
                    </button>
                    {row.status === 'draft' && isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                        <>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(row)} title="Sửa">
                                <Edit2 size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleSubmitForApproval(row)} title="Gửi duyệt">
                                <Send size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(row)} title="Xóa"
                                style={{ color: '#D63031' }}>
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                    {row.status === 'rejected' && isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(row)} title="Sửa lại">
                            <Edit2 size={14} />
                        </button>
                    )}
                </div>
            ),
        },
    ]

    return (
        <div>
            <PageHeader
                title="Quản lý Đặt hàng"
                subtitle="Tạo và quản lý đơn đặt hàng cho nhà cung cấp"
                icon={<ShoppingCart size={20} />}
                actions={
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                                <Plus size={16} /> Tạo PO mới
                            </button>
                        )}
                        <button className="btn btn-ghost" onClick={() => exportExcel(exportColumns, filteredOrders, 'purchase_orders', 'PO')}>
                            <Download size={14} /> Excel
                        </button>
                        <button className="btn btn-ghost" onClick={() => exportPDF(exportColumns, filteredOrders, 'Danh sách Đơn Đặt Hàng', 'purchase_orders')}>
                            <Download size={14} /> PDF
                        </button>
                    </div>
                }
            />

            {/* PO Stat Cards — wireframe P1 */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)', marginBottom: 'var(--space-4)',
            }}>
                <StatCard icon={<ShoppingCart size={24} />} label="Tổng PO" value={poStats.total} color="#6C5CE7" />
                <StatCard icon={<Clock size={24} />} label="Chờ phê duyệt" value={poStats.pending} color="#FDCB6E" />
                <StatCard icon={<Send size={24} />} label="Đã gửi NCC" value={poStats.sent} color="#0984E3" />
                <StatCard icon={<AlertTriangle size={24} />} label="Quá hạn"
                    value={poStats.overdue}
                    color={poStats.overdue > 0 ? '#D63031' : '#00B894'}
                    badge={poStats.overdue > 0 ? { text: 'Cần xử lý', type: 'danger' } : null}
                />
            </div>

            {/* Filter bar — wireframe P2: Search + Status + NCC + Date Range */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)', alignItems: 'center',
            }}>
                <input className="form-input" placeholder="🔍 Tìm mã PO, NCC..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ maxWidth: 240, fontSize: 'var(--font-sm)' }} />
                {STATUS_FILTERS.map(f => (
                    <button key={f.key}
                        className={`chip ${statusFilter === f.key ? 'active' : ''}`}
                        onClick={() => setStatusFilter(f.key)}>
                        {f.label} ({statusCounts[f.key] || 0})
                    </button>
                ))}
                {/* NCC dropdown — wireframe P2 */}
                <select className="form-select"
                    value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
                    style={{ maxWidth: 180, fontSize: 'var(--font-sm)', padding: '6px 30px 6px 10px' }}>
                    <option value="">Tất cả NCC</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {/* Date Range — wireframe P2 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <input type="date" className="form-input"
                        value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        style={{ width: 130, fontSize: 'var(--font-xs)', padding: '5px 8px' }} />
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>→</span>
                    <input type="date" className="form-input"
                        value={dateTo} onChange={e => setDateTo(e.target.value)}
                        style={{ width: 130, fontSize: 'var(--font-xs)', padding: '5px 8px' }} />
                </div>
                {(supplierFilter || dateFrom || dateTo) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSupplierFilter(''); setDateFrom(''); setDateTo('') }}
                        style={{ fontSize: 'var(--font-xs)' }}>
                        <X size={12} /> Xóa lọc
                    </button>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : filteredOrders.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
                    <ShoppingCart size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }} />
                    <h3>Chưa có đơn đặt hàng</h3>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                        {statusFilter !== 'all' ? `Không có PO ở trạng thái "${STATUS_FILTERS.find(f => f.key === statusFilter)?.label}"` : 'Nhấn "Tạo PO mới" để bắt đầu'}
                    </p>
                </div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(row => (
                                <tr key={row.id}>
                                    {columns.map(c => (
                                        <td key={c.key}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            {showCreate && <CreateEditModal onClose={() => setShowCreate(false)} />}
            {showEdit && <CreateEditModal po={showEdit} onClose={() => setShowEdit(null)} />}
            {showView && <ViewModal po={showView} onClose={() => setShowView(null)} />}
        </div>
    )
}
