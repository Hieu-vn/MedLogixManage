import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, ROLES } from '../lib/auth'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import PageHeader from '../components/PageHeader'
import {
    Truck, Plus, Eye, MapPin, Star, Upload, AlertTriangle,
    CheckCircle, Clock, Package, Thermometer, Phone
} from 'lucide-react'
import { formatDate, formatCurrency, generateCode, daysBetween, STORAGE_CONDITIONS } from '../lib/helpers'
import { useDeliveries } from '../hooks/useSupabaseQuery'

// ========== Constants ==========
const DELIVERY_STATUS = {
    pending: { label: 'Chờ xuất kho', color: '#FDCB6E', icon: '📦' },
    dispatched: { label: 'Đã xuất kho', color: '#E17055', icon: '📤' },
    delivering: { label: 'Đang giao', color: '#0984E3', icon: '🚚' },
    delivered: { label: 'Đã giao', color: '#6C5CE7', icon: '📬' },
    confirmed: { label: 'BV xác nhận', color: '#00B894', icon: '✅' },
}

const RATING_CRITERIA = [
    { key: 'responsive', label: 'Phản hồi nhanh', desc: 'NVC phản hồi yêu cầu trong thời gian hợp lý' },
    { key: 'on_time', label: 'Giao đúng hẹn', desc: 'Hàng được giao đúng hoặc trước ngày dự kiến' },
    { key: 'no_cancellation', label: 'Không bom hàng', desc: 'NVC không hủy/bỏ đơn đã nhận' },
    { key: 'intact_goods', label: 'Hàng nguyên vẹn', desc: 'Hàng hóa được giao đầy đủ, không hư hại' },
    { key: 'no_extra_fees', label: 'Không phí phát sinh', desc: 'Không phát sinh phí ngoài hợp đồng' },
]

function getRatingBadge(score) {
    if (score == null) return null
    const pct = score * 100
    if (pct >= 80) return { label: '⭐ Xuất sắc', color: '#00B894' }
    if (pct >= 60) return { label: '👍 Tốt', color: '#0984E3' }
    if (pct >= 40) return { label: '⚠️ Trung bình', color: '#FDCB6E' }
    return { label: '🔴 Kém', color: '#D63031' }
}

