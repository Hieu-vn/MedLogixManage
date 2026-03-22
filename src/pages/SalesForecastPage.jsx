import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth, ROLES } from '../lib/auth'
import { useToast } from '../components/Toast'
import { useSalesForecasts, useProducts, useHospitals } from '../hooks/useSupabaseQuery'
import { daysFromNow, toISOString } from '../lib/dateUtils'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { generateCode, formatDate } from '../lib/helpers'
import { useExport } from '../hooks/useExport'
import {
    Plus, Eye, Edit2, Trash2, Send, FileText,
    Search, X, CheckCircle, XCircle, Package,
    ChevronDown, Clock, AlertTriangle, Download
} from 'lucide-react'

// Business Rule: PR purpose types (câu hỏi hệ thống PDF)
const PR_PURPOSES = [
    { key: 'ban_moi', label: 'Bán mới', color: '#0984E3', icon: '🛒' },
    { key: 'muon_demo', label: 'Mượn / Demo', color: '#6C5CE7', icon: '🔬' },
    { key: 'tang', label: 'Tặng', color: '#00B894', icon: '🎁' },
]

export default function SalesForecastPage() {
    const { profile, isRole } = useAuth()
    const toast = useToast()
    const queryClient = useQueryClient()
    const [modalOpen, setModalOpen] = useState(false)
    const [viewModalOpen, setViewModalOpen] = useState(false)
    const [editingForecast, setEditingForecast] = useState(null)
    const [viewingForecast, setViewingForecast] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [confirmDelete, setConfirmDelete] = useState(null)

    // P1+P2: Correct role-based permission flags
    const canCreate = isRole(ROLES.SALES, ROLES.SALES_MANAGER, ROLES.ADMIN)
    const canApproveReject = isRole(ROLES.SALES_MANAGER, ROLES.LOGISTICS_MANAGER, ROLES.DIRECTOR, ROLES.ADMIN)
    const { exportExcel, exportPDF } = useExport()

    // React Query: auto-cached forecast list
    const { data: forecasts = [], isLoading: loading, refetch: fetchForecasts } = useSalesForecasts(statusFilter)

    function handleCreate() {
        setEditingForecast(null)
        setModalOpen(true)
    }

    function handleEdit(forecast) {
        if (forecast.status !== 'draft') {
            toast.warning('Chỉ sửa được phiếu ở trạng thái Nháp')
            return
        }
        setEditingForecast(forecast)
        setModalOpen(true)
    }

    function handleView(forecast) {
        setViewingForecast(forecast)
        setViewModalOpen(true)
    }

    function handleDelete(forecast) {
        if (forecast.status !== 'draft') {
            toast.warning('Chỉ xóa được phiếu ở trạng thái Nháp')
            return
        }
        setConfirmDelete(forecast)
    }

    async function confirmDeleteForecast() {
        if (!confirmDelete) return
        try {
            const { error } = await supabase.from('sales_forecasts').delete().eq('id', confirmDelete.id)
            if (error) throw error
            toast.success('Đã xóa phiếu')
            fetchForecasts()
        } catch (err) {
            toast.error('Lỗi xóa: ' + err.message)
        } finally {
            setConfirmDelete(null)
        }
    }

    async function handleSubmit(forecast) {
        if (forecast.sales_forecast_items?.length === 0) {
            toast.warning('Phiếu chưa có sản phẩm nào!')
            return
        }
        try {
            const { error } = await supabase
                .from('sales_forecasts')
                .update({ status: 'pending', updated_at: new Date().toISOString() })
                .eq('id', forecast.id)
            if (error) throw error
            toast.success(`Đã gửi phiếu ${forecast.code} cho QL Sales duyệt`)
            fetchForecasts()
        } catch (err) {
            toast.error('Lỗi gửi: ' + err.message)
        }
    }

    async function handleApprove(forecast) {
        // P3: Role guard — only authorized roles can approve
        if (!canApproveReject) { toast.error('Không có quyền duyệt phiếu'); return }
        try {
            const { error } = await supabase
                .from('sales_forecasts')
                .update({
                    status: 'approved',
                    approved_by: profile.id,
                    approved_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', forecast.id)
            if (error) throw error
            toast.success(`Đã duyệt phiếu ${forecast.code}`)
            fetchForecasts()
            setViewModalOpen(false)
        } catch (err) {
            toast.error('Lỗi duyệt: ' + err.message)
        }
    }

    async function handleReject(forecast, reason) {
        // P3: Role guard — only authorized roles can reject
        if (!canApproveReject) { toast.error('Không có quyền từ chối phiếu'); return }
        try {
            const { error } = await supabase
                .from('sales_forecasts')
                .update({
                    status: 'rejected',
                    rejection_reason: reason,
                    approved_by: profile.id,
                    approved_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', forecast.id)
            if (error) throw error
            toast.success(`Đã từ chối phiếu ${forecast.code}`)
            fetchForecasts()
            setViewModalOpen(false)
        } catch (err) {
            toast.error('Lỗi từ chối: ' + err.message)
        }
    }

    const filteredForecasts = statusFilter === 'all'
        ? forecasts
        : statusFilter === 'stale'
        ? forecasts.filter(f => {
            if (f.status !== 'pending') return false
            const days = Math.floor((Date.now() - new Date(f.updated_at || f.created_at).getTime()) / (1000 * 60 * 60 * 24))
            return days > 3
        })
        : forecasts.filter(f => f.status === statusFilter)

    // Stale PR helper: pending > 3 days
    function getStaleDays(forecast) {
        if (forecast.status !== 'pending') return 0
        return Math.floor((Date.now() - new Date(forecast.updated_at || forecast.created_at).getTime()) / (1000 * 60 * 60 * 24))
    }
    const staleCount = forecasts.filter(f => getStaleDays(f) > 3).length

    const columns = [
        {
            key: 'code', label: 'Mã phiếu', sortable: true, width: '130px',
            render: (v) => <code style={{ color: 'var(--primary-400)', fontSize: 'var(--font-xs)' }}>{v}</code>,
        },
        { key: 'title', label: 'Tiêu đề', sortable: true },
        {
            key: 'purpose', label: 'Mục đích', width: '120px',
            render: (v) => {
                const p = PR_PURPOSES.find(p => p.key === v)
                if (!p) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                return (
                    <span className="status-badge" style={{ background: `${p.color}20`, color: p.color, fontSize: 'var(--font-xs)' }}>
                        {p.icon} {p.label}
                    </span>
                )
            },
        },
        {
            key: 'creator', label: 'Người tạo', width: '140px',
            render: (v) => v?.full_name || '—',
        },
        {
            key: 'request_date', label: 'Ngày tạo', sortable: true, width: '110px',
            render: (v) => formatDate(v),
        },
        {
            key: 'sales_forecast_items', label: 'Số SP', width: '70px',
            render: (v) => (
                <span style={{
                    background: 'var(--bg-tertiary)', padding: '2px 8px',
                    borderRadius: 'var(--radius-full)', fontSize: 'var(--font-xs)', fontWeight: 600,
                }}>{v?.length || 0}</span>
            ),
        },
        {
            key: 'status', label: 'Trạng thái', width: '160px',
            render: (v, row) => {
                const staleDays = getStaleDays(row)
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <StatusBadge status={v} />
                        {staleDays > 3 && (
                            <span style={{
                                fontSize: '0.625rem', fontWeight: 700,
                                color: '#fff', background: '#D63031',
                                padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                whiteSpace: 'nowrap', animation: 'pulse 2s infinite',
                            }}>
                                🕐 {staleDays}d
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            key: 'actions', label: '', width: '140px',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleView(row) }} title="Xem">
                        <Eye size={14} />
                    </button>
                    {row.status === 'draft' && canCreate && (
                        <>
                            <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleEdit(row) }} title="Sửa">
                                <Edit2 size={14} />
                            </button>
                            <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleSubmit(row) }} title="Gửi duyệt"
                                style={{ color: 'var(--accent-500)' }}>
                                <Send size={14} />
                            </button>
                            <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(row) }} title="Xóa"
                                style={{ color: 'var(--red-400)' }}>
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                </div>
            ),
        },
    ]

    return (
        <div>
            <PageHeader
                title="Dự trù từ Sales"
                subtitle="Tạo và quản lý phiếu dự trù thiết bị/vật tư y tế"
                icon={<FileText size={20} />}
                actions={
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {canCreate && (
                            <button className="btn btn-primary" onClick={handleCreate}>
                                <Plus size={16} /> Tạo phiếu mới
                            </button>
                        )}
                        <button className="btn btn-ghost" onClick={() => exportExcel(
                            [{ key: 'code', label: 'Mã phiếu' }, { key: 'title', label: 'Tiêu đề' },
                             { key: 'purpose', label: 'Mục đích', exportRender: v => PR_PURPOSES.find(p => p.key === v)?.label || '' },
                             { key: 'status', label: 'Trạng thái' }],
                            filteredForecasts, 'du_tru_sales', 'Sales Forecast'
                        )}>
                            <Download size={14} /> Excel
                        </button>
                        <button className="btn btn-ghost" onClick={() => exportPDF(
                            [{ key: 'code', label: 'Mã phiếu' }, { key: 'title', label: 'Tiêu đề' },
                             { key: 'purpose', label: 'Mục đích', exportRender: v => PR_PURPOSES.find(p => p.key === v)?.label || '' },
                             { key: 'status', label: 'Trạng thái' }],
                            filteredForecasts, 'Danh sách Dự Trù Sales', 'du_tru_sales'
                        )}>
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
                    { label: 'Tổng phiếu', value: forecasts.length, color: '#6C5CE7', icon: <FileText size={18} /> },
                    { label: 'Nháp', value: forecasts.filter(f => f.status === 'draft').length, color: '#718096', icon: <Edit2 size={18} /> },
                    { label: 'Chờ duyệt', value: forecasts.filter(f => f.status === 'pending').length, color: '#FDCB6E', icon: <Clock size={18} /> },
                    { label: 'Đã duyệt', value: forecasts.filter(f => f.status === 'approved').length, color: '#00B894', icon: <CheckCircle size={18} /> },
                    { label: 'Từ chối', value: forecasts.filter(f => f.status === 'rejected').length, color: '#E17055', icon: <XCircle size={18} /> },
                    { label: '⚠️ PR Treo', value: staleCount, color: '#D63031', icon: <AlertTriangle size={18} /> },
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

            {/* Status Filter Chips */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                {[
                    { key: 'all', label: 'Tất cả', count: forecasts.length },
                    { key: 'draft', label: '📝 Nháp', count: forecasts.filter(f => f.status === 'draft').length },
                    { key: 'pending', label: '⏳ Chờ duyệt', count: forecasts.filter(f => f.status === 'pending').length },
                    { key: 'stale', label: '🔴 PR Treo >3d', count: staleCount },
                    { key: 'approved', label: '✅ Đã duyệt', count: forecasts.filter(f => f.status === 'approved').length },
                    { key: 'rejected', label: '❌ Từ chối', count: forecasts.filter(f => f.status === 'rejected').length },
                ].map(chip => (
                    <button
                        key={chip.key}
                        className={`btn btn-sm ${statusFilter === chip.key ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setStatusFilter(chip.key)}
                    >
                        {chip.label} ({chip.count})
                    </button>
                ))}
            </div>


            <DataTable
                columns={columns}
                data={filteredForecasts}
                loading={loading}
                searchPlaceholder="Tìm mã phiếu, tiêu đề..."
                searchKeys={['code', 'title']}
                emptyMessage="Chưa có phiếu dự trù nào"
                exportable
                exportFilename="du_tru_sales"
            />

            {/* Create/Edit Modal */}
            <ForecastFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                forecast={editingForecast}
                onSaved={() => { setModalOpen(false); fetchForecasts() }}
                profile={profile}
            />

            {/* View/Approve Modal */}
            <ForecastViewModal
                isOpen={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                forecast={viewingForecast}
                isManager={canApproveReject}
                onApprove={handleApprove}
                onReject={handleReject}
            />

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={confirmDeleteForecast}
                title="Xóa phiếu dự trù"
                message={`Bạn có chắc muốn xóa phiếu ${confirmDelete?.code}? Hành động này không thể hoàn tác.`}
                type="danger"
                confirmText="Xóa"
            />
        </div>
    )
}

// ========================================
// Forecast Form Modal (Create/Edit)
// ========================================
function ForecastFormModal({ isOpen, onClose, forecast, onSaved, profile }) {
    const toast = useToast()
    const queryClient = useQueryClient()
    // React Hook Form for header fields
    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        defaultValues: { title: '', notes: '', purpose: '' },
    })
    const [items, setItems] = useState([])
    const [saving, setSaving] = useState(false)
    // FR-1.2: Duplicate warning state
    const [duplicateWarning, setDuplicateWarning] = useState(null)
    const [pendingSubmitData, setPendingSubmitData] = useState(null)

    // React Query: cached product/hospital lists
    const { data: products = [] } = useProducts({ enabled: isOpen })
    const { data: hospitals = [] } = useHospitals({ enabled: isOpen })

    useEffect(() => {
        if (isOpen) {
            if (forecast) {
                reset({ title: forecast.title || '', notes: forecast.notes || '', purpose: forecast.purpose || '' })
                setItems(forecast.sales_forecast_items?.map(item => ({
                    id: item.id,
                    product_id: item.product?.id || '',
                    hospital_id: item.hospital?.id || '',
                    quantity: item.quantity || 1,
                    needed_date: item.needed_date || '',
                    notes: item.notes || '',
                    _productName: item.product?.name || '',
                    _hospitalName: item.hospital?.name || '',
                })) || [])
            } else {
                reset({ title: '', notes: '', purpose: '' })
                setItems([])
            }
            setDuplicateWarning(null)
            setPendingSubmitData(null)
        }
    }, [isOpen, forecast, reset])

    function addItem() {
        setItems(prev => [...prev, {
            product_id: '', hospital_id: '', quantity: 1,
            needed_date: daysFromNow(7),
            notes: '',
        }])
    }

    function updateItem(index, key, value) {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item))
    }

    function removeItem(index) {
        setItems(prev => prev.filter((_, i) => i !== index))
    }

    function checkDuplicate(productId, hospitalId, currentIndex) {
        return items.some((item, i) =>
            i !== currentIndex && item.product_id === productId && item.hospital_id === hospitalId
        )
    }

    // FR-1.2: Cross-forecast duplicate check
    async function checkCrossDuplicates(formData) {
        try {
            // Query active forecasts (not rejected/cancelled) for same product+hospital
            const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))]
            const hospitalIds = [...new Set(items.map(i => i.hospital_id).filter(Boolean))]
            if (productIds.length === 0 || hospitalIds.length === 0) return []

            const { data: existingItems } = await supabase
                .from('sales_forecast_items')
                .select(`
                    product_id, hospital_id,
                    product:products(name, code),
                    hospital:hospitals(name),
                    forecast:forecast_id(id, code, status, title)
                `)
                .in('product_id', productIds)
                .in('hospital_id', hospitalIds)

            if (!existingItems) return []

            // Filter: only active forecasts, exclude current forecast if editing
            const duplicates = existingItems.filter(e => {
                if (!e.forecast) return false
                if (['rejected', 'cancelled'].includes(e.forecast.status)) return false
                if (forecast && e.forecast.id === forecast.id) return false
                return items.some(i => i.product_id === e.product_id && i.hospital_id === e.hospital_id)
            })

            return duplicates
        } catch {
            return [] // Don't block save on check failure
        }
    }

    async function onFormSubmit(formData) {
        // Validate items
        if (items.length === 0) { toast.warning('Vui lòng thêm ít nhất 1 sản phẩm'); return }
        for (let i = 0; i < items.length; i++) {
            if (!items[i].product_id) { toast.warning(`Dòng ${i + 1}: Chưa chọn sản phẩm`); return }
            if (!items[i].hospital_id) { toast.warning(`Dòng ${i + 1}: Chưa chọn bệnh viện`); return }
            if (!items[i].quantity || items[i].quantity < 1) { toast.warning(`Dòng ${i + 1}: Số lượng phải > 0`); return }
            if (!items[i].needed_date) { toast.warning(`Dòng ${i + 1}: Chưa chọn ngày cần hàng`); return }
        }

        // FR-1.2: Check cross-forecast duplicates
        const dupes = await checkCrossDuplicates(formData)
        if (dupes.length > 0 && !pendingSubmitData) {
            setDuplicateWarning(dupes)
            setPendingSubmitData(formData)
            return
        }

        await executeSave(formData)
    }

    async function confirmDuplicateAndSave() {
        if (pendingSubmitData) {
            await executeSave(pendingSubmitData)
            setDuplicateWarning(null)
            setPendingSubmitData(null)
        }
    }

    async function executeSave(formData) {
        const { title, notes } = formData
        setSaving(true)
        try {
            if (forecast) {
                const { error: updateErr } = await supabase
                    .from('sales_forecasts')
                    .update({ title, notes, updated_at: toISOString() })
                    .eq('id', forecast.id)
                if (updateErr) throw updateErr

                const { data: existingItems } = await supabase.from('sales_forecast_items')
                    .select('id, product_id, hospital_id').eq('forecast_id', forecast.id)

                const newItems = items.map(item => ({
                    forecast_id: forecast.id,
                    product_id: item.product_id,
                    hospital_id: item.hospital_id,
                    quantity: Number(item.quantity),
                    needed_date: item.needed_date,
                    notes: item.notes,
                }))

                const incomingKeys = new Set(items.map(i => `${i.product_id}_${i.hospital_id}`))
                const toDelete = (existingItems || []).filter(e => !incomingKeys.has(`${e.product_id}_${e.hospital_id}`))
                if (toDelete.length > 0) {
                    await supabase.from('sales_forecast_items')
                        .delete().in('id', toDelete.map(d => d.id))
                }

                const { error: itemsErr } = await supabase.from('sales_forecast_items').upsert(newItems, {
                    onConflict: 'forecast_id,product_id,hospital_id',
                    ignoreDuplicates: false,
                })
                if (itemsErr) {
                    await supabase.from('sales_forecast_items').delete().eq('forecast_id', forecast.id)
                    const { error: fallbackErr } = await supabase.from('sales_forecast_items').insert(newItems)
                    if (fallbackErr) throw fallbackErr
                }

                toast.success('Cập nhật phiếu thành công')
            } else {
                const code = generateCode('SF')
                const { data: newForecast, error: createErr } = await supabase
                    .from('sales_forecasts')
                    .insert({ code, title, notes, purpose: formData.purpose || null, created_by: profile.id, sales_person: profile.id, status: 'draft' })
                    .select()
                    .single()
                if (createErr) throw createErr

                const newItems = items.map(item => ({
                    forecast_id: newForecast.id,
                    product_id: item.product_id,
                    hospital_id: item.hospital_id,
                    quantity: Number(item.quantity),
                    needed_date: item.needed_date,
                    notes: item.notes,
                }))
                const { error: itemsErr } = await supabase.from('sales_forecast_items').insert(newItems)
                if (itemsErr) throw itemsErr

                toast.success(`Tạo phiếu ${code} thành công`)
            }
            // Invalidate react-query cache so list refreshes
            queryClient.invalidateQueries({ queryKey: ['sales_forecasts'] })
            onSaved()
        } catch (err) {
            toast.error('Lỗi: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <>
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={forecast ? `Sửa phiếu: ${forecast.code}` : 'Tạo phiếu dự trù mới'}
            size="xl"
            footer={
                <>
                    <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
                    <button className="btn btn-primary" onClick={handleSubmit(onFormSubmit)} disabled={saving}>
                        {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Đang lưu...</> : 'Lưu phiếu'}
                    </button>
                </>
            }
        >
            {/* Header Fields — react-hook-form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="form-group">
                    <label className="form-label required">Tiêu đề phiếu</label>
                    <input
                        className={`form-input ${errors.title ? 'form-input-error' : ''}`}
                        {...register('title', { required: 'Vui lòng nhập tiêu đề phiếu' })}
                        placeholder="VD: Dự trù tháng 3/2026 - BV Đà Nẵng"
                    />
                    {errors.title && <span style={{ color: '#E17055', fontSize: 'var(--font-xs)', marginTop: 4 }}>{errors.title.message}</span>}
                </div>
                <div className="form-group">
                    <label className="form-label required">Mục đích</label>
                    <select className="form-input" {...register('purpose', { required: 'Chọn mục đích' })}>
                        <option value="">-- Chọn mục đích --</option>
                        {PR_PURPOSES.map(p => (
                            <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
                        ))}
                    </select>
                    {errors.purpose && <span style={{ color: '#E17055', fontSize: 'var(--font-xs)', marginTop: 4 }}>{errors.purpose.message}</span>}
                </div>
                <div className="form-group">
                    <label className="form-label">Ghi chú</label>
                    <input
                        className="form-input"
                        {...register('notes')}
                        placeholder="Ghi chú thêm..."
                    />
                </div>
            </div>

            {/* Items Table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h4 style={{ fontSize: 'var(--font-md)' }}>
                    <Package size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Danh sách sản phẩm ({items.length})
                </h4>
                <button className="btn btn-success btn-sm" onClick={addItem}>
                    <Plus size={14} /> Thêm dòng
                </button>
            </div>

            {items.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: 'var(--space-8)',
                    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                    color: 'var(--text-tertiary)',
                }}>
                    Chưa có sản phẩm nào. Click "Thêm dòng" để bắt đầu.
                </div>
            ) : (
                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th>Sản phẩm</th>
                                <th>Bệnh viện</th>
                                <th style={{ width: '90px' }}>Số lượng</th>
                                <th style={{ width: '140px' }}>Ngày cần hàng</th>
                                <th style={{ width: '160px' }}>Ghi chú</th>
                                <th style={{ width: '40px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => {
                                const isDuplicate = item.product_id && item.hospital_id && checkDuplicate(item.product_id, item.hospital_id, index)
                                return (
                                    <tr key={index} style={isDuplicate ? { background: 'rgba(214,48,49,0.08)' } : {}}>
                                        <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{index + 1}</td>
                                        <td>
                                            <select
                                                className="form-select"
                                                value={item.product_id}
                                                onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                                style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}
                                            >
                                                <option value="">Chọn SP...</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                                                ))}
                                            </select>
                                            {isDuplicate && <div style={{ color: 'var(--red-400)', fontSize: '0.625rem', marginTop: '2px' }}>⚠ Trùng SP + BV</div>}
                                        </td>
                                        <td>
                                            <select
                                                className="form-select"
                                                value={item.hospital_id}
                                                onChange={(e) => updateItem(index, 'hospital_id', e.target.value)}
                                                style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}
                                            >
                                                <option value="">Chọn BV...</option>
                                                {hospitals.map(h => (
                                                    <option key={h.id} value={h.id}>{h.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={item.quantity}
                                                min={1}
                                                onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                                style={{ fontSize: 'var(--font-xs)', padding: '4px 8px', textAlign: 'center' }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={item.needed_date}
                                                onChange={(e) => updateItem(index, 'needed_date', e.target.value)}
                                                style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                className="form-input"
                                                value={item.notes || ''}
                                                onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                                placeholder="..."
                                                style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-icon btn-ghost btn-sm"
                                                onClick={() => removeItem(index)}
                                                style={{ color: 'var(--red-400)' }}
                                                title="Xóa dòng"
                                            >
                                                <X size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>

        {/* FR-1.2: Cross-forecast duplicate warning */}
        {duplicateWarning && duplicateWarning.length > 0 && (
            <div className="modal-overlay" style={{ zIndex: 1100 }}>
                <div className="modal" style={{ maxWidth: 540 }}>
                    <div className="modal-header">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={20} style={{ color: '#FDCB6E' }} />
                            Cảnh báo trùng lặp
                        </h2>
                        <button className="btn btn-icon btn-ghost" onClick={() => { setDuplicateWarning(null); setPendingSubmitData(null) }}>
                            <X size={18} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <p style={{ marginBottom: 'var(--space-3)' }}>
                            Các sản phẩm sau đã tồn tại trong phiếu dự trù khác:
                        </p>
                        <div className="table-container" style={{ maxHeight: 200, overflowY: 'auto' }}>
                            <table>
                                <thead><tr>
                                    <th>Sản phẩm</th>
                                    <th>Bệnh viện</th>
                                    <th>Phiếu</th>
                                    <th>Trạng thái</th>
                                </tr></thead>
                                <tbody>
                                    {duplicateWarning.map((d, i) => (
                                        <tr key={i}>
                                            <td>{d.product?.code || '—'}</td>
                                            <td>{d.hospital?.name || '—'}</td>
                                            <td><strong>{d.forecast?.code}</strong></td>
                                            <td><StatusBadge status={d.forecast?.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p style={{ marginTop: 'var(--space-3)', color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>
                            Bạn vẫn muốn tiếp tục lưu phiếu?
                        </p>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-ghost" onClick={() => { setDuplicateWarning(null); setPendingSubmitData(null) }}>
                            Quay lại sửa
                        </button>
                        <button className="btn btn-warning" onClick={confirmDuplicateAndSave}>
                            <AlertTriangle size={14} /> Tiếp tục lưu
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}

// ========================================
// Forecast View Modal (View + Approve/Reject)
// ========================================
function ForecastViewModal({ isOpen, onClose, forecast, isManager, onApprove, onReject }) {
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectForm, setShowRejectForm] = useState(false)

    if (!isOpen || !forecast) return null

    const items = forecast.sales_forecast_items || []
    const canApprove = isManager && forecast.status === 'pending'

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { onClose(); setShowRejectForm(false); setRejectReason('') }}
            title={`Phiếu: ${forecast.code}`}
            size="xl"
            footer={
                canApprove ? (
                    showRejectForm ? (
                        <>
                            <input
                                className="form-input"
                                placeholder="Lý do từ chối..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                style={{ flex: 1, marginRight: 'var(--space-2)' }}
                                autoFocus
                            />
                            <button className="btn btn-ghost" onClick={() => setShowRejectForm(false)}>Hủy</button>
                            <button className="btn btn-danger" onClick={() => { onReject(forecast, rejectReason); setShowRejectForm(false) }}
                                disabled={!rejectReason.trim()}>
                                <XCircle size={16} /> Xác nhận từ chối
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
                            <button className="btn btn-danger" onClick={() => setShowRejectForm(true)}>
                                <XCircle size={16} /> Từ chối
                            </button>
                            <button className="btn btn-success" onClick={() => onApprove(forecast)}>
                                <CheckCircle size={16} /> Duyệt phiếu
                            </button>
                        </>
                    )
                ) : (
                    <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
                )
            }
        >
            {/* Header Info */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-4)', marginBottom: 'var(--space-5)',
                padding: 'var(--space-4)', background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
            }}>
                <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Tiêu đề</div>
                    <div style={{ fontWeight: 600 }}>{forecast.title}</div>
                </div>
                <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Người tạo</div>
                    <div style={{ fontWeight: 600 }}>{forecast.creator?.full_name || '—'}</div>
                </div>
                <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Ngày tạo</div>
                    <div style={{ fontWeight: 600 }}>{formatDate(forecast.request_date)}</div>
                </div>
                <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Trạng thái</div>
                    <div><StatusBadge status={forecast.status} /></div>
                </div>
                {forecast.status === 'rejected' && forecast.rejection_reason && (
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--red-400)' }}>Lý do từ chối</div>
                        <div style={{ fontWeight: 600, color: 'var(--red-400)' }}>{forecast.rejection_reason}</div>
                    </div>
                )}
                {forecast.approver && (
                    <div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Người duyệt</div>
                        <div style={{ fontWeight: 600 }}>{forecast.approver.full_name}</div>
                    </div>
                )}
            </div>

            {/* Items Table */}
            <h4 style={{ fontSize: 'var(--font-md)', marginBottom: 'var(--space-3)' }}>
                Danh sách sản phẩm ({items.length})
            </h4>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th>Sản phẩm</th>
                            <th>Bệnh viện</th>
                            <th style={{ width: '80px' }}>SL</th>
                            <th style={{ width: '120px' }}>Ngày cần</th>
                            <th>Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, i) => (
                            <tr key={item.id}>
                                <td style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                                <td>
                                    <div style={{ fontWeight: 500 }}>{item.product?.name || '—'}</div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{item.product?.code} • {item.product?.unit}</div>
                                </td>
                                <td>{item.hospital?.name || '—'}</td>
                                <td style={{ fontWeight: 600, textAlign: 'center' }}>{item.quantity}</td>
                                <td>{formatDate(item.needed_date)}</td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>{item.notes || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {forecast.notes && (
                <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                    <strong>Ghi chú chung:</strong> {forecast.notes}
                </div>
            )}
        </Modal>
    )
}
