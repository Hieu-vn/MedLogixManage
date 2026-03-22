import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, ROLES } from '../lib/auth'
import { useToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import {
    Plus, Eye, Check, Package, Upload, Download,
    AlertTriangle, CheckCircle, XCircle, LogOut as LogOutIcon
} from 'lucide-react'
import { formatDate, generateCode, STORAGE_CONDITIONS } from '../lib/helpers'
import { useStockExports } from '../hooks/useSupabaseQuery'
import { useExport } from '../hooks/useExport'

const STATUS_CONFIG = {
    draft: { label: 'Nháp', color: '#636E72', icon: '📝' },
    pending: { label: 'Chờ duyệt', color: '#FDCB6E', icon: '⏳' },
    approved: { label: 'Đã duyệt', color: '#0984E3', icon: '✅' },
    completed: { label: 'Đã xuất kho', color: '#00B894', icon: '📤' },
    rejected: { label: 'Từ chối', color: '#D63031', icon: '❌' },
}

export default function StockExportPage() {
    const { profile, isRole } = useAuth()
    const toast = useToast()
    const [showCreate, setShowCreate] = useState(false)
    const [showView, setShowView] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const { exportExcel, exportPDF } = useExport()

    const { data: exportData, isLoading: loading, refetch } = useStockExports()
    const exports = exportData?.exports || []
    const hospitals = exportData?.hospitals || []

    const filteredExports = useMemo(() => {
        if (statusFilter === 'all') return exports
        return exports.filter(e => e.status === statusFilter)
    }, [exports, statusFilter])

    // Stats
    const stats = useMemo(() => ({
        draft: exports.filter(e => e.status === 'draft').length,
        pending: exports.filter(e => e.status === 'pending').length,
        completed: exports.filter(e => e.status === 'completed').length,
        total: exports.length,
    }), [exports])

    // Export columns
    const exportColumns = [
        { key: 'code', label: 'Mã PXK' },
        { key: 'hospital', label: 'Bệnh viện', exportRender: (_, r) => r.hospital?.name || '—' },
        { key: 'export_date', label: 'Ngày xuất', exportRender: v => v ? new Date(v).toLocaleDateString('vi-VN') : '—' },
        { key: 'items_count', label: 'Số SP', exportRender: (_, r) => r.stock_export_items?.length || 0 },
        { key: 'status', label: 'Trạng thái', exportRender: v => STATUS_CONFIG[v]?.label || v },
    ]

    // ========== CREATE EXPORT ==========
    function CreateModal({ onClose }) {
        const [hospitalId, setHospitalId] = useState('')
        const [notes, setNotes] = useState('')
        const [items, setItems] = useState([])
        const [saving, setSaving] = useState(false)
        const [availableLots, setAvailableLots] = useState([])
        const [loadingLots, setLoadingLots] = useState(true)

        useEffect(() => {
            fetchAvailableLots()
        }, [])

        async function fetchAvailableLots() {
            setLoadingLots(true)
            const { data, error } = await supabase
                .from('inventory_lots')
                .select('*, product:products(id, code, name, unit, manufacturer, packaging, storage_condition)')
                .eq('status', 'available')
                .gt('quantity', 0)
                .order('expiry_date', { ascending: true })
            if (data) setAvailableLots(data)
            setLoadingLots(false)
        }

        function addItem() {
            setItems(prev => [...prev, {
                inventory_lot_id: '',
                product_id: '',
                lot_number: '',
                expiry_date: '',
                quantity: 1,
                max_quantity: 0,
                unit: '',
                storage_condition: 'normal',
                product: null,
            }])
        }

        function selectLot(idx, lotId) {
            const lot = availableLots.find(l => l.id === lotId)
            if (!lot) return
            setItems(prev => prev.map((item, i) => i === idx ? {
                ...item,
                inventory_lot_id: lotId,
                product_id: lot.product_id,
                lot_number: lot.lot_number,
                expiry_date: lot.expiry_date,
                quantity: 1,
                max_quantity: lot.quantity,
                unit: lot.product?.unit || '',
                storage_condition: lot.storage_condition || 'normal',
                product: lot.product,
            } : item))
        }

        function updateItemQty(idx, qty) {
            setItems(prev => prev.map((item, i) =>
                i === idx ? { ...item, quantity: Math.min(Math.max(1, parseInt(qty) || 0), item.max_quantity) } : item
            ))
        }

        function removeItem(idx) {
            setItems(prev => prev.filter((_, i) => i !== idx))
        }

        async function handleSave(submitForApproval = false) {
            if (!hospitalId) { toast.warning('Chọn bệnh viện nhận hàng'); return }
            if (items.length === 0) { toast.warning('Thêm ít nhất 1 sản phẩm'); return }
            if (items.some(i => !i.inventory_lot_id)) { toast.warning('Chọn lot cho tất cả sản phẩm'); return }
            if (items.some(i => i.quantity < 1)) { toast.warning('Số lượng phải ≥ 1'); return }

            setSaving(true)
            try {
                const code = generateCode('PXK')
                const { data, error } = await supabase.from('stock_exports').insert({
                    code,
                    hospital_id: hospitalId,
                    export_date: new Date().toISOString().split('T')[0],
                    status: submitForApproval ? 'pending' : 'draft',
                    requested_by: profile.id,
                    created_by: profile.id,
                    notes: notes || null,
                }).select().single()
                if (error) throw error

                const itemsData = items.map(i => ({
                    export_id: data.id,
                    product_id: i.product_id,
                    inventory_lot_id: i.inventory_lot_id,
                    lot_number: i.lot_number,
                    expiry_date: i.expiry_date,
                    quantity: i.quantity,
                    unit: i.unit,
                    storage_condition: i.storage_condition,
                }))
                const { error: itemsErr } = await supabase.from('stock_export_items').insert(itemsData)
                if (itemsErr) throw itemsErr

                toast.success(`Tạo phiếu xuất kho ${code} thành công!`)
                onClose()
                refetch()
            } catch (err) {
                toast.error('Lỗi: ' + err.message)
            } finally {
                setSaving(false)
            }
        }

        return (
            <Modal title="Tạo phiếu xuất kho (PXK)" onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Hospital + Notes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="form-label required">Bệnh viện nhận hàng</label>
                            <select className="form-input" value={hospitalId}
                                onChange={e => setHospitalId(e.target.value)}>
                                <option value="">-- Chọn bệnh viện --</option>
                                {hospitals.map(h => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ghi chú</label>
                            <input className="form-input" value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Ghi chú thêm (tùy chọn)" />
                        </div>
                    </div>

                    {/* Items */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                            <h4><Package size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                Sản phẩm xuất kho ({items.length})
                            </h4>
                            <button className="btn btn-success btn-sm" onClick={addItem}>
                                <Plus size={14} /> Thêm dòng
                            </button>
                        </div>

                        {items.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: 'var(--space-6)',
                                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                                color: 'var(--text-tertiary)',
                            }}>
                                Chưa có sản phẩm. Click "Thêm dòng" để chọn từ tồn kho.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                                    <thead>
                                        <tr>
                                            <th>#</th><th>Chọn Lot (SP + Lot)</th><th>Tên SP</th>
                                            <th>Lot</th><th>HSD</th><th>Tồn kho</th><th>SL xuất</th>
                                            <th>BQ</th><th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => {
                                            const sc = STORAGE_CONDITIONS[item.storage_condition] || {}
                                            return (
                                                <tr key={idx}>
                                                    <td>{idx + 1}</td>
                                                    <td>
                                                        <select className="form-input" value={item.inventory_lot_id}
                                                            onChange={e => selectLot(idx, e.target.value)}
                                                            style={{ minWidth: 200, fontSize: 'var(--font-xs)' }}>
                                                            <option value="">-- Chọn lot --</option>
                                                            {availableLots.map(lot => (
                                                                <option key={lot.id} value={lot.id}>
                                                                    {lot.product?.code} — {lot.lot_number} (tồn: {lot.quantity})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>{item.product?.name || '—'}</td>
                                                    <td style={{ fontFamily: 'monospace' }}>{item.lot_number || '—'}</td>
                                                    <td>{formatDate(item.expiry_date)}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>
                                                        {item.max_quantity || '—'}
                                                    </td>
                                                    <td>
                                                        <input type="number" className="form-input"
                                                            value={item.quantity}
                                                            onChange={e => updateItemQty(idx, e.target.value)}
                                                            min={1} max={item.max_quantity}
                                                            style={{ width: 70, textAlign: 'right' }} />
                                                    </td>
                                                    <td>
                                                        <span style={{ color: sc.color, fontSize: 'var(--font-xs)' }}>
                                                            {sc.icon}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button className="btn btn-ghost btn-sm"
                                                            onClick={() => removeItem(idx)}
                                                            style={{ color: 'var(--red-400)' }}>
                                                            <XCircle size={14} />
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

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
                        <button className="btn btn-ghost" onClick={() => handleSave(false)}
                            disabled={saving || items.length === 0}>
                            📝 Lưu nháp
                        </button>
                        <button className="btn btn-primary" onClick={() => handleSave(true)}
                            disabled={saving || items.length === 0}>
                            <Upload size={16} /> {saving ? 'Đang lưu...' : 'Gửi duyệt'}
                        </button>
                    </div>
                </div>
            </Modal>
        )
    }

    // ========== VIEW EXPORT ==========
    function ViewModal({ stockExport, onClose }) {
        const stCfg = STATUS_CONFIG[stockExport.status] || {}

        async function handleApprove() {
            const { error } = await supabase.from('stock_exports').update({
                status: 'approved',
                approved_by: profile.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', stockExport.id)
            if (error) { toast.error(error.message); return }
            toast.success('Đã duyệt phiếu xuất kho!')
            onClose(); refetch()
        }

        async function handleReject() {
            const reason = prompt('Lý do từ chối:')
            if (!reason) return
            const { error } = await supabase.from('stock_exports').update({
                status: 'rejected',
                rejection_reason: reason,
                approved_by: profile.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', stockExport.id)
            if (error) { toast.error(error.message); return }
            toast.success('Đã từ chối phiếu xuất kho')
            onClose(); refetch()
        }

        async function handleSubmit() {
            const { error } = await supabase.from('stock_exports').update({
                status: 'pending',
                updated_at: new Date().toISOString(),
            }).eq('id', stockExport.id)
            if (error) { toast.error(error.message); return }
            toast.success('Đã gửi phiếu xuất kho để duyệt!')
            onClose(); refetch()
        }

        async function handleComplete() {
            // Deduct inventory_lots
            try {
                for (const item of (stockExport.stock_export_items || [])) {
                    if (!item.inventory_lot_id) continue
                    const { data: lot } = await supabase
                        .from('inventory_lots')
                        .select('id, quantity')
                        .eq('id', item.inventory_lot_id)
                        .single()
                    if (lot) {
                        const newQty = Math.max(0, lot.quantity - item.quantity)
                        await supabase.from('inventory_lots').update({
                            quantity: newQty,
                        }).eq('id', lot.id)
                    }
                }

                const { error } = await supabase.from('stock_exports').update({
                    status: 'completed',
                    updated_at: new Date().toISOString(),
                }).eq('id', stockExport.id)
                if (error) throw error

                toast.success('Đã xuất kho + trừ tồn kho thành công!')
                onClose(); refetch()
            } catch (err) {
                toast.error('Lỗi: ' + err.message)
            }
        }

        return (
            <Modal title={`Phiếu xuất kho: ${stockExport.code}`} onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Header info */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Trạng thái</div>
                            <span className="status-badge" style={{ background: `${stCfg.color}20`, color: stCfg.color }}>
                                {stCfg.icon} {stCfg.label}
                            </span>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Bệnh viện</div>
                            <div style={{ fontWeight: 600 }}>{stockExport.hospital?.name || '—'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Ngày xuất</div>
                            <div>{formatDate(stockExport.export_date)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Người yêu cầu</div>
                            <div>{stockExport.requested_by_profile?.full_name || '—'}</div>
                        </div>
                    </div>

                    {stockExport.rejection_reason && (
                        <div style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'rgba(214,48,49,0.08)', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-sm)', color: '#D63031',
                        }}>
                            <strong>Lý do từ chối:</strong> {stockExport.rejection_reason}
                        </div>
                    )}

                    {stockExport.notes && (
                        <div style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-sm)',
                        }}>
                            <strong>Ghi chú:</strong> {stockExport.notes}
                        </div>
                    )}

                    {/* Items table */}
                    <div>
                        <h4 style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Package size={16} /> Sản phẩm xuất ({stockExport.stock_export_items?.length || 0})
                        </h4>
                        <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                            <thead>
                                <tr>
                                    <th>#</th><th>Mã SP</th><th>Tên SP</th><th>Hãng SX</th>
                                    <th>Lot</th><th>HSD</th><th>SL xuất</th><th>ĐVT</th><th>BQ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockExport.stock_export_items?.map((item, idx) => {
                                    const sc = STORAGE_CONDITIONS[item.storage_condition] || {}
                                    return (
                                        <tr key={item.id}>
                                            <td>{idx + 1}</td>
                                            <td><span className="code-badge">{item.product?.code}</span></td>
                                            <td>{item.product?.name}</td>
                                            <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                                                {item.product?.manufacturer || '—'}
                                            </td>
                                            <td style={{ fontFamily: 'monospace' }}>{item.lot_number}</td>
                                            <td>{formatDate(item.expiry_date)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity}</td>
                                            <td>{item.unit || item.product?.unit || '—'}</td>
                                            <td>
                                                <span style={{ color: sc.color, fontSize: 'var(--font-xs)' }}>
                                                    {sc.icon} {sc.label}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Action buttons */}
                    {isRole(ROLES.WAREHOUSE_KEEPER, ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: 'var(--space-2)',
                            padding: 'var(--space-3)', background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                        }}>
                            {stockExport.status === 'draft' && (
                                <button className="btn btn-primary btn-sm" onClick={handleSubmit}>
                                    <Upload size={14} /> Gửi duyệt
                                </button>
                            )}
                            {stockExport.status === 'pending' && isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                                <>
                                    <button className="btn btn-primary btn-sm" onClick={handleApprove}>
                                        <CheckCircle size={14} /> Duyệt
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={handleReject}>
                                        <XCircle size={14} /> Từ chối
                                    </button>
                                </>
                            )}
                            {stockExport.status === 'approved' && (
                                <button className="btn btn-primary" onClick={handleComplete}>
                                    📤 Xuất kho + Trừ tồn kho
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        )
    }

    return (
        <div>
            <PageHeader
                title="Xuất kho"
                subtitle="Tạo phiếu xuất kho, duyệt, trừ tồn kho"
                icon={<LogOutIcon size={20} />}
                actions={
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {isRole(ROLES.WAREHOUSE_KEEPER, ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                                <Plus size={16} /> Tạo phiếu xuất kho
                            </button>
                        )}
                        <button className="btn btn-ghost" onClick={() => exportExcel(exportColumns, filteredExports, 'xuat_kho', 'Xuất Kho')}>
                            <Download size={14} /> Excel
                        </button>
                        <button className="btn btn-ghost" onClick={() => exportPDF(exportColumns, filteredExports, 'Danh sách Phiếu Xuất Kho', 'xuat_kho')}>
                            <Download size={14} /> PDF
                        </button>
                    </div>
                }
            />

            {/* Stats */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
            }}>
                {[
                    { label: 'Tổng phiếu', value: stats.total, color: '#6C5CE7', icon: '📋' },
                    { label: 'Nháp', value: stats.draft, color: '#636E72', icon: '📝' },
                    { label: 'Chờ duyệt', value: stats.pending, color: '#FDCB6E', icon: '⏳' },
                    { label: 'Đã xuất', value: stats.completed, color: '#00B894', icon: '📤' },
                ].map((s, i) => (
                    <div key={i} className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                {[
                    { key: 'all', label: `Tất cả (${exports.length})` },
                    ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
                        key,
                        label: `${cfg.icon} ${cfg.label} (${exports.filter(e => e.status === key).length})`,
                    })),
                ].map(f => (
                    <button key={f.key}
                        className={`btn btn-sm ${statusFilter === f.key ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setStatusFilter(f.key)}
                    >{f.label}</button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : filteredExports.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
                    <LogOutIcon size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }} />
                    <h3>Chưa có phiếu xuất kho</h3>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                        Tạo phiếu xuất kho để giao hàng cho bệnh viện
                    </p>
                </div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Mã PXK</th><th>Bệnh viện</th><th>Ngày xuất</th>
                                <th>Số SP</th><th>Người YC</th><th>Trạng thái</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExports.map(se => {
                                const stCfg = STATUS_CONFIG[se.status] || {}
                                return (
                                    <tr key={se.id}>
                                        <td><span className="code-badge">{se.code}</span></td>
                                        <td>{se.hospital?.name || '—'}</td>
                                        <td>{formatDate(se.export_date)}</td>
                                        <td style={{ textAlign: 'center' }}>{se.stock_export_items?.length || 0}</td>
                                        <td>{se.requested_by_profile?.full_name || '—'}</td>
                                        <td>
                                            <span className="status-badge" style={{
                                                background: `${stCfg.color}20`, color: stCfg.color,
                                            }}>
                                                {stCfg.icon} {stCfg.label}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setShowView(se)}>
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

            {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
            {showView && <ViewModal stockExport={showView} onClose={() => setShowView(null)} />}
        </div>
    )
}