// ========== MAIN COMPONENT ==========
export default function DeliveryPage() {
    const { profile, isRole } = useAuth()
    const toast = useToast()
    const [showCreate, setShowCreate] = useState(false)
    const [showView, setShowView] = useState(null)
    const [showRate, setShowRate] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')

    // React Query cached data
    const { data: deliveryData, isLoading: loading, refetch } = useDeliveries()
    const deliveries = deliveryData?.deliveries || []
    const completedReceipts = deliveryData?.completedReceipts || []
    const hospitals = deliveryData?.hospitals || []
    const carriers = deliveryData?.carriers || []

    // Filter
    const filteredDeliveries = useMemo(() => {
        if (statusFilter === 'all') return deliveries
        return deliveries.filter(d => d.status === statusFilter)
    }, [deliveries, statusFilter])

    // Overdue detection
    const isOverdue = (d) => {
        if (!d.expected_date || d.status === 'confirmed') return false
        return daysBetween(new Date(), d.expected_date) < 0
    }

    // ========== COLUMNS ==========
    const columns = useMemo(() => [
        {
            key: 'code', label: 'Mã đơn giao', sortable: true,
            render: (val, row) => (
                <span className="code-badge" style={isOverdue(row) ? { borderColor: '#D63031' } : {}}>
                    {val} {isOverdue(row) && '🔴'}
                </span>
            ),
        },
        {
            key: 'hospital_name', label: 'Bệnh viện', sortable: true,
            render: (_, row) => row.hospital?.name || '—',
        },
        {
            key: 'carrier_name', label: 'Nhà vận chuyển', sortable: true,
            render: (_, row) => {
                const carrier = row.carrier
                if (!carrier) return '—'
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{carrier.name}</span>
                        {carrier.has_cold_chain && (
                            <span title="Có xe lạnh" style={{ fontSize: 'var(--font-xs)' }}>❄️</span>
                        )}
                    </div>
                )
            },
        },
        {
            key: 'expected_date', label: 'Ngày dự kiến', sortable: true,
            render: (val, row) => (
                <span style={{ color: isOverdue(row) ? '#D63031' : 'inherit', fontWeight: isOverdue(row) ? 600 : 400 }}>
                    {formatDate(val)} {isOverdue(row) && <AlertTriangle size={12} />}
                </span>
            ),
        },
        {
            key: 'items_count', label: 'Số SP',
            render: (_, row) => row.delivery_items?.length || 0,
        },
        {
            key: 'status', label: 'Trạng thái', sortable: true,
            render: (val) => {
                const cfg = DELIVERY_STATUS[val] || {}
                return (
                    <span className="status-badge" style={{ background: `${cfg.color}20`, color: cfg.color }}>
                        {cfg.icon} {cfg.label}
                    </span>
                )
            },
        },
        {
            key: 'rating', label: 'Đánh giá',
            render: (_, row) => {
                if (!row.carrier_rating) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                const badge = getRatingBadge(row.carrier_rating.score)
                return badge ? <span style={{ color: badge.color, fontWeight: 600, fontSize: 'var(--font-sm)' }}>{badge.label}</span> : '—'
            },
        },
        {
            key: 'actions', label: '',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setShowView(row) }}
                        title="Xem chi tiết">
                        <Eye size={14} />
                    </button>
                    {row.status === 'confirmed' && !row.carrier_rating && isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setShowRate(row) }}
                            title="Chấm điểm NVC" style={{ color: '#FDCB6E' }}>
                            <Star size={14} />
                        </button>
                    )}
                </div>
            ),
        },
    ], [deliveries])

    // ========== CREATE DELIVERY ==========
    function CreateModal({ onClose }) {
        const [selectedReceiptId, setSelectedReceiptId] = useState('')
        const [hospitalId, setHospitalId] = useState('')
        const [carrierId, setCarrierId] = useState('')
        const [expectedDate, setExpectedDate] = useState('')
        const [notes, setNotes] = useState('')
        const [items, setItems] = useState([])
        const [saving, setSaving] = useState(false)
        const [coldChainWarning, setColdChainWarning] = useState(false)

        // Load items from selected receipt
        useEffect(() => {
            if (!selectedReceiptId) { setItems([]); return }
            loadReceiptItems(selectedReceiptId)
        }, [selectedReceiptId])

        // Cold chain check
        useEffect(() => {
            if (!carrierId || items.length === 0) { setColdChainWarning(false); return }
            const selectedCarrier = carriers.find(c => c.id === carrierId)
            const needsColdChain = items.some(i =>
                i.storage_condition === 'cool' || i.storage_condition === 'cold'
            )
            setColdChainWarning(needsColdChain && !selectedCarrier?.has_cold_chain)
        }, [carrierId, items])

        async function loadReceiptItems(receiptId) {
            const { data, error } = await supabase
                .from('receipt_items')
                .select('*, product:products(id, code, name, unit, storage_condition)')
                .eq('receipt_id', receiptId)
            if (data) {
                setItems(data.filter(i => !i.is_quarantine).map(i => ({
                    product_id: i.product_id,
                    product: i.product,
                    lot_number: i.lot_number,
                    quantity: i.actual_quantity,
                    expiry_date: i.expiry_date,
                    storage_condition: i.storage_condition || i.product?.storage_condition || 'normal',
                })))
            }
        }

        async function handleSave() {
            if (!selectedReceiptId) { toast.warning('Chọn phiếu nhập kho nguồn'); return }
            if (!hospitalId) { toast.warning('Chọn bệnh viện nhận hàng'); return }
            if (!carrierId) { toast.warning('Chọn nhà vận chuyển'); return }
            if (!expectedDate) { toast.warning('Nhập ngày giao dự kiến'); return }

            setSaving(true)
            try {
                const code = generateCode('DL')

                const deliveryRecord = {
                    code,
                    warehouse_receipt_id: selectedReceiptId,
                    hospital_id: hospitalId,
                    carrier_id: carrierId,
                    status: 'pending',
                    expected_date: expectedDate,
                    delivery_notes: notes || null,
                    created_by: profile.id,
                }

                const { data, error } = await supabase.from('deliveries').insert(deliveryRecord).select().single()
                if (error) throw error

                // Insert delivery items
                const itemsData = items.map(i => ({
                    delivery_id: data.id,
                    product_id: i.product_id,
                    lot_number: i.lot_number,
                    quantity: i.quantity,
                    expiry_date: i.expiry_date,
                    storage_condition: i.storage_condition,
                }))

                const { error: itemsErr } = await supabase.from('delivery_items').insert(itemsData)
                if (itemsErr) throw itemsErr

                toast.success(`Tạo đơn giao hàng ${code} thành công!`)
                onClose()
                refetch()
            } catch (err) {
                toast.error('Lỗi: ' + err.message)
            } finally {
                setSaving(false)
            }
        }

        return (
            <Modal title="Tạo đơn giao hàng" onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Source & Hospital */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="form-label required">Phiếu nhập kho (nguồn)</label>
                            <select className="form-input" value={selectedReceiptId}
                                onChange={e => setSelectedReceiptId(e.target.value)}>
                                <option value="">-- Chọn PNK đã hoàn thành --</option>
                                {completedReceipts.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.code} — {r.po_direct?.supplier?.name || r.import_shipment?.po?.supplier?.name || 'N/A'}
                                    </option>
                                ))}
                            </select>
                        </div>
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
                    </div>

                    {/* Carrier & Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="form-label required">Nhà vận chuyển</label>
                            <select className="form-input" value={carrierId}
                                onChange={e => setCarrierId(e.target.value)}>
                                <option value="">-- Chọn NVC --</option>
                                {carriers.map(c => {
                                    const badge = c.avg_score != null ? getRatingBadge(c.avg_score) : null
                                    return (
                                        <option key={c.id} value={c.id}>
                                            {c.name} {c.has_cold_chain ? '❄️' : ''} {badge ? `(${badge.label})` : ''}
                                        </option>
                                    )
                                })}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Ngày giao dự kiến</label>
                            <input type="date" className="form-input" value={expectedDate}
                                onChange={e => setExpectedDate(e.target.value)} />
                        </div>
                    </div>

                    {/* Cold chain warning */}
                    {coldChainWarning && (
                        <div style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'rgba(214,48,49,0.08)', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-sm)', color: '#D63031',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <Thermometer size={16} />
                            <span>
                                <strong>⚠️ Cảnh báo GDP:</strong> Đơn có hàng cần bảo quản mát/lạnh nhưng NVC
                                được chọn <strong>không có xe lạnh</strong>. Vui lòng chọn NVC có xe lạnh hoặc
                                bố trí phương tiện phù hợp.
                            </span>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="form-group">
                        <label className="form-label">Ghi chú</label>
                        <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
                            rows={2} placeholder="Ghi chú cho NVC (nếu có)" />
                    </div>

                    {/* Items preview */}
                    {items.length > 0 && (
                        <div>
                            <h4 style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Package size={16} /> Hàng giao ({items.length} sản phẩm)
                            </h4>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                                    <thead>
                                        <tr>
                                            <th>#</th><th>Mã SP</th><th>Tên sản phẩm</th>
                                            <th>Lot</th><th>HSD</th><th>SL</th><th>Bảo quản</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => {
                                            const sc = STORAGE_CONDITIONS[item.storage_condition] || {}
                                            return (
                                                <tr key={idx}>
                                                    <td>{idx + 1}</td>
                                                    <td><span className="code-badge">{item.product?.code}</span></td>
                                                    <td>{item.product?.name}</td>
                                                    <td>{item.lot_number}</td>
                                                    <td>{formatDate(item.expiry_date)}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
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
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleSave}
                            disabled={saving || items.length === 0}>
                            <Truck size={16} /> {saving ? 'Đang lưu...' : 'Tạo đơn giao hàng'}
                        </button>
                    </div>
                </div>
            </Modal>
        )
    }

    // ========== VIEW DELIVERY ==========
    function ViewModal({ delivery, onClose }) {
        const [uploading, setUploading] = useState(false)
        const stCfg = DELIVERY_STATUS[delivery.status] || {}

        async function handleStatusUpdate(newStatus) {
            const updates = { status: newStatus, updated_at: new Date().toISOString() }
            if (newStatus === 'delivered') {
                updates.actual_date = new Date().toISOString().split('T')[0]
            }

            const { error } = await supabase.from('deliveries').update(updates).eq('id', delivery.id)
            if (error) { toast.error(error.message); return }

            toast.success(`Cập nhật trạng thái: ${DELIVERY_STATUS[newStatus]?.label}`)
            onClose()
            refetch()
        }

        async function handleUploadProof(e) {
            const file = e.target.files?.[0]
            if (!file) return

            setUploading(true)
            try {
                const ext = file.name.split('.').pop()
                const filePath = `deliveries/${delivery.id}/proof_${Date.now()}.${ext}`

                const { error: uploadErr } = await supabase.storage
                    .from('documents')
                    .upload(filePath, file)
                if (uploadErr) throw uploadErr

                const { data: { publicUrl } } = supabase.storage
                    .from('documents')
                    .getPublicUrl(filePath)

                await supabase.from('deliveries').update({
                    proof_file_url: publicUrl,
                    updated_at: new Date().toISOString(),
                }).eq('id', delivery.id)

                toast.success('Upload biên bản giao nhận thành công!')
                refetch()
            } catch (err) {
                toast.error('Lỗi upload: ' + err.message)
            } finally {
                setUploading(false)
            }
        }

        const overdue = isOverdue(delivery)

        return (
            <Modal title={`Đơn giao hàng: ${delivery.code}`} onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Overdue warning */}
                    {overdue && (
                        <div style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'rgba(214,48,49,0.08)', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-sm)', color: '#D63031',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <AlertTriangle size={16} />
                            <strong>ĐƠN TRỄ HẠN!</strong> Quá ngày giao dự kiến {Math.abs(daysBetween(new Date(), delivery.expected_date))} ngày.
                        </div>
                    )}

                    {/* Header info grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Trạng thái</div>
                            <span className="status-badge" style={{ background: `${stCfg.color}20`, color: stCfg.color }}>
                                {stCfg.icon} {stCfg.label}
                            </span>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Bệnh viện</div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                                {delivery.hospital?.name || '—'}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Nhà vận chuyển</div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {delivery.carrier?.name || '—'}
                                {delivery.carrier?.has_cold_chain && <span title="Xe lạnh">❄️</span>}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Ngày dự kiến</div>
                            <div style={{ color: overdue ? '#D63031' : 'inherit', fontWeight: overdue ? 600 : 400 }}>
                                {formatDate(delivery.expected_date)}
                            </div>
                        </div>
                    </div>

                    {/* Second info row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Nguồn PNK</div>
                            <div>
                                <span className="code-badge">
                                    {delivery.warehouse_receipt?.code || '—'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Ngày giao thực tế</div>
                            <div>{formatDate(delivery.actual_date) || '—'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Người tạo</div>
                            <div>{delivery.created_by_profile?.full_name || '—'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Biên bản giao nhận</div>
                            {delivery.proof_file_url ? (
                                <a href={delivery.proof_file_url} target="_blank" rel="noopener noreferrer"
                                    style={{ color: 'var(--primary-400)', fontSize: 'var(--font-sm)' }}>
                                    📎 Xem file
                                </a>
                            ) : (
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>Chưa upload</span>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    {delivery.delivery_notes && (
                        <div style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-sm)',
                        }}>
                            <strong>Ghi chú:</strong> {delivery.delivery_notes}
                        </div>
                    )}

                    {/* Delivery items */}
                    <div>
                        <h4 style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Package size={16} /> Hàng giao ({delivery.delivery_items?.length || 0} sản phẩm)
                        </h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ fontSize: 'var(--font-xs)' }}>
                                <thead>
                                    <tr>
                                        <th>#</th><th>Mã SP</th><th>Tên sản phẩm</th>
                                        <th>Lot</th><th>HSD</th><th>SL giao</th><th>Bảo quản</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {delivery.delivery_items?.map((item, idx) => {
                                        const sc = STORAGE_CONDITIONS[item.storage_condition] || {}
                                        return (
                                            <tr key={item.id || idx}>
                                                <td>{idx + 1}</td>
                                                <td><span className="code-badge">{item.product?.code}</span></td>
                                                <td>{item.product?.name}</td>
                                                <td>{item.lot_number}</td>
                                                <td>{formatDate(item.expiry_date)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
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
                    </div>

                    {/* Carrier rating display */}
                    {delivery.carrier_rating && (
                        <div style={{
                            padding: 'var(--space-3)',
                            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                        }}>
                            <h4 style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Star size={16} style={{ color: '#FDCB6E' }} /> Đánh giá NVC
                            </h4>
                            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: 'var(--font-sm)' }}>
                                {RATING_CRITERIA.map(c => (
                                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {delivery.carrier_rating[c.key]
                                            ? <CheckCircle size={14} style={{ color: '#00B894' }} />
                                            : <span style={{ color: '#D63031' }}>❌</span>
                                        }
                                        <span>{c.label}</span>
                                    </div>
                                ))}
                            </div>
                            {(() => {
                                const badge = getRatingBadge(delivery.carrier_rating.score)
                                return badge && (
                                    <div style={{ marginTop: 'var(--space-2)', fontWeight: 700, color: badge.color }}>
                                        Tổng điểm: {(delivery.carrier_rating.score * 100).toFixed(0)}% — {badge.label}
                                    </div>
                                )
                            })()}
                        </div>
                    )}

                    {/* Action buttons */}
                    {isRole(ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.ADMIN) && (
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: 'var(--space-2)',
                            padding: 'var(--space-3)', background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)', flexWrap: 'wrap',
                        }}>
                            {delivery.status === 'pending' && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate('dispatched')}>
                                    📤 Xuất kho
                                </button>
                            )}
                            {delivery.status === 'dispatched' && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate('delivering')}>
                                    🚚 NVC đã nhận hàng
                                </button>
                            )}
                            {delivery.status === 'delivering' && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate('delivered')}>
                                    📬 Đã giao cho BV
                                </button>
                            )}
                            {delivery.status === 'delivered' && (
                                <button className="btn btn-primary" onClick={() => handleStatusUpdate('confirmed')}>
                                    ✅ BV xác nhận nhận hàng
                                </button>
                            )}

                            {/* Upload proof */}
                            {['delivering', 'delivered', 'confirmed'].includes(delivery.status) && (
                                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                                    <Upload size={14} /> {uploading ? 'Đang upload...' : 'Upload biên bản'}
                                    <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={handleUploadProof} disabled={uploading} />
                                </label>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        )
    }

    // ========== RATE CARRIER ==========
    function RateModal({ delivery, onClose }) {
        const [ratings, setRatings] = useState({
            responsive: false, on_time: false, no_cancellation: false,
            intact_goods: false, no_extra_fees: false,
        })
        const [rateNotes, setRateNotes] = useState('')
        const [saving, setSaving] = useState(false)

        const score = Object.values(ratings).filter(Boolean).length / 5

        async function handleSubmit() {
            setSaving(true)
            try {
                const ratingRecord = {
                    delivery_id: delivery.id,
                    carrier_id: delivery.carrier_id,
                    ...ratings,
                    score,
                    notes: rateNotes || null,
                    rated_by: profile.id,
                }

                const { error } = await supabase.from('carrier_ratings').insert(ratingRecord)
                if (error) throw error

                // Update carrier avg_score
                const { data: allRatings } = await supabase
                    .from('carrier_ratings')
                    .select('score')
                    .eq('carrier_id', delivery.carrier_id)

                if (allRatings && allRatings.length > 0) {
                    const avgScore = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length
                    await supabase.from('carriers').update({ avg_score: avgScore }).eq('id', delivery.carrier_id)
                }

                toast.success('Đã chấm điểm NVC thành công!')
                onClose()
                refetch()
            } catch (err) {
                toast.error('Lỗi: ' + err.message)
            } finally {
                setSaving(false)
            }
        }

        const badge = getRatingBadge(score)

        return (
            <Modal title={`Chấm điểm NVC: ${delivery.carrier?.name}`} onClose={onClose} size="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{
                        textAlign: 'center', padding: 'var(--space-3)',
                        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                    }}>
                        <div style={{ fontSize: '2rem' }}>
                            {score === 1 ? '⭐' : score >= 0.8 ? '😊' : score >= 0.6 ? '👍' : score >= 0.4 ? '😐' : '😞'}
                        </div>
                        <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--font-lg)', fontWeight: 700, color: badge?.color }}>
                            {(score * 100).toFixed(0)}% — {badge?.label || 'Chưa đánh giá'}
                        </div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                            Đơn: {delivery.code} → {delivery.hospital?.name}
                        </div>
                    </div>

                    {/* Rating criteria */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {RATING_CRITERIA.map(c => (
                            <label key={c.key} style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                padding: 'var(--space-2) var(--space-3)',
                                background: ratings[c.key] ? 'rgba(0,184,148,0.06)' : 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                border: `1px solid ${ratings[c.key] ? '#00B894' : 'transparent'}`,
                                transition: 'background 0.15s, border-color 0.15s',
                            }}>
                                <input type="checkbox" checked={ratings[c.key]}
                                    onChange={e => setRatings(prev => ({ ...prev, [c.key]: e.target.checked }))}
                                    style={{ accentColor: '#00B894', width: 18, height: 18 }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{c.label}</div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{c.desc}</div>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Ghi chú đánh giá</label>
                        <textarea className="form-input" value={rateNotes} onChange={e => setRateNotes(e.target.value)}
                            rows={2} placeholder="Nhận xét thêm (tùy chọn)" />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                            <Star size={16} /> {saving ? 'Đang lưu...' : 'Gửi đánh giá'}
                        </button>
                    </div>
                </div>
            </Modal>
        )
    }

    // ========== STATS ==========
    const stats = useMemo(() => {
        const pending = deliveries.filter(d => d.status === 'pending').length
        const inTransit = deliveries.filter(d => ['dispatched', 'delivering'].includes(d.status)).length
        const overdue = deliveries.filter(d => isOverdue(d)).length
        const completed = deliveries.filter(d => d.status === 'confirmed').length
        return { pending, inTransit, overdue, completed }
    }, [deliveries])

    // ========== RENDER ==========
    return (
        <div>
            <PageHeader
                title="Vận chuyển & Giao hàng"
                subtitle="Quản lý đơn giao, theo dõi trạng thái, chấm điểm NVC"
                icon={<Truck size={20} />}
                actions={isRole(ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.ADMIN) && (
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> Tạo đơn giao
                    </button>
                )}
            />

            {/* Stats cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
            }}>
                {[
                    { label: 'Chờ xuất kho', value: stats.pending, color: '#FDCB6E', icon: '📦' },
                    { label: 'Đang vận chuyển', value: stats.inTransit, color: '#0984E3', icon: '🚚' },
                    { label: 'Trễ hạn', value: stats.overdue, color: '#D63031', icon: '⚠️' },
                    { label: 'Hoàn thành', value: stats.completed, color: '#00B894', icon: '✅' },
                ].map((s, i) => (
                    <div key={i} className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div style={{
                display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)',
                flexWrap: 'wrap',
            }}>
                <button
                    className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setStatusFilter('all')}
                >
                    Tất cả ({deliveries.length})
                </button>
                {Object.entries(DELIVERY_STATUS).map(([key, cfg]) => {
                    const count = deliveries.filter(d => d.status === key).length
                    return (
                        <button key={key}
                            className={`btn btn-sm ${statusFilter === key ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setStatusFilter(key)}
                        >
                            {cfg.icon} {cfg.label} ({count})
                        </button>
                    )
                })}
            </div>

            {/* Data table */}
            <DataTable
                columns={columns}
                data={filteredDeliveries}
                loading={loading}
                searchPlaceholder="Tìm theo mã đơn, bệnh viện, NVC..."
                searchKeys={['code']}
                emptyMessage="Chưa có đơn giao hàng"
                emptyIcon={<Truck size={40} style={{ color: 'var(--text-tertiary)' }} />}
                exportable
                exportFilename="delivery_orders"
                onRowClick={(row) => setShowView(row)}
            />

            {/* Modals */}
            {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
            {showView && <ViewModal delivery={showView} onClose={() => setShowView(null)} />}
            {showRate && <RateModal delivery={showRate} onClose={() => setShowRate(null)} />}
        </div>
    )
}
