import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, ROLES } from '../lib/auth'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { StorageBadge } from '../components/Badges'
import { Plus, Edit2, Trash2, Package, Building2, Truck, Factory, DollarSign, History, X, ChevronRight, Database, Filter, Upload, Download } from 'lucide-react'

const TABS = [
    { key: 'products', label: 'Sản phẩm', icon: Package },
    { key: 'hospitals', label: 'Bệnh viện', icon: Building2 },
    { key: 'suppliers', label: 'Nhà cung cấp', icon: Factory },
    { key: 'carriers', label: 'ĐV Vận chuyển', icon: Truck },
    { key: 'price_list', label: 'Bảng giá', icon: DollarSign },
]

export default function MasterDataPage() {
    const { isRole } = useAuth()
    const [activeTab, setActiveTab] = useState('products')

    // Per-questionnaire (Câu hỏi hệ thống.pdf, Section 1g):
    // Sales       → CRUD Bệnh viện/KH
    // QL Logistics→ CRUD Sản phẩm, NCC, ĐV Vận chuyển, Bảng giá
    // Admin       → full access including delete
    // Others      → view-only
    const canWriteForTab = {
        products:   isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN),
        hospitals:  isRole(ROLES.SALES, ROLES.ADMIN),
        suppliers:  isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN),
        carriers:   isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN),
        price_list: isRole(ROLES.LOGISTICS_MANAGER, ROLES.ADMIN),
    }
    const canDelete = isRole(ROLES.ADMIN)
    const canWrite  = canWriteForTab[activeTab] || false
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [products, setProducts] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [historyPanel, setHistoryPanel] = useState(null) // { product_id, supplier_id, product_name }
    const [historyData, setHistoryData] = useState([])
    const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'active' | 'inactive'
    const [importing, setImporting] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null) // item to delete
    const toast = useToast()

    const fetchLookups = useCallback(async function() {
        const [{ data: prods }, { data: supps }] = await Promise.all([
            supabase.from('products').select('id, code, name').order('code'),
            supabase.from('suppliers').select('id, name').order('name'),
        ])
        setProducts(prods || [])
        setSuppliers(supps || [])
    }, [])

    const fetchData = useCallback(async function() {
        setLoading(true)
        try {
            if (activeTab === 'price_list') {
                const { data: result, error } = await supabase
                    .from('price_list')
                    .select('*, products(code, name), suppliers(name)')
                    .order('is_current', { ascending: false })
                    .order('created_at', { ascending: false })
                if (error) throw error
                setData((result || []).map(r => ({
                    ...r,
                    product_code: r.products?.code,
                    product_name: r.products?.name,
                    supplier_name: r.suppliers?.name,
                })))
            } else {
                const { data: result, error } = await supabase
                    .from(activeTab)
                    .select('*')
                    .order('created_at', { ascending: false })
                if (error) throw error
                setData(result || [])
            }
        } catch (err) {
            toast.error('Lỗi tải dữ liệu: ' + err.message)
        } finally {
            setLoading(false)
        }
    }, [activeTab, toast])

    useEffect(() => {
        fetchData()
        if (activeTab === 'price_list') {
            fetchLookups()
        }
    }, [activeTab, fetchData, fetchLookups])

    function handleAdd() {
        if (!canWrite) { toast.warning('Bạn không có quyền thêm mới trong tab này'); return }
        setEditingItem(null)
        setModalOpen(true)
    }

    function handleEdit(item) {
        if (!canWrite) { toast.warning('Bạn không có quyền chỉnh sửa trong tab này'); return }
        setEditingItem(item)
        setModalOpen(true)
    }

    async function handleDelete(item) {
        if (!canDelete) { toast.warning('Chỉ Admin mới được xóa'); return }
        setDeleteTarget(item)
    }

    async function confirmDelete() {
        if (!deleteTarget) return
        try {
            const table = activeTab === 'price_list' ? 'price_list' : activeTab
            const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id)
            if (error) throw error
            toast.success('Đã xóa thành công')
            fetchData()
        } catch (err) {
            toast.error('Lỗi xóa: ' + err.message)
        } finally {
            setDeleteTarget(null)
        }
    }

    async function handleSave(formData) {
        try {
            if (activeTab === 'price_list') {
                if (editingItem) {
                    // Version history: mark old record as not current, create new
                    await supabase.from('price_list').update({ is_current: false }).eq('id', editingItem.id)
                    const { error } = await supabase.from('price_list').insert({
                        ...formData,
                        is_current: true,
                    })
                    if (error) throw error
                    toast.success('Cập nhật giá thành công (bản cũ lưu lịch sử)')
                } else {
                    const { error } = await supabase.from('price_list').insert({
                        ...formData,
                        is_current: true,
                    })
                    if (error) throw error
                    toast.success('Thêm giá mới thành công')
                }
            } else {
                if (editingItem) {
                    const { error } = await supabase
                        .from(activeTab)
                        .update(formData)
                        .eq('id', editingItem.id)
                    if (error) throw error
                    toast.success('Cập nhật thành công')
                } else {
                    const { error } = await supabase
                        .from(activeTab)
                        .insert(formData)
                    if (error) throw error
                    toast.success('Thêm mới thành công')
                }
            }
            setModalOpen(false)
            fetchData()
        } catch (err) {
            toast.error('Lỗi: ' + err.message)
        }
    }

    async function showHistory(item) {
        setHistoryPanel({ product_name: item.product_name, product_code: item.product_code })
        const { data: hist } = await supabase
            .from('price_list')
            .select('*, products(code, name), suppliers(name)')
            .eq('product_id', item.product_id)
            .eq('supplier_id', item.supplier_id)
            .order('created_at', { ascending: false })
        setHistoryData(hist || [])
    }

    // Inline toggle active status (wireframe M2)
    async function handleToggleActive(item) {
        try {
            const table = activeTab
            const { error } = await supabase.from(table).update({ is_active: !item.is_active }).eq('id', item.id)
            if (error) throw error
            setData(prev => prev.map(d => d.id === item.id ? { ...d, is_active: !d.is_active } : d))
        } catch (err) {
            toast.error('Lỗi cập nhật trạng thái: ' + err.message)
        }
    }

    // ===== Import Excel Price List =====
    async function handleImportExcel(e) {
        const file = e.target.files?.[0]
        if (!file) return
        setImporting(true)

        try {
            const XLSX = (await import('xlsx')).default
            const buf = await file.arrayBuffer()
            const wb = XLSX.read(buf)
            const ws = wb.Sheets[wb.SheetNames[0]]
            const rows = XLSX.utils.sheet_to_json(ws)

            if (!rows.length) { toast.warning('File rỗng'); setImporting(false); return }

            // Map Vietnamese column names
            const mapCol = (row) => ({
                product_code: row['Mã SP'] || row['product_code'] || '',
                supplier_name: row['NCC'] || row['supplier_name'] || '',
                unit_price: row['Đơn giá'] || row['unit_price'] || 0,
                currency: row['Tiền tệ'] || row['currency'] || 'VND',
                price_ceiling: row['Giá trần'] || row['price_ceiling'] || null,
                price_floor: row['Giá sàn'] || row['price_floor'] || null,
                valid_from: row['Hiệu lực từ'] || row['valid_from'] || null,
                valid_to: row['Hiệu lực đến'] || row['valid_to'] || null,
            })

            // Ensure lookups are ready
            if (!products.length || !suppliers.length) await fetchLookups()

            let imported = 0, skipped = 0, errors = []
            const newPrices = []
            const deactivateKeys = []

            for (const rawRow of rows) {
                const row = mapCol(rawRow)
                if (!row.product_code || !row.unit_price) { skipped++; continue }

                const product = products.find(p => p.code === String(row.product_code).trim())
                if (!product) { skipped++; errors.push(`Code "${row.product_code}" không tìm thấy`); continue }

                let supplierId = null
                if (row.supplier_name) {
                    const supp = suppliers.find(s =>
                        s.name.toLowerCase().includes(String(row.supplier_name).trim().toLowerCase())
                    )
                    if (supp) supplierId = supp.id
                }

                if (supplierId) {
                    deactivateKeys.push({ product_id: product.id, supplier_id: supplierId })
                }

                const validFrom = row.valid_from || new Date().toISOString().split('T')[0]
                newPrices.push({
                    product_id: product.id, supplier_id: supplierId,
                    unit_price: Number(row.unit_price), currency: row.currency,
                    price_ceiling: row.price_ceiling ? Number(row.price_ceiling) : null,
                    price_floor: row.price_floor ? Number(row.price_floor) : null,
                    valid_from: validFrom, valid_to: row.valid_to || null,
                    effective_date: validFrom, is_current: true,
                })
                imported++
            }

            // A9: Batch operations — 2 queries instead of 2N
            // Step 1: Deactivate old prices for affected product-supplier pairs
            if (deactivateKeys.length > 0) {
                for (const key of deactivateKeys) {
                    await supabase.from('price_list')
                        .update({ is_current: false })
                        .eq('product_id', key.product_id)
                        .eq('supplier_id', key.supplier_id)
                        .eq('is_current', true)
                }
            }

            // Step 2: Batch insert all new prices
            if (newPrices.length > 0) {
                const { error } = await supabase.from('price_list').insert(newPrices)
                if (error) {
                    imported = 0
                    errors.push(error.message)
                }
            }

            if (imported > 0) toast.success(`Import xong: ${imported} dòng OK${skipped > 0 ? `, ${skipped} bỏ qua` : ''}`)
            else toast.warning(`Import: ${skipped} dòng bị bỏ qua`)
            if (errors.length) console.warn('Import errors:', errors)
            fetchData()
        } catch (err) {
            toast.error('Lỗi đọc file: ' + err.message)
        } finally {
            setImporting(false)
            e.target.value = ''
        }
    }

    // ===== Download Excel Template =====
    async function handleDownloadTemplate() {
        const XLSX = (await import('xlsx')).default
        const ws = XLSX.utils.aoa_to_sheet([
            ['Mã SP', 'NCC', 'Đơn giá', 'Tiền tệ', 'Giá trần', 'Giá sàn', 'Hiệu lực từ', 'Hiệu lực đến'],
            ['SP-001', 'Dräger Vietnam', 125000000, 'VND', 130000000, 120000000, '2026-01-01', '2026-12-31'],
        ])
        ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 14 }]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Bảng giá')
        XLSX.writeFile(wb, 'template_bang_gia.xlsx')
    }

    const tabConfig = TAB_CONFIGS[activeTab]

    return (
        <div>
            <PageHeader
                title="Danh mục dữ liệu"
                subtitle="Quản lý master data: sản phẩm, bệnh viện, NCC, đơn vị vận chuyển, bảng giá"
                icon={<Database size={20} />}
            />

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-1)',
                marginBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--border-secondary)',
                paddingBottom: 'var(--space-1)',
                flexWrap: 'wrap',
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => { setActiveTab(tab.key); setHistoryPanel(null) }}
                        style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                        <span style={{
                            fontSize: 'var(--font-xs)',
                            background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                        }}>
                            {activeTab === tab.key ? data.length : '—'}
                        </span>
                    </button>
                ))}
            </div>

            {/* Main content area */}
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <DataTable
                        columns={tabConfig.columns(handleEdit, handleDelete, activeTab === 'price_list' ? showHistory : handleToggleActive)}
                        data={activeFilter === 'all' ? data : data.filter(d => activeFilter === 'active' ? d.is_active : !d.is_active)}
                        loading={loading}
                        searchPlaceholder={tabConfig.searchPlaceholder}
                        emptyMessage={tabConfig.emptyMessage}
                        actions={
                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                {activeTab !== 'price_list' && (
                                    <select className="form-select"
                                        value={activeFilter}
                                        onChange={e => setActiveFilter(e.target.value)}
                                        style={{ width: 'auto', fontSize: 'var(--font-xs)', padding: '4px 28px 4px 8px', minWidth: 120 }}>
                                        <option value="all">Tất cả trạng thái</option>
                                        <option value="active">✅ Đang hoạt động</option>
                                        <option value="inactive">⛔ Ngừng hoạt động</option>
                                    </select>
                                )}
                                {activeTab === 'price_list' && (
                                    <>
                                        <label className="btn btn-ghost" style={{ cursor: 'pointer', position: 'relative' }}>
                                            <Upload size={16} />
                                            {importing ? 'Đang import...' : 'Import Excel'}
                                            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImportExcel} disabled={importing} />
                                        </label>
                                        <button className="btn btn-ghost" onClick={handleDownloadTemplate}>
                                            <Download size={16} /> Template
                                        </button>
                                    </>
                                )}
                                {canWrite && (
                                <button className="btn btn-primary" onClick={handleAdd}>
                                    <Plus size={16} /> Thêm {tabConfig.label}
                                </button>
                                )}
                            </div>
                        }
                    />
                </div>

                {/* Price History Side Panel */}
                {historyPanel && (
                    <div style={{
                        width: 360,
                        flexShrink: 0,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4)',
                        maxHeight: 'calc(100vh - 200px)',
                        overflowY: 'auto',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <div>
                                <h3 style={{ fontSize: 'var(--font-base)', margin: 0 }}>Lịch sử giá</h3>
                                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                                    {historyPanel.product_code} — {historyPanel.product_name}
                                </p>
                            </div>
                            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setHistoryPanel(null)}>
                                <X size={16} />
                            </button>
                        </div>

                        {historyData.length === 0 ? (
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>Chưa có lịch sử</p>
                        ) : (
                            <div style={{ position: 'relative', paddingLeft: 20 }}>
                                {/* Timeline line */}
                                <div style={{
                                    position: 'absolute', left: 6, top: 8, bottom: 8,
                                    width: 2, background: 'var(--primary-500)', opacity: 0.3,
                                }} />
                                {historyData.map((h, i) => (
                                    <div key={h.id} style={{
                                        position: 'relative', marginBottom: 'var(--space-4)',
                                        paddingBottom: 'var(--space-3)',
                                        borderBottom: i < historyData.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                                    }}>
                                        {/* Timeline dot */}
                                        <div style={{
                                            position: 'absolute', left: -17, top: 6,
                                            width: 10, height: 10, borderRadius: '50%',
                                            background: h.is_current ? 'var(--primary-500)' : 'var(--text-tertiary)',
                                            border: '2px solid var(--bg-secondary)',
                                        }} />
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                                            {new Date(h.created_at).toLocaleDateString('vi-VN')}
                                            {h.is_current && <span className="badge" style={{ marginLeft: 8, background: 'rgba(0,184,148,0.15)', color: 'var(--accent-500)', fontSize: 10 }}>Hiện hành</span>}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>
                                            {Number(h.unit_price).toLocaleString('vi-VN')} ₫
                                        </div>
                                        {h.price_ceiling && (
                                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                Trần: {Number(h.price_ceiling).toLocaleString('vi-VN')} ₫ | Sàn: {Number(h.price_floor).toLocaleString('vi-VN')} ₫
                                            </div>
                                        )}
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                            Hiệu lực: {h.valid_from ? new Date(h.valid_from).toLocaleDateString('vi-VN') : '—'}
                                            {' → '}{h.valid_to ? new Date(h.valid_to).toLocaleDateString('vi-VN') : '∞'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Side Panel (wireframe M1) */}
            {modalOpen && (
                <>
                    <div className="side-panel-overlay" onClick={() => setModalOpen(false)} />
                    <div className="side-panel">
                        <div className="side-panel-header">
                            <h3>{editingItem ? `Sửa ${tabConfig.label}` : `Thêm ${tabConfig.label} mới`}</h3>
                            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setModalOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="side-panel-body">
                            {activeTab === 'price_list' ? (
                                <PriceListForm
                                    item={editingItem}
                                    products={products}
                                    suppliers={suppliers}
                                    onSave={handleSave}
                                    onCancel={() => setModalOpen(false)}
                                />
                            ) : (
                                <FormComponent
                                    type={activeTab}
                                    item={editingItem}
                                    onSave={handleSave}
                                    onCancel={() => setModalOpen(false)}
                                />
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Delete Confirm Dialog */}
            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title="Xác nhận xóa"
                message={`Bạn có chắc chắn muốn xóa "${deleteTarget?.name || deleteTarget?.product_name || deleteTarget?.code || ''}"? Hành động này không thể hoàn tác.`}
                type="danger"
                confirmText="Xóa"
                cancelText="Hủy"
            />
        </div>
    )
}

// ---- Price List Form (special: dropdowns for product/supplier) ----
function PriceListForm({ item, products, suppliers, onSave, onCancel }) {
    const [form, setForm] = useState(() => {
        if (item) return {
            product_id: item.product_id || '',
            supplier_id: item.supplier_id || '',
            unit_price: item.unit_price || '',
            price_ceiling: item.price_ceiling || '',
            price_floor: item.price_floor || '',
            valid_from: item.valid_from || new Date().toISOString().split('T')[0],
            valid_to: item.valid_to || '',
            currency: item.currency || 'VND',
        }
        return {
            product_id: '', supplier_id: '', unit_price: '',
            price_ceiling: '', price_floor: '',
            valid_from: new Date().toISOString().split('T')[0], valid_to: '',
            currency: 'VND',
        }
    })
    const [saving, setSaving] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)
        const payload = { ...form }
            // Convert to numbers
            ;['unit_price', 'price_ceiling', 'price_floor'].forEach(k => {
                payload[k] = payload[k] ? Number(payload[k]) : null
            })
        payload.valid_to = payload.valid_to || null
        payload.effective_date = payload.valid_from
        await onSave(payload)
        setSaving(false)
    }

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label required">Sản phẩm</label>
                    <select className="form-select" value={form.product_id} onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))} required disabled={!!item}>
                        <option value="">Chọn sản phẩm...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                    </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label required">Nhà cung cấp</label>
                    <select className="form-select" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))} required disabled={!!item}>
                        <option value="">Chọn NCC...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label required">Đơn giá (VND)</label>
                    <input type="number" className="form-input" value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} required min="0" placeholder="0" />
                </div>
                <div className="form-group">
                    <label className="form-label">Tiền tệ</label>
                    <select className="form-select" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                        <option value="VND">VND</option>
                        <option value="USD">USD</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Giá trần</label>
                    <input type="number" className="form-input" value={form.price_ceiling} onChange={e => setForm(p => ({ ...p, price_ceiling: e.target.value }))} min="0" placeholder="Không giới hạn" />
                </div>
                <div className="form-group">
                    <label className="form-label">Giá sàn</label>
                    <input type="number" className="form-input" value={form.price_floor} onChange={e => setForm(p => ({ ...p, price_floor: e.target.value }))} min="0" placeholder="Không giới hạn" />
                </div>
                <div className="form-group">
                    <label className="form-label required">Hiệu lực từ</label>
                    <input type="date" className="form-input" value={form.valid_from} onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))} required />
                </div>
                <div className="form-group">
                    <label className="form-label">Hiệu lực đến</label>
                    <input type="date" className="form-input" value={form.valid_to} onChange={e => setForm(p => ({ ...p, valid_to: e.target.value }))} />
                </div>
            </div>

            {item && (
                <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(108,92,231,0.1)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--primary-400)' }}>
                    ℹ️ Khi sửa giá, hệ thống sẽ tạo bản ghi mới. Giá cũ được lưu vào lịch sử.
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-secondary)' }}>
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Đang lưu...</> : (item ? 'Cập nhật giá' : 'Thêm giá mới')}
                </button>
            </div>
        </form>
    )
}

