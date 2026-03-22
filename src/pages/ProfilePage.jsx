import { useState, useEffect } from 'react'
import { useAuth, ROLE_LABELS, ROLE_COLORS, MODULE_ACCESS } from '../lib/auth'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import {
    User, Shield, Mail, Phone,
    Edit2, Save, X, Key, CheckCircle, Bell, BellOff,
    Clock, Monitor, UserCircle
} from 'lucide-react'

export default function ProfilePage() {
    const { profile, signOut } = useAuth()
    const toast = useToast()
    const [activeTab, setActiveTab] = useState('info')
    const [editing, setEditing] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)
    const [formData, setFormData] = useState({})
    const [pwData, setPwData] = useState({ current: '', newPw: '', confirm: '' })
    const [saving, setSaving] = useState(false)
    const [notifSettings, setNotifSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('notif_settings')
            return saved ? JSON.parse(saved) : {
                po_pending: true, overdue: true, expiring: true, low_stock: true,
            }
        } catch {
            return { po_pending: true, overdue: true, expiring: true, low_stock: true }
        }
    })

    // Persist notification settings to localStorage
    useEffect(() => {
        localStorage.setItem('notif_settings', JSON.stringify(notifSettings))
    }, [notifSettings])

    function startEdit() {
        setFormData({ full_name: profile?.full_name || '', phone: profile?.phone || '' })
        setEditing(true)
    }

    async function handleSaveProfile() {
        if (!formData.full_name?.trim()) { toast.warning('Tên không được để trống'); return }
        setSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: formData.full_name, phone: formData.phone })
                .eq('id', profile.id)
            if (error) throw error
            // Clear profile cache so sidebar and other components reflect updated info
            sessionStorage.removeItem('user_profile')
            toast.success('Cập nhật thành công!')
            setEditing(false)
        } catch (err) { toast.error('Lỗi: ' + err.message) }
        finally { setSaving(false) }
    }

    async function handleChangePassword() {
        if (!pwData.newPw || pwData.newPw.length < 6) { toast.warning('Mật khẩu mới phải ≥ 6 ký tự'); return }
        if (pwData.newPw !== pwData.confirm) { toast.warning('Xác nhận mật khẩu không khớp'); return }
        setSaving(true)
        try {
            const { error } = await supabase.auth.updateUser({ password: pwData.newPw })
            if (error) throw error
            toast.success('Đổi mật khẩu thành công!')
            setChangingPassword(false)
            setPwData({ current: '', newPw: '', confirm: '' })
        } catch (err) { toast.error('Lỗi: ' + err.message) }
        finally { setSaving(false) }
    }

    if (!profile) return null

    const roleColor = ROLE_COLORS[profile.role] || '#636E72'
    const initials = profile.full_name?.split(' ').map(n => n[0]).join('').slice(-2).toUpperCase() || '?'

    const tabs = [
        { key: 'info', label: 'Thông tin', icon: User },
        { key: 'security', label: 'Bảo mật', icon: Key },
        { key: 'notifications', label: 'Thông báo', icon: Bell },
        { key: 'access', label: 'Quyền truy cập', icon: Shield },
    ]

    const MODULES = [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'sales_forecast', label: 'Dự trù Sales' },
        { key: 'purchase_forecast', label: 'Dự trù mua hàng' },
        { key: 'purchase_order', label: 'Đặt hàng' },
        { key: 'import_shipment', label: 'Nhập khẩu' },
        { key: 'warehouse', label: 'Nhập kho' },
        { key: 'delivery', label: 'Vận chuyển' },
        { key: 'master_data', label: 'Danh mục' },
        { key: 'audit_trail', label: 'Audit Trail' },
    ]

    return (
        <div>
            <PageHeader
                title="Hồ sơ cá nhân"
                subtitle="Quản lý thông tin tài khoản của bạn"
                icon={<UserCircle size={20} />}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--space-6)' }}>
                {/* Left — Avatar card */}
                <div className="card" style={{ textAlign: 'center', height: 'fit-content' }}>
                    <div className="card-body" style={{ padding: 'var(--space-8)' }}>
                        <div style={{
                            width: 88, height: 88, borderRadius: 'var(--radius-full)',
                            background: `linear-gradient(135deg, ${roleColor}, ${roleColor}CC)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto var(--space-4)',
                            fontSize: '1.75rem', fontWeight: 700, color: '#fff',
                            boxShadow: `0 4px 16px ${roleColor}40`,
                        }}>{initials}</div>
                        <h3 style={{ marginBottom: 'var(--space-1)' }}>{profile.full_name}</h3>
                        <div style={{
                            display: 'inline-block', padding: '4px 14px',
                            background: `${roleColor}20`, color: roleColor,
                            borderRadius: 'var(--radius-full)', fontSize: 'var(--font-sm)', fontWeight: 600,
                        }}>{ROLE_LABELS[profile.role] || profile.role}</div>

                        <div style={{
                            marginTop: 'var(--space-5)', display: 'flex', flexDirection: 'column',
                            gap: 'var(--space-3)', textAlign: 'left',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>
                                <Mail size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.email || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>
                                <Phone size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                <span>{profile.phone || 'Chưa cập nhật'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>
                                <Shield size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                <span>{profile.is_active ? '✅ Hoạt động' : '❌ Vô hiệu'}</span>
                            </div>
                        </div>

                        <button className="btn btn-danger btn-sm" onClick={signOut}
                            style={{ marginTop: 'var(--space-6)', width: '100%' }}>
                            Đăng xuất
                        </button>
                    </div>
                </div>

                {/* Right — Tabbed content */}
                <div>
                    {/* Tab nav */}
                    <div className="tab-nav">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                className={`tab-nav-item ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                <tab.icon size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab: Info */}
                    {activeTab === 'info' && (
                        <div className="card">
                            <div className="card-header">
                                <h3>Thông tin cá nhân</h3>
                                {!editing && (
                                    <button className="btn btn-ghost btn-sm" onClick={startEdit}>
                                        <Edit2 size={14} /> Chỉnh sửa
                                    </button>
                                )}
                            </div>
                            <div className="card-body">
                                {editing ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label required">Họ tên</label>
                                                <input className="form-input" value={formData.full_name}
                                                    onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Số điện thoại</label>
                                                <input className="form-input" value={formData.phone}
                                                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                                    placeholder="0xxx xxx xxx" />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={saving}>
                                                <Save size={14} /> Lưu
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                                                <X size={14} /> Hủy
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
                                        {[
                                            { label: 'Họ tên', value: profile.full_name },
                                            { label: 'Email', value: profile.email || '—' },
                                            { label: 'Vai trò', value: ROLE_LABELS[profile.role] },
                                            { label: 'SĐT', value: profile.phone || 'Chưa cập nhật' },
                                        ].map(item => (
                                            <div key={item.label}>
                                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{item.label}</div>
                                                <div style={{ fontWeight: 500 }}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab: Security */}
                    {activeTab === 'security' && (
                        <div className="card">
                            <div className="card-header">
                                <h3>Bảo mật tài khoản</h3>
                                {!changingPassword && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setChangingPassword(true)}>
                                        <Edit2 size={14} /> Đổi mật khẩu
                                    </button>
                                )}
                            </div>
                            <div className="card-body">
                                {changingPassword ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 400 }}>
                                        <div className="form-group">
                                            <label className="form-label required">Mật khẩu mới</label>
                                            <input type="password" className="form-input" value={pwData.newPw}
                                                onChange={e => setPwData(p => ({ ...p, newPw: e.target.value }))}
                                                placeholder="Ít nhất 6 ký tự" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label required">Xác nhận mật khẩu</label>
                                            <input type="password" className="form-input" value={pwData.confirm}
                                                onChange={e => setPwData(p => ({ ...p, confirm: e.target.value }))}
                                                placeholder="Nhập lại mật khẩu mới" />
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button className="btn btn-primary btn-sm" onClick={handleChangePassword} disabled={saving}>
                                                <CheckCircle size={14} /> Xác nhận
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setChangingPassword(false)}>
                                                <X size={14} /> Hủy
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-3)' }}>
                                            Mật khẩu hiện tại: ••••••••
                                        </p>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>
                                            Sử dụng nút "Đổi mật khẩu" để thay đổi mật khẩu. Mật khẩu mới phải ≥ 6 ký tự.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab: Notifications */}
                    {activeTab === 'notifications' && (
                        <div className="card">
                            <div className="card-header"><h3>Cài đặt thông báo</h3></div>
                            <div className="card-body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {[
                                        { key: 'po_pending', label: 'PO chờ duyệt', desc: 'Nhận thông báo khi có PO cần phê duyệt' },
                                        { key: 'overdue', label: 'PO quá hạn', desc: 'Nhận cảnh báo khi PO quá hạn giao hàng' },
                                        { key: 'expiring', label: 'Hạn sử dụng', desc: 'Nhận cảnh báo lot sắp hết hạn (<60 ngày)' },
                                        { key: 'low_stock', label: 'Tồn kho thấp', desc: 'Nhận cảnh báo khi sản phẩm dưới mức an toàn' },
                                    ].map(item => (
                                        <div key={item.key} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: 'var(--space-3) var(--space-4)',
                                            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                                        }}>
                                            <div>
                                                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500 }}>{item.label}</div>
                                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{item.desc}</div>
                                            </div>
                                            <button
                                                className={`btn btn-sm ${notifSettings[item.key] ? 'btn-success' : 'btn-ghost'}`}
                                                onClick={() => setNotifSettings(p => ({ ...p, [item.key]: !p[item.key] }))}
                                                style={{ minWidth: 80 }}
                                            >
                                                {notifSettings[item.key]
                                                    ? <><Bell size={14} /> Bật</>
                                                    : <><BellOff size={14} /> Tắt</>
                                                }
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-4)' }}>
                                    * Cài đặt được lưu cục bộ. Tính năng thông báo qua email sẽ được triển khai sau.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tab: Access */}
                    {activeTab === 'access' && (
                        <div className="card">
                            <div className="card-header"><h3>Quyền truy cập module</h3></div>
                            <div className="card-body">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-2)' }}>
                                    {MODULES.map(mod => {
                                        const allowed = (MODULE_ACCESS[mod.key] || []).includes(profile.role)
                                        return (
                                            <div key={mod.key} style={{
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                                                padding: 'var(--space-2) var(--space-3)',
                                                background: allowed ? 'rgba(0,184,148,0.08)' : 'rgba(99,110,114,0.08)',
                                                borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)',
                                                opacity: allowed ? 1 : 0.5,
                                                border: allowed ? '1px solid rgba(0,184,148,0.15)' : '1px solid transparent',
                                            }}>
                                                <span>{allowed ? '✅' : '🔒'}</span>
                                                <span>{mod.label}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
