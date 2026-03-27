import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import {
    ArrowRightLeft, Plus, Search, Eye, Check, X, Download,
    Send, Package, Truck, ClipboardList
} from 'lucide-react'
import { formatDate, formatCurrency } from '../lib/helpers'
import { useStockTransfers } from '../hooks/useSupabaseQuery'
import { useExport } from '../hooks/useExport'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

const STATUS_CONFIG = {
    pending: { label: 'Chờ duyệt', color: '#FDCB6E', icon: '⏳' },
    approved: { label: 'Đã duyệt', color: '#00B894', icon: '✅' },
    rejected: { label: 'Từ chối', color: '#D63031', icon: '❌' },
    completed: { label: 'Hoàn thành', color: '#0984E3', icon: '📦' },
    cancelled: { label: 'Đã huỷ', color: '#636E72', icon: '🚫' },
    transferring: { label: 'Đang chuyển', color: '#FDCB6E', icon: '🚚' },
    partial: { label: 'Chuyển 1 phần', color: '#E17055', icon: '📦' },
}

const TABS = [
    { key: 'requests', label: 'Yêu cầu điều chuyển', icon: ClipboardList },
    { key: 'transfers', label: 'Phiếu điều chuyển', icon: Truck },
]

function generateTransferCode(prefix) {
    const now = new Date()
    const y = now.getFullYear().toString().slice(-2)
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `${prefix}-${y}${m}-${rnd}`
}