// ---- Form Component (handles all entity types) ----
function FormComponent({ type, item, onSave, onCancel }) {
    const [form, setForm] = useState(() => getInitialForm(type, item))
    const [saving, setSaving] = useState(false)

    function handleChange(key, value) {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)
        await onSave(form)
        setSaving(false)
    }

    const fields = FORM_FIELDS[type] || []

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {fields.map(field => (
                    <div key={field.key} className="form-group">
                        <label className={`form-label ${field.required ? 'required' : ''}`}>
                            {field.label}
                        </label>
                        {field.type === 'select' ? (
                            <select
                                className="form-select"
                                value={form[field.key] || ''}
                                onChange={(e) => handleChange(field.key, e.target.value)}
                                required={field.required}
                            >
                                <option value="">Chọn...</option>
                                {field.options.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        ) : field.type === 'checkbox' ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={form[field.key] || false}
                                    onChange={(e) => handleChange(field.key, e.target.checked)}
                                    style={{ width: 18, height: 18 }}
                                />
                                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{field.checkLabel}</span>
                            </label>
                        ) : field.type === 'number' ? (
                            <input
                                type="number"
                                className="form-input"
                                value={form[field.key] ?? ''}
                                onChange={(e) => handleChange(field.key, e.target.value ? Number(e.target.value) : null)}
                                required={field.required}
                                min={field.min}
                                placeholder={field.placeholder}
                            />
                        ) : (
                            <input
                                type={field.type || 'text'}
                                className="form-input"
                                value={form[field.key] || ''}
                                onChange={(e) => handleChange(field.key, e.target.value)}
                                required={field.required}
                                placeholder={field.placeholder}
                            />
                        )}
                    </div>
                ))}
            </div>

            <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)',
                marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--border-secondary)',
            }}>
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Đang lưu...</> : 'Lưu'}
                </button>
            </div>
        </form>
    )
}

