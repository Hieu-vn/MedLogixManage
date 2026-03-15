import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, ROLES } from '../lib/auth'
import { useToast } from '../components/Toast'
import CrossVerificationPanel from '../components/CrossVerificationPanel'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import {
    Plus, Eye, Edit2, Check, Package, AlertTriangle,
    Warehouse, CheckCircle, XCircle, FileText, ArrowDown, ShieldAlert
} from 'lucide-react'
import { formatDate, formatCurrency } from '../lib/helpers'
import { useWarehouseReceipts } from '../hooks/useSupabaseQuery'

const STATUS_CONFIG = {
    pending: { label: 'Chờ kiểm tra', color: '#FDCB6E' },
    inspecting: { label: 'Đang kiểm', color: '#0984E3' },
    verified: { label: 'Đã xác nhận', color: '#6C5CE7' },
    completed: { label: 'Đã nhập kho', color: '#00B894' },
    quarantine: { label: 'Biệt trữ', color: '#D63031' },
}

export default function WarehouseReceiptPage() {
    const { profile, isRole } = useAuth()
    const toast = useToast()
    const [showCreate, setShowCreate] = useState(false)
    const [showView, setShowView] = useState(null)

    // React Query: cached receipt data
    const { data: receiptData, isLoading: loading, refetch: fetchAll } = useWarehouseReceipts()
    const receipts = receiptData?.receipts || []
    const shipments = receiptData?.completedShipments || []
    const pos = receiptData?.availablePOs || []

    // ========== CREATE RECEIPT ==========
    function CreateModal({ onClose }) {
        const [sourceType, setSourceType] = useState('po') // 'po' or 'shipment'
        const [selectedId, setSelectedId] = useState('')
        const [items, setItems] = useState([])
        const [saving, setSaving] = useState(false)

        // When source changes, populate items from PO
        useEffect(() => {
            if (!selectedId) { setItems([]); return }
            if (sourceType === 'po') {
                const po = pos.find(p => p.id === selectedId)
                if (po?.po_items) {
                    setItems(po.po_items.map(i => ({
                        product_id: i.product_id,
                        product: i.product,
                        lot_number: i.lot_number || '',
                        expiry_date: i.expiry_date || '',
                        registration_number: '',
                        unit: i.product?.unit || '',
                        po_quantity: i.quantity,
                        actual_quantity: i.quantity,
                        discrepancy: 0,
                        unit_cost: parseFloat(i.unit_price) || 0,
                        storage_location: '',
                        storage_condition: i.product?.storage_condition || 'normal',
                        is_quarantine: false,
                        quarantine_reason: '',
                    })))
                }
            } else {
                const sh = shipments.find(s => s.id === selectedId)
                if (sh?.po_id) {
                    const po = pos.find(p => p.id === sh.po_id)
                    if (po?.po_items) {
                        setItems(po.po_items.map(i => ({
                            product_id: i.product_id,
                            product: i.product,
                            lot_number: i.lot_number || '',
                            expiry_date: i.expiry_date || '',
                            registration_number: '',
                            unit: i.product?.unit || '',
                            po_quantity: i.quantity,
                            actual_quantity: i.quantity,
                            discrepancy: 0,
                            unit_cost: parseFloat(i.unit_price) || 0,
                            storage_location: '',
                            storage_condition: i.product?.storage_condition || 'normal',
                            is_quarantine: false,
                            quarantine_reason: '',
                        })))
                    }
                }
            }
        }, [selectedId, sourceType])

        function updateItem(idx, field, value) {
            setItems(prev => {
                const next = [...prev]
                next[idx] = { ...next[idx], [field]: value }
                if (field === 'actual_quantity') {
                    next[idx].discrepancy = next[idx].po_quantity - (parseInt(value) || 0)
                }
                next[idx].line_total = (parseInt(next[idx].actual_quantity) || 0) * next[idx].unit_cost
                return next
            })
        }

        async function handleSave() {
            if (!selectedId) { toast.warning('Chọn nguồn nhập kho'); return }
            if (items.some(i => !i.lot_number)) { toast.warning('Nhập Lot No. cho tất cả SP'); return }
            if (items.some(i => !i.expiry_date)) { toast.warning('Nhập HSD cho tất cả SP'); return }

            setSaving(true)
            try {
                const year = new Date().getFullYear()
                const { count } = await supabase.from('warehouse_receipts').select('*', { count: 'exact', head: true })
                const code = `PNK-${year}-${String((count || 0) + 1).padStart(4, '0')}`

                const receiptData = {
                    code,
                    import_shipment_id: sourceType === 'shipment' ? selectedId : null,
                    po_id: sourceType === 'po' ? selectedId : shipments.find(s => s.id === selectedId)?.po_id,
                    receipt_date: new Date().toISOString().split('T')[0],
                    received_by: profile.id,
                    status: 'pending',
                    created_by: profile.id,
                }

                const { data, error } = await supabase.from('warehouse_receipts').insert(receiptData).select().single()
                if (error) throw error

                const itemsData = items.map(i => ({
                    receipt_id: data.id,
                    product_id: i.product_id,
                    lot_number: i.lot_number,
                    expiry_date: i.expiry_date,
                    registration_number: i.registration_number || null,
                    unit: i.unit,
                    po_quantity: i.po_quantity,
                    actual_quantity: parseInt(i.actual_quantity) || 0,
                    discrepancy: i.po_quantity - (parseInt(i.actual_quantity) || 0),
                    unit_cost: i.unit_cost,
                    line_total: (parseInt(i.actual_quantity) || 0) * i.unit_cost,
                    storage_location: i.storage_location || null,
                    storage_condition: i.storage_condition,
                    is_quarantine: i.is_quarantine,
                    quarantine_reason: i.quarantine_reason || null,
                }))
                const { error: itemsErr } = await supabase.from('receipt_items').insert(itemsData)
                if (itemsErr) throw itemsErr

                toast.success('Tạo phiếu nhập kho thành công!')
                onClose(); fetchAll()
            } catch (err) { toast.error('Lỗi: ' + err.message) }
            finally { setSaving(false) }
        }

        return (
            <Modal title="Tạo phiếu nhập kho" onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Source selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="form-label">Nguồn</label>
                            <select className="form-input" value={sourceType}
                                onChange={e => { setSourceType(e.target.value); setSelectedId('') }}>
                                <option value="po">Từ PO (nội địa)</option>
                                <option value="shipment">Từ lô Nhập khẩu</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label required">{sourceType === 'po' ? 'Chọn PO' : 'Chọn lô NK'}</label>
                            <select className="form-input" value={selectedId}
                                onChange={e => setSelectedId(e.target.value)}>
                                <option value="">-- Chọn --</option>
                                {sourceType === 'po'
                                    ? pos.filter(p => p.is_domestic).map(p => (
                                        <option key={p.id} value={p.id}>{p.code} — {p.supplier?.name}</option>
                                    ))
                                    : shipments.map(s => (
                                        <option key={s.id} value={s.id}>{s.code} — {s.po?.code}</option>
                                    ))
                                }
                            </select>
                        </div>
                    </div>

                    {/* Items entry */}
                    {items.length > 0 && (
                        <div>
                            <h4 style={{ marginBottom: 'var(--space-2)' }}>Chi tiết nhập kho — Kiểm đếm thực tế</h4>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                                    <thead>
                                        <tr>
                                            <th>#</th><th>Code</th><th>Sản phẩm</th>
                                            <th>Lot No.</th><th>HSD</th>
                                            <th>SL PO</th><th>SL thực</th><th>Chênh lệch</th>
                                            <th>Vị trí kho</th><th>Bảo quản</th><th>Biệt trữ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx} style={item.discrepancy !== 0 ? { background: 'rgba(214,48,49,0.04)' } : {}}>
                                                <td>{idx + 1}</td>
                                                <td><span className="code-badge">{item.product?.code}</span></td>
                                                <td>{item.product?.name}</td>
                                                <td>
                                                    <input className="form-input" value={item.lot_number}
                                                        onChange={e => updateItem(idx, 'lot_number', e.target.value)}
                                                        placeholder="Lot" style={{ width: 80 }} />
                                                </td>
                                                <td>
                                                    <input type="date" className="form-input" value={item.expiry_date}
                                                        onChange={e => updateItem(idx, 'expiry_date', e.target.value)} />
                                                </td>
                                                <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{item.po_quantity}</td>
                                                <td>
                                                    <input type="number" className="form-input" value={item.actual_quantity}
                                                        onChange={e => updateItem(idx, 'actual_quantity', e.target.value)}
                                                        style={{ width: 60, textAlign: 'right' }} min="0" />
                                                </td>
                                                <td style={{
                                                    textAlign: 'right', fontWeight: 600,
                                                    color: item.discrepancy !== 0 ? '#D63031' : '#00B894',
                                                }}>
                                                    {item.discrepancy !== 0 ? (
                                                        <span>{item.discrepancy > 0 ? '-' : '+'}{Math.abs(item.discrepancy)} ⚠️</span>
                                                    ) : '✅ 0'}
                                                </td>
                                                <td>
                                                    <input className="form-input" value={item.storage_location}
                                                        onChange={e => updateItem(idx, 'storage_location', e.target.value)}
                                                        placeholder="Kệ/Tầng/Ô" style={{ width: 80 }} />
                                                </td>
                                                <td>
                                                    <select className="form-input" value={item.storage_condition}
                                                        onChange={e => updateItem(idx, 'storage_condition', e.target.value)}
                                                        style={{ width: 70 }}>
                                                        <option value="normal">Thường</option>
                                                        <option value="cool">Mát 2-8°C</option>
                                                        <option value="cold">Lạnh -20°C</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <input type="checkbox" checked={item.is_quarantine}
                                                        onChange={e => updateItem(idx, 'is_quarantine', e.target.checked)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {items.some(i => i.discrepancy !== 0) && (
                                <div style={{
                                    marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                                    background: 'rgba(214,48,49,0.08)', borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--font-sm)', color: '#D63031',
                                }}>
                                    <AlertTriangle size={14} style={{ marginRight: 6 }} />
                                    <strong>Chênh lệch:</strong> {items.filter(i => i.discrepancy !== 0).length} SP có SL thực nhận khác SL PO
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || items.length === 0}>
                            <Package size={16} /> {saving ? 'Đang lưu...' : 'Tạo phiếu nhập kho'}
                        </button>
                    </div>
                </div>
            </Modal>
        )
    }

    // ========== VIEW RECEIPT ==========
    function ViewModal({ receipt, onClose }) {
        const [tab, setTab] = useState('items')
        const [poItems, setPoItems] = useState([])

        useEffect(() => {
            if (receipt.po_id || receipt.import_shipment?.po_id) fetchPOData()
        }, [])

        async function fetchPOData() {
            const poId = receipt.po_id || receipt.import_shipment?.po_id
            if (!poId) return
            const { data } = await supabase.from('po_items').select('*, product:products(code, name, unit)')
                .eq('po_id', poId)
            if (data) setPoItems(data)
        }

        async function handleStatusUpdate(newStatus) {
            const { error } = await supabase.from('warehouse_receipts').update({
                status: newStatus, updated_at: new Date().toISOString(),
            }).eq('id', receipt.id)
            if (error) { toast.error(error.message); return }

            // If completing, update inventory_lots
            if (newStatus === 'completed') {
                try {
                    for (const item of receipt.receipt_items) {
                        if (item.is_quarantine) continue
                        // Upsert inventory lot
                        const { data: existing } = await supabase.from('inventory_lots')
                            .select('id, quantity')
                            .eq('product_id', item.product_id)
                            .eq('lot_number', item.lot_number)
                            .single()

                        if (existing) {
                            await supabase.from('inventory_lots').update({
                                quantity: existing.quantity + item.actual_quantity,
                                unit_cost: item.unit_cost,
                            }).eq('id', existing.id)
                        } else {
                            await supabase.from('inventory_lots').insert({
                                product_id: item.product_id,
                                lot_number: item.lot_number,
                                expiry_date: item.expiry_date,
                                quantity: item.actual_quantity,
                                unit_cost: item.unit_cost,
                                storage_location: item.storage_location,
                                storage_condition: item.storage_condition,
                                status: 'available',
                            })
                        }
                    }
                    toast.success('Đã nhập kho + cập nhật tồn kho!')
                } catch (err) {
                    toast.error('Lỗi cập nhật tồn kho: ' + err.message)
                }
            } else {
                toast.success('Đã cập nhật trạng thái!')
            }
            onClose(); fetchAll()
        }

        // Cross-verification data
        const sourceForVerify = poItems.map(p => ({
            code: p.product?.code, name: p.product?.name,
            unit: p.product?.unit, quantity: p.quantity,
            lot_number: p.lot_number, expiry_date: p.expiry_date,
        }))
        const targetForVerify = receipt.receipt_items?.map(i => ({
            code: i.product?.code, name: i.product?.name,
            unit: i.product?.unit || i.unit, quantity: i.actual_quantity,
            lot_number: i.lot_number, expiry_date: i.expiry_date,
        })) || []

        const stCfg = STATUS_CONFIG[receipt.status] || {}

        return (
            <Modal title={`Phiếu nhập kho: ${receipt.code}`} onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Header info */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Trạng thái</div>
                            <span className="status-badge" style={{ background: `${stCfg.color}20`, color: stCfg.color }}>
                                {stCfg.label}
                            </span>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>PO</div>
                            <div style={{ fontWeight: 600 }}>
                                {receipt.po_direct?.code || receipt.import_shipment?.po?.code || '—'}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Ngày nhập</div>
                            <div>{formatDate(receipt.receipt_date)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Người nhận</div>
                            <div>{receipt.received_by_profile?.full_name}</div>
                        </div>
                    </div>

                    {/* Side-by-side layout (wireframe W1): Mặt hàng | Đối chiếu */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
                        gap: 'var(--space-4)',
                    }}>
                        {/* Left: Item details */}
                        <div>
                            <h4 style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Package size={16} /> Mặt hàng nhập kho
                            </h4>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ fontSize: 'var(--font-xs)' }}>
                                    <thead>
                                        <tr>
                                            <th>#</th><th>Code</th><th>Tên SP</th>
                                            <th>Lot</th><th>HSD</th><th>SL PO</th><th>SL thực</th>
                                            <th>±</th><th>BQ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receipt.receipt_items?.map((item, idx) => (
                                            <tr key={item.id} style={item.is_quarantine ? { background: 'rgba(214,48,49,0.05)' } : {}}>
                                                <td>{idx + 1}</td>
                                                <td><span className="code-badge">{item.product?.code}</span></td>
                                                <td>{item.product?.name}</td>
                                                <td>{item.lot_number}</td>
                                                <td>{formatDate(item.expiry_date)}</td>
                                                <td style={{ textAlign: 'right' }}>{item.po_quantity}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.actual_quantity}</td>
                                                <td style={{
                                                    textAlign: 'right', fontWeight: 600,
                                                    color: item.discrepancy !== 0 ? '#D63031' : '#00B894',
                                                }}>
                                                    {item.discrepancy !== 0 ? `${item.discrepancy > 0 ? '-' : '+'}${Math.abs(item.discrepancy)} ⚠️` : '✅'}
                                                </td>
                                                <td>{item.is_quarantine ? <ShieldAlert size={12} style={{ color: '#D63031' }} /> : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right: Cross-verification */}
                        <div>
                            <h4 style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckCircle size={16} /> Đối chiếu
                            </h4>
                            <CrossVerificationPanel
                                sourceLabel="PO / Invoice"
                                targetLabel="Nhập kho thực tế"
                                sourceItems={sourceForVerify}
                                targetItems={targetForVerify}
                                onConfirm={async (result) => {
                                    await supabase.from('warehouse_receipts').update({
                                        cross_verify_status: result.status,
                                        cross_verify_detail: result.mismatches,
                                    }).eq('id', receipt.id)
                                    toast.success('Đã lưu kết quả đối chiếu nhập kho!')
                                }}
                            />
                        </div>
                    </div>

                    {/* Status actions */}
                    {isRole(ROLES.WAREHOUSE_KEEPER, ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: 'var(--space-2)',
                            padding: 'var(--space-3)', background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                        }}>
                            {receipt.status === 'pending' && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate('inspecting')}>
                                    <Eye size={14} /> Bắt đầu kiểm tra
                                </button>
                            )}
                            {receipt.status === 'inspecting' && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate('verified')}>
                                    <CheckCircle size={14} /> Xác nhận kiểm tra
                                </button>
                            )}
                            {receipt.status === 'verified' && (
                                <button className="btn btn-primary" onClick={() => handleStatusUpdate('completed')}>
                                    <ArrowDown size={16} /> Nhập kho + Cập nhật tồn kho
                                </button>
                            )}
                            {receipt.status !== 'quarantine' && receipt.status !== 'completed' && (
                                <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate('quarantine')}>
                                    <ShieldAlert size={14} /> Biệt trữ
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
                title="Nhập kho"
                subtitle="Kiểm đếm, đối chiếu, nhập kho theo GSP"
                icon={<Warehouse size={20} />}
                actions={isRole(ROLES.WAREHOUSE_KEEPER, ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> Tạo phiếu nhập kho
                    </button>
                )}
            />

            {loading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : receipts.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
                    <Warehouse size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }} />
                    <h3>Chưa có phiếu nhập kho</h3>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>Tạo PNK từ PO hoặc lô nhập khẩu</p>
                </div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Mã PNK</th><th>Nguồn</th><th>NCC</th><th>Ngày nhập</th>
                                <th>Số SP</th><th>Đối chiếu</th><th>Trạng thái</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {receipts.map(r => {
                                const source = r.import_shipment
                                    ? `NK: ${r.import_shipment.code}` : r.po_direct ? `PO: ${r.po_direct.code}` : '—'
                                const supplier = r.import_shipment?.po?.supplier?.name || r.po_direct?.supplier?.name || '—'
                                const stCfg = STATUS_CONFIG[r.status] || {}
                                return (
                                    <tr key={r.id}>
                                        <td><span className="code-badge">{r.code}</span></td>
                                        <td style={{ fontSize: 'var(--font-sm)' }}>{source}</td>
                                        <td>{supplier}</td>
                                        <td>{formatDate(r.receipt_date)}</td>
                                        <td style={{ textAlign: 'center' }}>{r.receipt_items?.length || 0}</td>
                                        <td>
                                            {r.cross_verify_status === 'matched' ? (
                                                <span style={{ color: '#00B894' }}>✅ Khớp</span>
                                            ) : r.cross_verify_status === 'mismatched' ? (
                                                <span style={{ color: '#D63031' }}>⚠️ Sai lệch</span>
                                            ) : r.cross_verify_status === 'confirmed' ? (
                                                <span style={{ color: '#FDCB6E' }}>✅ Đã xác nhận</span>
                                            ) : (
                                                <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                            )}
                                        </td>
                                        <td><span className="status-badge" style={{ background: `${stCfg.color}20`, color: stCfg.color }}>{stCfg.label}</span></td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setShowView(r)}>
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
            {showView && <ViewModal receipt={showView} onClose={() => setShowView(null)} />}
        </div>
    )
}