export default function StockTransferPage() {
    const { user, profile, isRole } = useAuth()
    const toast = useToast()
    const qc = useQueryClient()
    const { exportExcel, exportPDF } = useExport()

    const [activeTab, setActiveTab] = useState('requests')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [showCreate, setShowCreate] = useState(false)
    const [showDetail, setShowDetail] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    // Create form state
    const [formData, setFormData] = useState({
        from_warehouse: 'KHO_CHINH', to_warehouse: '', notes: '', items: [],
    })
    const [lotSearch, setLotSearch] = useState('')

    const { data, isLoading } = useStockTransfers()
    const requests = data?.requests || []
    const transfers = data?.transfers || []
    const availableLots = data?.availableLots || []

    // Filter logic
    const filteredRequests = useMemo(() => {
        let result = requests
        if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter)
        if (search) {
            const q = search.toLowerCase()
            result = result.filter(r =>
                r.code?.toLowerCase().includes(q) ||
                r.to_warehouse?.toLowerCase().includes(q) ||
                r.notes?.toLowerCase().includes(q)
            )
        }
        return result
    }, [requests, statusFilter, search])

    const filteredTransfers = useMemo(() => {
        let result = transfers
        if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter)
        if (search) {
            const q = search.toLowerCase()
            result = result.filter(t =>
                t.code?.toLowerCase().includes(q) ||
                t.request?.code?.toLowerCase().includes(q)
            )
        }
        return result
    }, [transfers, statusFilter, search])

    // Available lots filtered for add-item
    const searchedLots = useMemo(() => {
        if (!lotSearch) return []
        const q = lotSearch.toLowerCase()
        return availableLots.filter(l =>
            (l.product?.code?.toLowerCase().includes(q) ||
                l.product?.name?.toLowerCase().includes(q) ||
                l.lot_number?.toLowerCase().includes(q)) &&
            !formData.items.some(fi => fi.inventory_lot_id === l.id)
        ).slice(0, 10)
    }, [availableLots, lotSearch, formData.items])

    // Add lot to form
    const addItem = useCallback((lot) => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, {
                inventory_lot_id: lot.id,
                product_id: lot.product_id,
                lot_number: lot.lot_number,
                expiry_date: lot.expiry_date,
                quantity: 1,
                unit: lot.product?.unit || 'Hộp',
                product: lot.product,
                max_qty: lot.quantity,
            }],
        }))
        setLotSearch('')
    }, [])

    const removeItem = useCallback((idx) => {
        setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
    }, [])

    const updateItemQty = useCallback((idx, qty) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map((item, i) => i === idx ? { ...item, quantity: Math.min(Math.max(1, qty), item.max_qty) } : item),
        }))
    }, [])

    // Submit new transfer request
    async function handleSubmitRequest() {
        if (!formData.to_warehouse.trim()) return toast.error('Vui lòng nhập kho đích')
        if (formData.items.length === 0) return toast.error('Vui lòng thêm ít nhất 1 sản phẩm')
        if (formData.from_warehouse === formData.to_warehouse) return toast.error('Kho nguồn và kho đích không được trùng nhau')

        setSubmitting(true)
        try {
            const code = generateTransferCode('YC-DC')
            const { data: req, error: reqErr } = await supabase
                .from('stock_transfer_requests')
                .insert({
                    code,
                    from_warehouse: formData.from_warehouse,
                    to_warehouse: formData.to_warehouse,
                    request_date: new Date().toISOString().split('T')[0],
                    requested_by: user.id,
                    created_by: user.id,
                    status: 'pending',
                    notes: formData.notes,
                })
                .select('id')
                .single()
            if (reqErr) throw reqErr

            const items = formData.items.map(item => ({
                request_id: req.id,
                product_id: item.product_id,
                inventory_lot_id: item.inventory_lot_id,
                lot_number: item.lot_number,
                expiry_date: item.expiry_date,
                quantity: item.quantity,
                unit: item.unit,
            }))
            const { error: itemsErr } = await supabase.from('stock_transfer_request_items').insert(items)
            if (itemsErr) throw itemsErr

            toast.success(`Tạo yêu cầu ${code} thành công`)
            qc.invalidateQueries({ queryKey: ['stock_transfers'] })
            setShowCreate(false)
            setFormData({ from_warehouse: 'KHO_CHINH', to_warehouse: '', notes: '', items: [] })
        } catch (err) {
            toast.error('Lỗi: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Approve/reject request
    async function handleApproveReject(requestId, action, reason) {
        try {
            const update = action === 'approve'
                ? { status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() }
                : { status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString(), rejection_reason: reason || 'Không duyệt' }
            const { error } = await supabase.from('stock_transfer_requests').update(update).eq('id', requestId)
            if (error) throw error
            toast.success(action === 'approve' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu')
            qc.invalidateQueries({ queryKey: ['stock_transfers'] })
            setShowDetail(null)
        } catch (err) {
            toast.error('Lỗi: ' + err.message)
        }
    }

    // Create transfer from approved request
    async function handleCreateTransfer(request) {
        setSubmitting(true)
        try {
            const code = generateTransferCode('DC')
            const { data: tr, error: trErr } = await supabase
                .from('stock_transfers')
                .insert({
                    code,
                    request_id: request.id,
                    from_warehouse: request.from_warehouse,
                    to_warehouse: request.to_warehouse,
                    transfer_date: new Date().toISOString().split('T')[0],
                    transferred_by: user.id,
                    created_by: user.id,
                    status: 'transferring',
                    notes: `Từ Y/c ${request.code}`,
                })
                .select('id')
                .single()
            if (trErr) throw trErr

            const reqItems = request.stock_transfer_request_items || []
            const trItems = reqItems.map(ri => ({
                transfer_id: tr.id,
                product_id: ri.product_id,
                inventory_lot_id: ri.inventory_lot_id,
                lot_number: ri.lot_number,
                expiry_date: ri.expiry_date,
                requested_qty: ri.quantity,
                transferred_qty: ri.quantity,
                unit: ri.unit,
            }))
            const { error: itemErr } = await supabase.from('stock_transfer_items').insert(trItems)
            if (itemErr) throw itemErr

            toast.success(`Tạo phiếu ${code} thành công`)
            qc.invalidateQueries({ queryKey: ['stock_transfers'] })
            setShowDetail(null)
        } catch (err) {
            toast.error('Lỗi: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Complete transfer - deduct inventory
    async function handleCompleteTransfer(transfer) {
        setSubmitting(true)
        try {
            const items = transfer.stock_transfer_items || []
            for (const item of items) {
                if (item.inventory_lot_id) {
                    const { data: lot } = await supabase
                        .from('inventory_lots')
                        .select('quantity')
                        .eq('id', item.inventory_lot_id)
                        .single()
                    if (lot) {
                        const newQty = Math.max(0, lot.quantity - item.transferred_qty)
                        await supabase
                            .from('inventory_lots')
                            .update({ quantity: newQty })
                            .eq('id', item.inventory_lot_id)
                    }
                }
            }
            await supabase
                .from('stock_transfers')
                .update({
                    status: 'completed',
                    received_by: user.id,
                    received_at: new Date().toISOString(),
                })
                .eq('id', transfer.id)

            // Also complete the request if exists
            if (transfer.request_id) {
                await supabase
                    .from('stock_transfer_requests')
                    .update({ status: 'completed' })
                    .eq('id', transfer.request_id)
            }

            toast.success('Hoàn thành điều chuyển, đã trừ tồn kho')
            qc.invalidateQueries({ queryKey: ['stock_transfers'] })
            qc.invalidateQueries({ queryKey: ['inventory_data'] })
            setShowDetail(null)
        } catch (err) {
            toast.error('Lỗi: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const canManage = isRole('logistics_manager') || isRole('admin')
    const canApprove = isRole('logistics_manager') || isRole('director') || isRole('admin')

    const currentList = activeTab === 'requests' ? filteredRequests : filteredTransfers
    const statusOptions = activeTab === 'requests'
        ? ['all', 'pending', 'approved', 'rejected', 'completed']
        : ['all', 'transferring', 'partial', 'completed']

    return (
        <div>
            <PageHeader
                title="Điều chuyển kho"
                subtitle="Yêu cầu và phiếu điều chuyển hàng giữa các kho"
                icon={<ArrowRightLeft size={20} />}
                actions={
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={14} /> Tạo yêu cầu
                    </button>
                }
            />

            {/* Tab Navigation */}
            <div className="segmented-control" style={{ marginBottom: 'var(--space-4)' }}>
                {TABS.map(tab => (
                    <button key={tab.key} className={`segmented-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => { setActiveTab(tab.key); setStatusFilter('all') }}>
                        <tab.icon size={14} /> {tab.label}
                        <span style={{
                            background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)',
                            padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-xs)',
                        }}>
                            {tab.key === 'requests' ? requests.length : transfers.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input className="form-input" placeholder="Tìm mã phiếu, kho đích..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: 32, fontSize: 'var(--font-sm)' }} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    {statusOptions.map(s => {
                        const cfg = s === 'all' ? { label: 'Tất cả', icon: '' } : STATUS_CONFIG[s]
                        const count = s === 'all' ? currentList.length : (activeTab === 'requests' ? requests : transfers).filter(r => r.status === s).length
                        return (
                            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setStatusFilter(s)} style={{ fontSize: 'var(--font-xs)' }}>
                                {cfg?.icon} {cfg?.label} ({count})
                            </button>
                        )
                    })}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => exportExcel(
                        [{ key: 'code', label: 'Mã' }, { key: 'status', label: 'Trạng thái', exportRender: v => STATUS_CONFIG[v]?.label || v }],
                        currentList, 'dieu_chuyen', 'Điều chuyển kho'
                    )}><Download size={14} /> Excel</button>
                </div>
            </div>

            {isLoading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : currentList.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
                    <ArrowRightLeft size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }} />
                    <h3>Chưa có {activeTab === 'requests' ? 'yêu cầu' : 'phiếu'} điều chuyển</h3>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>Nhấn "Tạo yêu cầu" để bắt đầu</p>
                </div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Mã {activeTab === 'requests' ? 'Y/c' : 'Phiếu'}</th>
                                <th>Kho nguồn</th>
                                <th>Kho đích</th>
                                <th>Ngày</th>
                                <th>Số SP</th>
                                <th>{activeTab === 'requests' ? 'Người yêu cầu' : 'Người chuyển'}</th>
                                <th>Trạng thái</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentList.map((item, idx) => {
                                const st = STATUS_CONFIG[item.status] || {}
                                const items = activeTab === 'requests'
                                    ? item.stock_transfer_request_items || []
                                    : item.stock_transfer_items || []
                                const personName = activeTab === 'requests'
                                    ? '—'
                                    : '—'
                                const fromW = activeTab === 'transfers' ? item.request?.from_warehouse || item.from_warehouse : item.from_warehouse
                                const toW = activeTab === 'transfers' ? item.request?.to_warehouse || item.to_warehouse : item.to_warehouse

                                return (
                                    <tr key={item.id}>
                                        <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{idx + 1}</td>
                                        <td><span className="code-badge">{item.code}</span></td>
                                        <td style={{ fontSize: 'var(--font-sm)' }}>{fromW}</td>
                                        <td style={{ fontWeight: 600 }}>{toW}</td>
                                        <td>{formatDate(activeTab === 'requests' ? item.request_date : item.transfer_date)}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{items.length}</td>
                                        <td style={{ fontSize: 'var(--font-sm)' }}>{personName || '—'}</td>
                                        <td>
                                            <span className="status-badge" style={{ background: `${st.color}20`, color: st.color }}>
                                                {st.icon} {st.label}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setShowDetail(item)}>
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

            {/* Create Request Modal */}
            {showCreate && (
                <Modal title="Tạo yêu cầu điều chuyển" onClose={() => setShowCreate(false)} size="lg">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">Kho nguồn *</label>
                                <input className="form-input" value={formData.from_warehouse}
                                    onChange={e => setFormData(p => ({ ...p, from_warehouse: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Kho đích *</label>
                                <input className="form-input" placeholder="Nhập tên kho đích..."
                                    value={formData.to_warehouse}
                                    onChange={e => setFormData(p => ({ ...p, to_warehouse: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ghi chú</label>
                                <input className="form-input" placeholder="Lý do điều chuyển..."
                                    value={formData.notes}
                                    onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
                            </div>
                        </div>

                        {/* Add items from inventory */}
                        <div>
                            <label className="form-label">Thêm sản phẩm từ tồn kho</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                <input className="form-input" placeholder="Tìm mã SP, tên, số lot..."
                                    value={lotSearch} onChange={e => setLotSearch(e.target.value)}
                                    style={{ paddingLeft: 32 }} />
                            </div>
                            {searchedLots.length > 0 && (
                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                                    {searchedLots.map(lot => (
                                        <div key={lot.id} onClick={() => addItem(lot)}
                                            style={{
                                                padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--font-sm)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                                            <span>
                                                <span className="code-badge" style={{ marginRight: 8 }}>{lot.product?.code}</span>
                                                {lot.product?.name}
                                            </span>
                                            <span style={{ color: 'var(--text-tertiary)' }}>
                                                Lot: {lot.lot_number} | Tồn: {lot.quantity} | HSD: {formatDate(lot.expiry_date)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Items table */}
                        {formData.items.length > 0 && (
                            <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                                <thead>
                                    <tr><th>Mã SP</th><th>Tên SP</th><th>Hãng SX</th><th>Lot</th><th>HSD</th><th>Tồn kho</th><th>SL chuyển</th><th>ĐVT</th><th></th></tr>
                                </thead>
                                <tbody>
                                    {formData.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td><span className="code-badge">{item.product?.code}</span></td>
                                            <td>{item.product?.name}</td>
                                            <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{item.product?.manufacturer || '—'}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{item.lot_number}</td>
                                            <td>{formatDate(item.expiry_date)}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{item.max_qty}</td>
                                            <td>
                                                <input type="number" className="form-input" style={{ width: 80, textAlign: 'right' }}
                                                    min={1} max={item.max_qty} value={item.quantity}
                                                    onChange={e => updateItemQty(idx, parseInt(e.target.value) || 1)} />
                                            </td>
                                            <td>{item.unit}</td>
                                            <td>
                                                <button className="btn btn-ghost btn-sm" onClick={() => removeItem(idx)}
                                                    style={{ color: '#D63031' }}>
                                                    <X size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Huỷ</button>
                            <button className="btn btn-primary" onClick={handleSubmitRequest} disabled={submitting}>
                                {submitting ? 'Đang xử lý...' : 'Tạo yêu cầu'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Detail Modal */}
            {showDetail && (
                <Modal title={`${activeTab === 'requests' ? 'Y/c' : 'Phiếu'}: ${showDetail.code}`}
                    onClose={() => setShowDetail(null)} size="lg">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {/* Info grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                            <div><div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Kho nguồn</div><div style={{ fontWeight: 600 }}>{showDetail.from_warehouse || showDetail.request?.from_warehouse}</div></div>
                            <div><div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Kho đích</div><div style={{ fontWeight: 600 }}>{showDetail.to_warehouse || showDetail.request?.to_warehouse}</div></div>
                            <div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Trạng thái</div>
                                <span className="status-badge" style={{ background: `${STATUS_CONFIG[showDetail.status]?.color}20`, color: STATUS_CONFIG[showDetail.status]?.color }}>
                                    {STATUS_CONFIG[showDetail.status]?.icon} {STATUS_CONFIG[showDetail.status]?.label}
                                </span>
                            </div>
                            <div><div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Ngày</div><div>{formatDate(showDetail.request_date || showDetail.transfer_date)}</div></div>
                        </div>

                        {showDetail.notes && (
                            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)' }}>
                                📝 {showDetail.notes}
                            </div>
                        )}

                        {showDetail.rejection_reason && (
                            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(214,48,49,0.08)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: '#D63031' }}>
                                ❌ Lý do từ chối: {showDetail.rejection_reason}
                            </div>
                        )}

                        {/* Items table */}
                        <div>
                            <h4 style={{ marginBottom: 'var(--space-2)' }}>Chi tiết sản phẩm</h4>
                            <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                                <thead>
                                    <tr><th>#</th><th>Mã SP</th><th>Tên SP</th><th>Hãng SX</th><th>Lot</th><th>HSD</th>
                                        {activeTab === 'transfers' && <th style={{ textAlign: 'right' }}>SL yêu cầu</th>}
                                        <th style={{ textAlign: 'right' }}>{activeTab === 'requests' ? 'SL yêu cầu' : 'SL chuyển'}</th>
                                        <th>ĐVT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(activeTab === 'requests' ? showDetail.stock_transfer_request_items : showDetail.stock_transfer_items || []).map((item, idx) => (
                                        <tr key={item.id}>
                                            <td>{idx + 1}</td>
                                            <td><span className="code-badge">{item.product?.code}</span></td>
                                            <td>{item.product?.name}</td>
                                            <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{item.product?.manufacturer || '—'}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{item.lot_number}</td>
                                            <td>{formatDate(item.expiry_date)}</td>
                                            {activeTab === 'transfers' && <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{item.requested_qty}</td>}
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{activeTab === 'requests' ? item.quantity : item.transferred_qty}</td>
                                            <td>{item.unit || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                            {/* Request: pending → approve/reject */}
                            {activeTab === 'requests' && showDetail.status === 'pending' && canApprove && (
                                <>
                                    <button className="btn" style={{ background: '#D63031', color: '#fff' }}
                                        onClick={() => {
                                            const reason = prompt('Lý do từ chối (tuỳ chọn):')
                                            handleApproveReject(showDetail.id, 'reject', reason)
                                        }}>
                                        <X size={14} /> Từ chối
                                    </button>
                                    <button className="btn btn-primary" onClick={() => handleApproveReject(showDetail.id, 'approve')}>
                                        <Check size={14} /> Duyệt
                                    </button>
                                </>
                            )}

                            {/* Request: approved → create transfer */}
                            {activeTab === 'requests' && showDetail.status === 'approved' && canManage && (
                                <button className="btn btn-primary" onClick={() => handleCreateTransfer(showDetail)} disabled={submitting}>
                                    <Truck size={14} /> {submitting ? 'Đang tạo...' : 'Tạo phiếu điều chuyển'}
                                </button>
                            )}

                            {/* Transfer: transferring → complete */}
                            {activeTab === 'transfers' && showDetail.status === 'transferring' && canManage && (
                                <button className="btn btn-primary" onClick={() => handleCompleteTransfer(showDetail)} disabled={submitting}>
                                    <Check size={14} /> {submitting ? 'Đang xử lý...' : 'Hoàn thành (trừ tồn kho)'}
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