// ---- Initial form values ----
function getInitialForm(type, item) {
    if (item) {
        const copy = { ...item }
        delete copy.id
        delete copy.created_at
        delete copy.updated_at
        return copy
    }

    switch (type) {
        case 'products': return { code: '', name: '', manufacturer: '', packaging: '', unit: '', category: '', storage_condition: 'normal', medical_device_class: '', registration_number: '', safety_stock_qty: 0, is_active: true }
        case 'hospitals': return { name: '', address: '', contact_person: '', phone: '', province: '', is_active: true }
        case 'suppliers': return { name: '', tax_code: '', address: '', phone: '', email: '', contact_person: '', country: 'Vietnam', is_domestic: true, payment_terms: '', is_active: true }
        case 'carriers': return { name: '', phone: '', vehicle_type: '', has_cold_chain: false, is_active: true }
        case 'price_list': return { product_id: '', supplier_id: '', unit_price: '', price_ceiling: '', price_floor: '', valid_from: new Date().toISOString().split('T')[0], valid_to: '', currency: 'VND' }
        default: return {}
    }
}

// ---- Form field definitions ----
const FORM_FIELDS = {
    products: [
        { key: 'code', label: 'Code hàng', required: true, placeholder: 'VD: SP-001' },
        { key: 'name', label: 'Tên sản phẩm', required: true, placeholder: 'Nhập tên...' },
        { key: 'manufacturer', label: 'Hãng sản xuất', required: true, placeholder: 'VD: Dräger' },
        { key: 'packaging', label: 'Quy cách đóng gói', placeholder: 'VD: 1 máy/thùng' },
        { key: 'unit', label: 'Đơn vị tính', required: true, placeholder: 'Cái / Hộp / Bộ / Thùng' },
        { key: 'category', label: 'Danh mục', placeholder: 'VD: Thiết bị hô hấp' },
        {
            key: 'storage_condition', label: 'Điều kiện bảo quản', type: 'select', options: [
                { value: 'normal', label: '🏠 Thường' },
                { value: 'cool', label: '❄️ Mát (2-8°C)' },
                { value: 'cold', label: '🧊 Lạnh (-20°C)' },
            ]
        },
        {
            key: 'medical_device_class', label: 'Phân loại TBYT', type: 'select', options: [
                { value: '', label: 'Không áp dụng' },
                { value: 'A', label: 'Loại A' },
                { value: 'B', label: 'Loại B' },
                { value: 'C', label: 'Loại C' },
                { value: 'D', label: 'Loại D' },
            ]
        },
        { key: 'safety_stock_qty', label: 'Tồn kho an toàn', type: 'number', min: 0, placeholder: '0' },
        { key: 'is_active', label: 'Trạng thái', type: 'checkbox', checkLabel: 'Đang hoạt động' },
    ],
    hospitals: [
        { key: 'name', label: 'Tên bệnh viện', required: true, placeholder: 'VD: BV Đà Nẵng' },
        { key: 'province', label: 'Tỉnh/Thành phố', placeholder: 'VD: Đà Nẵng' },
        { key: 'address', label: 'Địa chỉ', placeholder: 'Nhập địa chỉ...' },
        { key: 'contact_person', label: 'Người liên hệ', placeholder: 'BS. Nguyễn Văn A' },
        { key: 'phone', label: 'Số điện thoại', placeholder: '0236-3xxx-xxx' },
        { key: 'is_active', label: 'Trạng thái', type: 'checkbox', checkLabel: 'Đang hoạt động' },
    ],
    suppliers: [
        { key: 'name', label: 'Tên NCC', required: true, placeholder: 'VD: Dräger Vietnam' },
        { key: 'tax_code', label: 'Mã số thuế', placeholder: '0123456789' },
        { key: 'country', label: 'Quốc gia', placeholder: 'VD: Germany' },
        { key: 'is_domestic', label: 'Loại NCC', type: 'checkbox', checkLabel: 'NCC nội địa (Việt Nam)' },
        { key: 'contact_person', label: 'Người liên hệ', placeholder: 'Ông/Bà...' },
        { key: 'phone', label: 'Số điện thoại', placeholder: '028-3xxx-xxx' },
        { key: 'email', label: 'Email', type: 'email', placeholder: 'order@company.vn' },
        { key: 'address', label: 'Địa chỉ', placeholder: 'Nhập địa chỉ...' },
        { key: 'payment_terms', label: 'Điều khoản TT', placeholder: 'VD: COD, TT 30 ngày, LC 90 ngày' },
        { key: 'is_active', label: 'Trạng thái', type: 'checkbox', checkLabel: 'Đang hoạt động' },
    ],
    carriers: [
        { key: 'name', label: 'Tên đơn vị VC', required: true, placeholder: 'VD: Vận tải Nội bộ MLM' },
        { key: 'phone', label: 'Số điện thoại', placeholder: '0902-xxx-xxx' },
        { key: 'vehicle_type', label: 'Loại xe', placeholder: 'VD: Xe tải 5T' },
        { key: 'has_cold_chain', label: 'Cold chain', type: 'checkbox', checkLabel: 'Có xe lạnh/mát' },
        { key: 'is_active', label: 'Trạng thái', type: 'checkbox', checkLabel: 'Đang hoạt động' },
    ],
}

