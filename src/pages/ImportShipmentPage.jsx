import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, ROLES } from '../lib/auth'
import { useToast } from '../components/Toast'
import CrossVerificationPanel from '../components/CrossVerificationPanel'
import {
    Plus, Eye, Edit2, Truck, Check, Upload, FileText,
    AlertTriangle, CheckCircle, XCircle, Globe, DollarSign, Clock, Paperclip, Download
} from 'lucide-react'
import { formatDate, formatCurrency } from '../lib/helpers'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useImportShipments } from '../hooks/useSupabaseQuery'
import { useExport } from '../hooks/useExport'

const STATUS_CONFIG = {
    in_transit: { label: 'Đang vận chuyển', color: '#0984E3', icon: '🚢' },
    arrived: { label: 'Đến cảng', color: '#6C5CE7', icon: '⚓' },
    declaring: { label: 'Khai báo HQ', color: '#FDCB6E', icon: '📋' },
    cleared: { label: 'Đã thông quan', color: '#00B894', icon: '✅' },
    transporting: { label: 'VC nội địa', color: '#E17055', icon: '🚛' },
    completed: { label: 'Hoàn thành', color: '#00B894', icon: '🏁' },
}

const DOC_TYPES = [
    { key: 'commercial_invoice', label: 'Commercial Invoice', required: true },
    { key: 'packing_list', label: 'Packing List', required: true },
    { key: 'bill_of_lading', label: 'Bill of Lading / AWB', required: true },
    { key: 'certificate_of_origin', label: 'Certificate of Origin (C/O)', required: false },
    { key: 'free_sale_cert', label: 'Free Sale Certificate (CFS)', required: false },
    { key: 'iso_13485', label: 'ISO 13485 Certificate', required: false },
    { key: 'registration_cert', label: 'Số lưu hành / CBTA', required: false },
    { key: 'import_license', label: 'Giấy phép nhập khẩu', required: false },
]

const STATUS_STEPS = ['in_transit', 'arrived', 'declaring', 'cleared', 'transporting', 'completed']