// ---- Column definitions for DataTable ----
const TAB_CONFIGS = {
    products: {
        label: 'sản phẩm',
        searchPlaceholder: 'Tìm code, tên SP, hãng SX...',
        emptyMessage: 'Chưa có sản phẩm nào',
        columns: (onEdit, onDelete, onToggle) => [
            { key: 'code', label: 'Code', sortable: true, width: '100px', render: (v) => <code style={{ color: 'var(--primary-400)', fontSize: 'var(--font-xs)' }}>{v}</code> },
            { key: 'name', label: 'Tên sản phẩm', sortable: true },
            { key: 'manufacturer', label: 'Hãng SX', sortable: true },
            { key: 'unit', label: 'ĐVT', width: '70px' },
            { key: 'storage_condition', label: 'Bảo quản', width: '120px', render: (v) => <StorageBadge condition={v} /> },
            { key: 'safety_stock_qty', label: 'Tồn AT', sortable: true, width: '70px' },
            {
                key: 'is_active', label: 'Trạng thái', width: '90px',
                render: (v, row) => (
                    <label className="toggle-switch" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={!!v} onChange={() => onToggle?.(row)} />
                        <span className="toggle-slider" />
                    </label>
                ),
            },
            {
                key: 'actions', label: '', width: '80px',
                render: (_, row) => (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(row) }} title="Sửa">
                            <Edit2 size={14} />
                        </button>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(row) }} title="Xóa"
                            style={{ color: 'var(--red-400)' }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                ),
            },
        ],
    },
    hospitals: {
        label: 'bệnh viện',
        searchPlaceholder: 'Tìm tên BV, tỉnh...',
        emptyMessage: 'Chưa có bệnh viện nào',
        columns: (onEdit, onDelete, onToggle) => [
            { key: 'name', label: 'Tên bệnh viện', sortable: true },
            { key: 'province', label: 'Tỉnh/TP', sortable: true },
            { key: 'contact_person', label: 'Người liên hệ' },
            { key: 'phone', label: 'SĐT' },
            {
                key: 'is_active', label: 'Trạng thái', width: '90px',
                render: (v, row) => (
                    <label className="toggle-switch" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={!!v} onChange={() => onToggle?.(row)} />
                        <span className="toggle-slider" />
                    </label>
                ),
            },
            {
                key: 'actions', label: '', width: '80px',
                render: (_, row) => (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(row) }} title="Sửa"><Edit2 size={14} /></button>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(row) }} title="Xóa" style={{ color: 'var(--red-400)' }}><Trash2 size={14} /></button>
                    </div>
                ),
            },
        ],
    },
    suppliers: {
        label: 'NCC',
        searchPlaceholder: 'Tìm tên NCC, MST...',
        emptyMessage: 'Chưa có nhà cung cấp nào',
        columns: (onEdit, onDelete, onToggle) => [
            { key: 'name', label: 'Tên NCC', sortable: true },
            { key: 'country', label: 'Quốc gia', sortable: true },
            {
                key: 'is_domestic', label: 'Loại', width: '90px', render: (v) => (
                    <span className="badge" style={{
                        background: v ? 'rgba(0,184,148,0.15)' : 'rgba(9,132,227,0.15)',
                        color: v ? 'var(--accent-500)' : 'var(--blue-500)',
                    }}>{v ? '🇻🇳 Nội địa' : '🌏 Nước ngoài'}</span>
                )
            },
            { key: 'contact_person', label: 'Liên hệ' },
            { key: 'payment_terms', label: 'Điều khoản TT' },
            {
                key: 'is_active', label: 'Trạng thái', width: '90px',
                render: (v, row) => (
                    <label className="toggle-switch" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={!!v} onChange={() => onToggle?.(row)} />
                        <span className="toggle-slider" />
                    </label>
                ),
            },
            {
                key: 'actions', label: '', width: '80px',
                render: (_, row) => (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(row) }} title="Sửa"><Edit2 size={14} /></button>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(row) }} title="Xóa" style={{ color: 'var(--red-400)' }}><Trash2 size={14} /></button>
                    </div>
                ),
            },
        ],
    },
    carriers: {
        label: 'ĐV vận chuyển',
        searchPlaceholder: 'Tìm tên ĐV VC...',
        emptyMessage: 'Chưa có đơn vị vận chuyển nào',
        columns: (onEdit, onDelete, onToggle) => [
            { key: 'name', label: 'Tên ĐV VC', sortable: true },
            { key: 'phone', label: 'SĐT' },
            { key: 'vehicle_type', label: 'Loại xe' },
            {
                key: 'has_cold_chain', label: 'Cold chain', width: '100px', render: (v) => (
                    <span className="badge" style={{
                        background: v ? 'rgba(9,132,227,0.15)' : 'rgba(99,110,114,0.1)',
                        color: v ? 'var(--blue-500)' : 'var(--text-tertiary)',
                    }}>{v ? '❄️ Có' : '— Không'}</span>
                )
            },
            {
                key: 'is_active', label: 'Trạng thái', width: '90px',
                render: (v, row) => (
                    <label className="toggle-switch" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={!!v} onChange={() => onToggle?.(row)} />
                        <span className="toggle-slider" />
                    </label>
                ),
            },
            {
                key: 'actions', label: '', width: '80px',
                render: (_, row) => (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(row) }} title="Sửa"><Edit2 size={14} /></button>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(row) }} title="Xóa" style={{ color: 'var(--red-400)' }}><Trash2 size={14} /></button>
                    </div>
                ),
            },
        ],
    },
    price_list: {
        label: 'bảng giá',
        searchPlaceholder: 'Tìm mã SP, tên SP, NCC...',
        emptyMessage: 'Chưa có giá nào trong bảng giá',
        columns: (onEdit, onDelete, onHistory) => [
            { key: 'product_code', label: 'Mã SP', sortable: true, width: '90px', render: (v) => <code style={{ color: 'var(--primary-400)', fontSize: 'var(--font-xs)' }}>{v}</code> },
            { key: 'product_name', label: 'Tên sản phẩm', sortable: true },
            { key: 'supplier_name', label: 'Nhà cung cấp', sortable: true },
            { key: 'unit_price', label: 'Đơn giá (VND)', sortable: true, width: '130px', render: (v) => v ? Number(v).toLocaleString('vi-VN') + ' ₫' : '—' },
            { key: 'price_ceiling', label: 'Giá trần', width: '110px', render: (v) => v ? Number(v).toLocaleString('vi-VN') + ' ₫' : '—' },
            { key: 'price_floor', label: 'Giá sàn', width: '110px', render: (v) => v ? Number(v).toLocaleString('vi-VN') + ' ₫' : '—' },
            {
                key: 'valid_from', label: 'Hiệu lực', width: '170px',
                render: (v, row) => {
                    const from = v ? new Date(v).toLocaleDateString('vi-VN') : ''
                    const to = row.valid_to ? new Date(row.valid_to).toLocaleDateString('vi-VN') : '∞'
                    return <span style={{ fontSize: 'var(--font-xs)' }}>{from} → {to}</span>
                }
            },
            {
                key: 'is_current', label: 'Trạng thái', width: '100px',
                render: (v) => (
                    <span className="badge" style={{
                        background: v ? 'rgba(0,184,148,0.15)' : 'rgba(99,110,114,0.1)',
                        color: v ? 'var(--accent-500)' : 'var(--text-tertiary)',
                    }}>{v ? '✅ Hiện hành' : '⏸️ Hết hạn'}</span>
                )
            },
            {
                key: 'actions', label: '', width: '100px',
                render: (_, row) => (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(row) }} title="Sửa giá">
                            <Edit2 size={14} />
                        </button>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onHistory?.(row) }} title="Lịch sử giá"
                            style={{ color: 'var(--primary-400)' }}>
                            <History size={14} />
                        </button>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(row) }} title="Xóa"
                            style={{ color: 'var(--red-400)' }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                ),
            },
        ],
    },
}