export default function ImportShipmentPage() {
    const { profile, isRole } = useAuth()
    const toast = useToast()
    const [showCreate, setShowCreate] = useState(false)
    const [showView, setShowView] = useState(null)
    const { exportExcel, exportPDF } = useExport()

    // React Query: cached shipment data
    const { data: shipmentData, isLoading: loading, refetch: fetchAll } = useImportShipments()
    const shipments = shipmentData?.shipments || []
    const pos = shipmentData?.availablePOs || []

    // Export columns
    const exportColumns = [
        { key: 'code', label: 'Mã NK' },
        { key: 'po_code', label: 'PO', exportRender: (_, r) => r.po?.code || '—' },
        { key: 'supplier', label: 'NCC', exportRender: (_, r) => r.po?.supplier?.name || '—' },
        { key: 'port', label: 'Cảng' },
        { key: 'total_cost', label: 'Tổng CP', exportRender: v => v ? Number(v).toLocaleString('vi-VN') + ' đ' : '—' },
        { key: 'status', label: 'Trạng thái', exportRender: v => STATUS_CONFIG[v]?.label || v },
    ]

    // ========== Timeline Component ==========
    function StatusTimeline({ currentStatus }) {
        const currentIdx = STATUS_STEPS.indexOf(currentStatus)
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)' }}>
                {STATUS_STEPS.map((step, idx) => {
                    const cfg = STATUS_CONFIG[step]
                    const isActive = idx <= currentIdx
                    const isCurrent = step === currentStatus
                    return (
                        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 22, height: 22, borderRadius: '50%',
                                background: isActive ? `${cfg.color}20` : 'var(--bg-tertiary)',
                                border: isCurrent ? `2px solid ${cfg.color}` : '1px solid var(--border)',
                                fontSize: 10,
                            }}>
                                {isActive ? cfg.icon : idx + 1}
                            </span>
                            {idx < STATUS_STEPS.length - 1 && (
                                <div style={{
                                    width: 16, height: 2,
                                    background: isActive ? cfg.color : 'var(--border)',
                                }} />
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    // ========== CREATE SHIPMENT ==========
    function CreateModal({ onClose }) {
        const [form, setForm] = useState({
            po_id: '', customs_declaration_no: '', declaration_date: '',
            port: '', hs_code: '', device_class: '',
            registration_number: '', fob_price: 0, freight: 0,
            insurance: 0, exchange_rate: 25000,
            import_tax_pct: 0, vat_pct: 8,
            storage_fee: 0, customs_fee: 0, other_fees: 0,
            notes: '',
        })
        const [saving, setSaving] = useState(false)

        // Auto CIF calculation
        const cif = parseFloat(form.fob_price || 0) + parseFloat(form.freight || 0) + parseFloat(form.insurance || 0)
        const cifVnd = cif * parseFloat(form.exchange_rate || 25000)
        const importTax = cifVnd * (parseFloat(form.import_tax_pct || 0) / 100)
        const vatBase = cifVnd + importTax
        const vat = vatBase * (parseFloat(form.vat_pct || 0) / 100)
        const totalCost = cifVnd + importTax + vat +
            parseFloat(form.storage_fee || 0) + parseFloat(form.customs_fee || 0) + parseFloat(form.other_fees || 0)

        async function handleSave() {
            if (!form.po_id) { toast.warning('Chọn PO'); return }
            setSaving(true)
            try {
                const year = new Date().getFullYear()
                const { count } = await supabase.from('import_shipments').select('*', { count: 'exact', head: true })
                const code = `NK-${year}-${String((count || 0) + 1).padStart(4, '0')}`

                const { data, error } = await supabase.from('import_shipments').insert({
                    ...form, code,
                    cif_price: cif, cif_vnd: cifVnd,
                    import_tax: importTax, vat_amount: vat,
                    total_cost: totalCost,
                    status: 'in_transit',
                    created_by: profile.id,
                }).select().single()
                if (error) throw error

                // Auto-create document checklist
                const docs = DOC_TYPES.map(dt => ({
                    shipment_id: data.id,
                    doc_type: dt.key,
                    is_required: dt.required,
                }))
                await supabase.from('import_documents').insert(docs)

                // FR-3.4: B/L date auto-fill PO expected_delivery
                if (form.declaration_date && form.po_id) {
                    const blDate = new Date(form.declaration_date)
                    blDate.setDate(blDate.getDate() + 1) // +1 day transport buffer (per spec FR-3.4)
                    const updateData = {
                        expected_delivery: blDate.toISOString().split('T')[0],
                        updated_at: new Date().toISOString(),
                    }
                    // Also update PO status to delivering if confirmed
                    const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', form.po_id).single()
                    if (po?.status === 'confirmed') {
                        updateData.status = 'delivering'
                    }
                    await supabase.from('purchase_orders').update(updateData).eq('id', form.po_id)
                }

                toast.success('Tạo lô nhập khẩu thành công!')
                onClose(); fetchAll()
            } catch (err) { toast.error('Lỗi: ' + err.message) }
            finally { setSaving(false) }
        }

        return (
            <Modal title="Tạo lô nhập khẩu mới" onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* PO + basic info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="form-label required">PO gốc</label>
                            <select className="form-input" value={form.po_id}
                                onChange={e => setForm(p => ({ ...p, po_id: e.target.value }))}>
                                <option value="">-- Chọn PO --</option>
                                {pos.map(p => <option key={p.id} value={p.id}>{p.code} — {p.supplier?.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cảng đến</label>
                            <input className="form-input" value={form.port}
                                onChange={e => setForm(p => ({ ...p, port: e.target.value }))}
                                placeholder="Hải Phòng, Đà Nẵng..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ngày B/L (vận đơn)</label>
                            <input type="date" className="form-input" value={form.declaration_date}
                                onChange={e => setForm(p => ({ ...p, declaration_date: e.target.value }))} />
                            {form.declaration_date && (
                                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--primary-400)', marginTop: 4, display: 'block' }}>
                                    → PO expected_delivery sẽ tự động = {(() => { const d = new Date(form.declaration_date); d.setDate(d.getDate() + 3); return d.toLocaleDateString('vi-VN') })()}
                                </span>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phân loại TBYT</label>
                            <select className="form-input" value={form.device_class}
                                onChange={e => setForm(p => ({ ...p, device_class: e.target.value }))}>
                                <option value="">—</option>
                                {['A', 'B', 'C', 'D'].map(c => <option key={c} value={c}>Loại {c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="form-label">Mã HS</label>
                            <input className="form-input" value={form.hs_code}
                                onChange={e => setForm(p => ({ ...p, hs_code: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Số tờ khai HQ</label>
                            <input className="form-input" value={form.customs_declaration_no}
                                onChange={e => setForm(p => ({ ...p, customs_declaration_no: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Số lưu hành</label>
                            <input className="form-input" value={form.registration_number}
                                onChange={e => setForm(p => ({ ...p, registration_number: e.target.value }))} />
                        </div>
                    </div>

                    {/* Cost calculator */}
                    <div style={{
                        padding: 'var(--space-4)', background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                    }}>
                        <h4 style={{ marginBottom: 'var(--space-3)' }}>💰 Tính chi phí nhập khẩu</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">Giá FOB (USD)</label>
                                <input type="number" className="form-input" value={form.fob_price}
                                    onChange={e => setForm(p => ({ ...p, fob_price: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Freight (USD)</label>
                                <input type="number" className="form-input" value={form.freight}
                                    onChange={e => setForm(p => ({ ...p, freight: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Insurance (USD)</label>
                                <input type="number" className="form-input" value={form.insurance}
                                    onChange={e => setForm(p => ({ ...p, insurance: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tỷ giá (VND/USD)</label>
                                <input type="number" className="form-input" value={form.exchange_rate}
                                    onChange={e => setForm(p => ({ ...p, exchange_rate: e.target.value }))} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                            <div className="form-group">
                                <label className="form-label">% Thuế NK</label>
                                <input type="number" className="form-input" value={form.import_tax_pct}
                                    onChange={e => setForm(p => ({ ...p, import_tax_pct: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">% VAT</label>
                                <input type="number" className="form-input" value={form.vat_pct}
                                    onChange={e => setForm(p => ({ ...p, vat_pct: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phí lưu kho (VND)</label>
                                <input type="number" className="form-input" value={form.storage_fee}
                                    onChange={e => setForm(p => ({ ...p, storage_fee: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phí HQ (VND)</label>
                                <input type="number" className="form-input" value={form.customs_fee}
                                    onChange={e => setForm(p => ({ ...p, customs_fee: e.target.value }))} />
                            </div>
                        </div>

                        {/* Summary */}
                        <div style={{
                            marginTop: 'var(--space-3)', padding: 'var(--space-3)',
                            background: 'rgba(108,92,231,0.05)', borderRadius: 'var(--radius-md)',
                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)',
                            fontSize: 'var(--font-sm)',
                        }}>
                            <div>CIF (USD): <strong>${cif.toFixed(2)}</strong></div>
                            <div>CIF (VND): <strong>{formatCurrency(cifVnd)}</strong></div>
                            <div>Thuế NK: <strong>{formatCurrency(importTax)}</strong></div>
                            <div>VAT: <strong>{formatCurrency(vat)}</strong></div>
                            <div style={{ gridColumn: 'span 2', fontWeight: 700, color: 'var(--primary)', fontSize: 'var(--font-md)' }}>
                                TỔNG CHI PHÍ: {formatCurrency(totalCost)}
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Ghi chú</label>
                        <textarea className="form-input" value={form.notes} rows={2}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            <Globe size={16} /> {saving ? 'Đang tạo...' : 'Tạo lô NK'}
                        </button>
                    </div>
                </div>
            </Modal>
        )
    }

    // ========== VIEW/DETAIL SHIPMENT ==========
    function ViewModal({ shipment, onClose }) {
        const [docs, setDocs] = useState(shipment.import_documents || [])
        const [tab, setTab] = useState('info')
        const [poItems, setPoItems] = useState([])
        const [docItems, setDocItems] = useState({})
        const [editingDoc, setEditingDoc] = useState(null)
        const [uploading, setUploading] = useState(null) // doc_type being uploaded

        useEffect(() => {
            if (shipment.po_id) fetchPOItems()
        }, [shipment.po_id])

        async function fetchPOItems() {
            const { data } = await supabase.from('po_items').select('*, product:products(code, name, unit)')
                .eq('po_id', shipment.po_id)
            if (data) setPoItems(data)
        }

        async function handleToggleDoc(docId, checked) {
            const { error } = await supabase.from('import_documents').update({
                is_checked: checked, uploaded_at: checked ? new Date().toISOString() : null,
            }).eq('id', docId)
            if (error) { toast.error(error.message); return }
            setDocs(prev => prev.map(d => d.id === docId ? { ...d, is_checked: checked } : d))
            toast.success(checked ? 'Đã đánh dấu ✅' : 'Đã bỏ đánh dấu')
        }

        async function handleStatusUpdate(newStatus) {
            // Check required docs before declaring
            if (newStatus === 'declaring') {
                const requiredDocs = docs.filter(d => d.is_required)
                const unchecked = requiredDocs.filter(d => !d.is_checked)
                if (unchecked.length > 0) {
                    toast.warning(`Còn ${unchecked.length} chứng từ bắt buộc chưa hoàn thành`)
                    return
                }
            }
            const { error } = await supabase.from('import_shipments').update({
                status: newStatus, updated_at: new Date().toISOString(),
            }).eq('id', shipment.id)
            if (error) { toast.error(error.message); return }
            toast.success('Đã cập nhật trạng thái!')
            onClose(); fetchAll()
        }

        // ===== File Upload =====
        async function handleFileUpload(docType, file) {
            if (!file) return
            setUploading(docType)
            try {
                const ext = file.name.split('.').pop()
                const path = `imports/${shipment.id}/${docType}_${Date.now()}.${ext}`

                const { error: upErr } = await supabase.storage
                    .from('documents')
                    .upload(path, file, { upsert: true })
                if (upErr) throw upErr

                // Get URL (for private bucket, use createSignedUrl in production)
                const { data: { publicUrl } } = supabase.storage
                    .from('documents')
                    .getPublicUrl(path)

                // Save URL to import_documents
                const doc = docs.find(d => d.doc_type === docType)
                if (doc) {
                    await supabase.from('import_documents')
                        .update({
                            file_url: publicUrl,
                            uploaded_at: new Date().toISOString(),
                            is_checked: true,
                        })
                        .eq('id', doc.id)
                    setDocs(prev => prev.map(d =>
                        d.id === doc.id ? { ...d, file_url: publicUrl, is_checked: true, uploaded_at: new Date().toISOString() } : d
                    ))
                }
                toast.success(`Upload ${DOC_TYPES.find(d => d.key === docType)?.label} thành công!`)
            } catch (err) {
                toast.error('Upload lỗi: ' + err.message)
            } finally {
                setUploading(null)
            }
        }

        // Document entry for cross-check
        function DocEntryForm({ docType, onDone }) {
            const [rows, setRows] = useState(
                poItems.map(p => ({
                    product_code: p.product?.code || '',
                    product_name: p.product?.name || '',
                    unit: p.product?.unit || '',
                    quantity: p.quantity,
                    lot_number: p.lot_number || '',
                    expiry_date: p.expiry_date || '',
                }))
            )

            function updateRow(idx, field, value) {
                setRows(prev => {
                    const next = [...prev]
                    next[idx] = { ...next[idx], [field]: value }
                    return next
                })
            }

            async function handleSaveDocItems() {
                const doc = docs.find(d => d.doc_type === docType)
                if (!doc) return

                // Save doc items
                await supabase.from('po_document_items').delete().eq('document_id', doc.id)
                const items = rows.map(r => ({
                    document_id: doc.id,
                    product_code: r.product_code,
                    product_name: r.product_name,
                    unit: r.unit,
                    quantity: parseInt(r.quantity) || 0,
                    lot_number: r.lot_number,
                    expiry_date: r.expiry_date || null,
                }))
                await supabase.from('po_document_items').insert(items)
                setDocItems(prev => ({ ...prev, [docType]: rows }))
                toast.success('Đã lưu dữ liệu chứng từ!')
                onDone?.()
            }

            return (
                <div>
                    <h4 style={{ marginBottom: 'var(--space-2)' }}>
                        Nhập dữ liệu {DOC_TYPES.find(d => d.key === docType)?.label}
                    </h4>
                    <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
                        Dữ liệu đã auto-fill từ PO. Sửa nếu chứng từ thực tế khác.
                    </p>
                    <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                        <thead>
                            <tr><th>#</th><th>Code</th><th>Tên SP</th><th>ĐVT</th><th>SL</th><th>Lot</th><th>HSD</th></tr>
                        </thead>
                        <tbody>
                            {rows.map((r, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td><input className="form-input" value={r.product_code} onChange={e => updateRow(idx, 'product_code', e.target.value)} style={{ width: 80 }} /></td>
                                    <td><input className="form-input" value={r.product_name} onChange={e => updateRow(idx, 'product_name', e.target.value)} style={{ minWidth: 120 }} /></td>
                                    <td><input className="form-input" value={r.unit} onChange={e => updateRow(idx, 'unit', e.target.value)} style={{ width: 50 }} /></td>
                                    <td><input type="number" className="form-input" value={r.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} style={{ width: 60 }} /></td>
                                    <td><input className="form-input" value={r.lot_number} onChange={e => updateRow(idx, 'lot_number', e.target.value)} style={{ width: 80 }} /></td>
                                    <td><input type="date" className="form-input" value={r.expiry_date} onChange={e => updateRow(idx, 'expiry_date', e.target.value)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onDone?.()}>Hủy</button>
                        <button className="btn btn-primary btn-sm" onClick={handleSaveDocItems}>
                            <CheckCircle size={14} /> Lưu & Đối chiếu
                        </button>
                    </div>
                </div>
            )
        }

        const cfg = STATUS_CONFIG[shipment.status] || {}
        const currentIdx = STATUS_STEPS.indexOf(shipment.status)
        const nextStatus = STATUS_STEPS[currentIdx + 1]

        // Prepare cross-verification data
        const sourceForVerify = poItems.map(p => ({
            code: p.product?.code, name: p.product?.name,
            unit: p.product?.unit, quantity: p.quantity,
            lot_number: p.lot_number, expiry_date: p.expiry_date,
        }))

        return (
            <Modal title={`Lô NK: ${shipment.code}`} onClose={onClose} size="xl">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Timeline */}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {STATUS_STEPS.map((step, idx) => {
                                const sc = STATUS_CONFIG[step]
                                const isActive = idx <= currentIdx
                                const isCurrent = step === shipment.status
                                return (
                                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <div style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                        }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: isActive ? `${sc.color}20` : 'var(--bg-tertiary)',
                                                border: isCurrent ? `2px solid ${sc.color}` : '1px solid var(--border)',
                                                fontSize: 16,
                                            }}>{isActive ? sc.icon : ''}</div>
                                            <span style={{ fontSize: 'var(--font-xs)', color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                                {sc.label}
                                            </span>
                                        </div>
                                        {idx < STATUS_STEPS.length - 1 && (
                                            <div style={{ width: 30, height: 2, background: isActive ? sc.color : 'var(--border)', marginBottom: 20 }} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--border)' }}>
                        {[
                            { key: 'info', label: 'Thông tin', icon: <FileText size={14} /> },
                            { key: 'docs', label: 'Chứng từ', icon: <Upload size={14} /> },
                            { key: 'costs', label: 'Chi phí', icon: <DollarSign size={14} /> },
                            { key: 'verify', label: 'Đối chiếu', icon: <CheckCircle size={14} /> },
                        ].map(t => (
                            <button key={t.key}
                                className={`tab-btn ${tab === t.key ? 'active' : ''}`}
                                onClick={() => setTab(t.key)}
                                style={{
                                    padding: 'var(--space-2) var(--space-3)',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    borderBottom: tab === t.key ? '2px solid var(--primary)' : 'none',
                                    color: tab === t.key ? 'var(--primary)' : 'var(--text-tertiary)',
                                    fontWeight: tab === t.key ? 600 : 400,
                                }}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {tab === 'info' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                            <div><span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>PO gốc</span><div style={{ fontWeight: 600 }}>{shipment.po?.code}</div></div>
                            <div><span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>NCC</span><div>{shipment.po?.supplier?.name}</div></div>
                            <div><span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Cảng</span><div>{shipment.port || '—'}</div></div>
                            <div><span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Mã HS</span><div>{shipment.hs_code || '—'}</div></div>
                            <div><span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Loại TBYT</span><div>{shipment.device_class ? `Loại ${shipment.device_class}` : '—'}</div></div>
                            <div><span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Số lưu hành</span><div>{shipment.registration_number || '—'}</div></div>
                        </div>
                    )}

                    {tab === 'docs' && (
                        <div>
                            {editingDoc ? (
                                <DocEntryForm docType={editingDoc} onDone={() => setEditingDoc(null)} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {docs.map(doc => {
                                        const dt = DOC_TYPES.find(d => d.key === doc.doc_type)
                                        return (
                                            <div key={doc.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                                                background: doc.is_checked ? 'rgba(0,184,148,0.05)' : 'var(--bg-secondary)',
                                                border: `1px solid ${doc.is_required && !doc.is_checked ? 'rgba(214,48,49,0.3)' : 'var(--border)'}`,
                                            }}>
                                                <input type="checkbox" checked={doc.is_checked}
                                                    onChange={e => handleToggleDoc(doc.id, e.target.checked)} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500 }}>
                                                        {dt?.label}
                                                        {doc.is_required && <span style={{ color: '#D63031', marginLeft: 4 }}>*</span>}
                                                    </div>
                                                    {doc.cross_check_status !== 'pending' && (
                                                        <span style={{
                                                            fontSize: 'var(--font-xs)',
                                                            color: doc.cross_check_status === 'matched' ? '#00B894' : '#D63031',
                                                        }}>
                                                            {doc.cross_check_status === 'matched' ? '✅ Đã đối chiếu — Khớp' : '⚠️ Có sai lệch'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                                    {/* File upload */}
                                                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', opacity: uploading === doc.doc_type ? 0.5 : 1 }}>
                                                        <Upload size={14} />
                                                        {uploading === doc.doc_type ? '...' : 'Upload'}
                                                        <input type="file" accept=".pdf,.jpg,.png,.xlsx,.xls,.doc,.docx" hidden
                                                            disabled={uploading === doc.doc_type}
                                                            onChange={e => handleFileUpload(doc.doc_type, e.target.files?.[0])} />
                                                    </label>
                                                    {/* View uploaded file */}
                                                    {doc.file_url && (
                                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                                            className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-400)' }}>
                                                            <Paperclip size={14} /> Xem file
                                                        </a>
                                                    )}
                                                    {/* Cross-check entry (only for main 3 docs) */}
                                                    {['commercial_invoice', 'packing_list', 'bill_of_lading'].includes(doc.doc_type) && (
                                                        <button className="btn btn-ghost btn-sm"
                                                            onClick={() => setEditingDoc(doc.doc_type)}>
                                                            <Edit2 size={14} /> Nhập dữ liệu & Đối chiếu
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'costs' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                            <div>
                                <h4>Chi phí (USD)</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--space-2)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>FOB:</span><span>${shipment.fob_price}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Freight:</span><span>${shipment.freight}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Insurance:</span><span>${shipment.insurance}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                                        <span>CIF:</span><span>${shipment.cif_price}</span></div>
                                </div>
                            </div>
                            <div>
                                <h4>Chi phí (VND)</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--space-2)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CIF (VND):</span><span>{formatCurrency(shipment.cif_vnd)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Thuế NK:</span><span>{formatCurrency(shipment.import_tax)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>VAT:</span><span>{formatCurrency(shipment.vat_amount)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Phí lưu kho:</span><span>{formatCurrency(shipment.storage_fee)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 4, color: 'var(--primary)' }}>
                                        <span>TỔNG:</span><span>{formatCurrency(shipment.total_cost)}</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'verify' && (
                        <CrossVerificationPanel
                            sourceLabel="PO"
                            targetLabel="Chứng từ"
                            sourceItems={sourceForVerify}
                            targetItems={Object.values(docItems).flat().map(r => ({
                                code: r.product_code, name: r.product_name,
                                unit: r.unit, quantity: r.quantity,
                                lot_number: r.lot_number, expiry_date: r.expiry_date,
                            }))}
                            onConfirm={async (result) => {
                                await supabase.from('verification_results').insert({
                                    po_id: shipment.po_id,
                                    doc_type: 'import_cross_check',
                                    verified_by: profile.id,
                                    status: result.status,
                                    mismatches: result.mismatches,
                                    notes: result.notes,
                                })
                                toast.success('Đã lưu kết quả đối chiếu!')
                            }}
                        />
                    )}

                    {/* Next status button */}
                    {nextStatus && isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={() => handleStatusUpdate(nextStatus)}>
                                <Clock size={16} /> Chuyển: {STATUS_CONFIG[nextStatus]?.icon} {STATUS_CONFIG[nextStatus]?.label}
                            </button>
                        </div>
                    )}
                </div>
            </Modal>
        )
    }

    return (
        <div>
            <PageHeader
                title="Nhập khẩu"
                subtitle="Quản lý lô nhập khẩu, chứng từ hải quan, chi phí CIF"
                icon={<Globe size={20} />}
                actions={
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN) && (
                            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                                <Plus size={16} /> Tạo lô NK mới
                            </button>
                        )}
                        <button className="btn btn-ghost" onClick={() => exportExcel(exportColumns, shipments, 'nhap_khau', 'Nhập Khẩu')}>
                            <Download size={14} /> Excel
                        </button>
                        <button className="btn btn-ghost" onClick={() => exportPDF(exportColumns, shipments, 'Danh sách Lô Nhập Khẩu', 'nhap_khau')}>
                            <Download size={14} /> PDF
                        </button>
                    </div>
                }
            />

            {loading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : shipments.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
                    <Globe size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }} />
                    <h3>Chưa có lô nhập khẩu</h3>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>Tạo lô NK từ PO đã gửi NCC</p>
                </div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Mã NK</th><th>PO</th><th>NCC</th><th>Cảng</th>
                                <th>Tổng CP</th><th>Trạng thái</th><th>Chứng từ</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {shipments.map(s => {
                                const checkedDocs = s.import_documents?.filter(d => d.is_checked).length || 0
                                const totalDocs = s.import_documents?.length || 0
                                return (
                                    <tr key={s.id}>
                                        <td><span className="code-badge">{s.code}</span></td>
                                        <td>{s.po?.code}</td>
                                        <td>{s.po?.supplier?.name}</td>
                                        <td>{s.port || '—'}</td>
                                        <td style={{ fontWeight: 600 }}>{formatCurrency(s.total_cost)}</td>
                                        <td><StatusTimeline currentStatus={s.status} /></td>
                                        <td>
                                            <span className="badge" style={{
                                                background: checkedDocs === totalDocs ? 'rgba(0,184,148,0.15)' : 'rgba(253,203,110,0.15)',
                                                color: checkedDocs === totalDocs ? '#00B894' : '#FDCB6E',
                                                fontWeight: 600, fontSize: 'var(--font-xs)',
                                                padding: '3px 10px', borderRadius: '999px',
                                            }}>📄 {checkedDocs}/{totalDocs}</span>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setShowView(s)}>
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
            {showView && <ViewModal shipment={showView} onClose={() => setShowView(null)} />}
        </div>
    )
}
