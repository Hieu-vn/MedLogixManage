import { useState, useMemo } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

/**
 * CrossVerificationPanel — Reusable cross-verification component
 * 
 * Props:
 * - sourceLabel (string): e.g. "PO" or "Invoice"
 * - targetLabel (string): e.g. "Invoice" or "Nhập kho"
 * - sourceItems (array): [{code, name, unit, quantity, lot_number, expiry_date, unit_price}]
 * - targetItems (array): same structure
 * - fieldsToCompare (array): ['code','name','unit','quantity','lot_number','expiry_date']
 * - onConfirm (function): called with {status, mismatches, notes}
 */

const FIELD_LABELS = {
    code: 'Code',
    name: 'Tên SP',
    unit: 'ĐVT',
    quantity: 'Số lượng',
    lot_number: 'Lot No.',
    expiry_date: 'HSD',
    unit_price: 'Đơn giá',
}

export default function CrossVerificationPanel({
    sourceLabel = 'PO',
    targetLabel = 'Chứng từ',
    sourceItems = [],
    targetItems = [],
    fieldsToCompare = ['code', 'name', 'unit', 'quantity', 'lot_number', 'expiry_date'],
    onConfirm,
    readOnly = false,
}) {
    const [notes, setNotes] = useState('')

    // Run comparison
    const results = useMemo(() => {
        if (!sourceItems.length || !targetItems.length) return []

        return sourceItems.map((source, idx) => {
            // Try to match by code
            const target = targetItems.find(t =>
                t.code?.toLowerCase() === source.code?.toLowerCase()
            ) || targetItems[idx]

            if (!target) {
                return {
                    source,
                    target: null,
                    status: 'missing',
                    mismatches: [{ field: 'all', message: 'Không tìm thấy trong ' + targetLabel }],
                }
            }

            const mismatches = []
            fieldsToCompare.forEach(field => {
                const sVal = normalizeValue(source[field], field)
                const tVal = normalizeValue(target[field], field)
                if (sVal !== tVal) {
                    mismatches.push({
                        field,
                        sourceValue: source[field],
                        targetValue: target[field],
                    })
                }
            })

            return {
                source,
                target,
                status: mismatches.length === 0 ? 'matched' : 'mismatched',
                mismatches,
            }
        })
    }, [sourceItems, targetItems, fieldsToCompare])

    // Check for extra items in target not matched
    const extraTargetItems = useMemo(() => {
        if (!targetItems.length) return []
        return targetItems.filter(t =>
            !sourceItems.some(s => s.code?.toLowerCase() === t.code?.toLowerCase())
        )
    }, [sourceItems, targetItems])

    // Overall status
    const overallStatus = useMemo(() => {
        if (!results.length) return 'pending'
        if (results.every(r => r.status === 'matched') && extraTargetItems.length === 0) return 'matched'
        return 'mismatched'
    }, [results, extraTargetItems])

    const totalMismatches = results.reduce((sum, r) => sum + r.mismatches.length, 0) + extraTargetItems.length
    const totalMatched = results.filter(r => r.status === 'matched').length

    function handleConfirm(status) {
        const allMismatches = results
            .filter(r => r.mismatches.length > 0)
            .map(r => ({
                code: r.source.code,
                mismatches: r.mismatches,
            }))
        onConfirm?.({ status, mismatches: allMismatches, notes })
    }

    if (!sourceItems.length) {
        return (
            <div style={{
                padding: 'var(--space-4)', textAlign: 'center',
                color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)',
            }}>
                <Info size={24} style={{ marginBottom: 'var(--space-2)' }} />
                <p>Chưa có dữ liệu {sourceLabel} để đối chiếu</p>
            </div>
        )
    }

    if (!targetItems.length) {
        return (
            <div style={{
                padding: 'var(--space-4)', textAlign: 'center',
                color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)',
            }}>
                <Info size={24} style={{ marginBottom: 'var(--space-2)' }} />
                <p>Chưa có dữ liệu {targetLabel} để đối chiếu. Nhập dữ liệu {targetLabel} trước.</p>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Summary bar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                background: overallStatus === 'matched'
                    ? 'rgba(0,184,148,0.08)' : 'rgba(214,48,49,0.08)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${overallStatus === 'matched' ? 'rgba(0,184,148,0.3)' : 'rgba(214,48,49,0.3)'}`,
            }}>
                {overallStatus === 'matched' ? (
                    <CheckCircle size={24} style={{ color: '#00B894' }} />
                ) : (
                    <AlertTriangle size={24} style={{ color: '#D63031' }} />
                )}
                <div>
                    <div style={{ fontWeight: 600 }}>
                        {overallStatus === 'matched'
                            ? '✅ Tất cả dữ liệu khớp!'
                            : `⚠️ Có ${totalMismatches} sai lệch cần xác nhận`
                        }
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                        Đối chiếu {sourceLabel} ({sourceItems.length} dòng) vs {targetLabel} ({targetItems.length} dòng)
                        — {totalMatched} khớp, {results.filter(r => r.status === 'mismatched').length} sai lệch
                        {extraTargetItems.length > 0 && `, ${extraTargetItems.length} dòng thừa`}
                    </div>
                </div>
            </div>

            {/* Comparison Table */}
            <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 'var(--font-sm)' }}>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Code</th>
                            {fieldsToCompare.filter(f => f !== 'code').map(f => (
                                <th key={f} colSpan={2} style={{ textAlign: 'center' }}>
                                    {FIELD_LABELS[f] || f}
                                </th>
                            ))}
                            <th>Kết quả</th>
                        </tr>
                        <tr style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                            <th></th>
                            <th></th>
                            {fieldsToCompare.filter(f => f !== 'code').map(f => (
                                <>
                                    <th key={f + '_s'} style={{ fontSize: 'var(--font-xs)', minWidth: 60 }}>{sourceLabel}</th>
                                    <th key={f + '_t'} style={{ fontSize: 'var(--font-xs)', minWidth: 60 }}>{targetLabel}</th>
                                </>
                            ))}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r, idx) => (
                            <tr key={idx} style={r.status === 'mismatched' ? { background: 'rgba(214,48,49,0.04)' } : {}}>
                                <td>{idx + 1}</td>
                                <td>
                                    <span className="code-badge">{r.source.code}</span>
                                </td>
                                {fieldsToCompare.filter(f => f !== 'code').map(f => {
                                    const mismatch = r.mismatches.find(m => m.field === f)
                                    return (
                                        <>
                                            <td key={f + '_s'} style={mismatch ? { fontWeight: 600 } : {}}>
                                                {r.source[f] ?? '—'}
                                            </td>
                                            <td key={f + '_t'} style={mismatch ? {
                                                fontWeight: 700, color: '#D63031', background: 'rgba(214,48,49,0.08)',
                                            } : { color: 'var(--text-tertiary)' }}>
                                                {r.target ? (r.target[f] ?? '—') : '—'}
                                                {mismatch && ' ❌'}
                                            </td>
                                        </>
                                    )
                                })}
                                <td>
                                    {r.status === 'matched' ? (
                                        <span style={{ color: '#00B894', fontWeight: 600 }}>✅ Khớp</span>
                                    ) : r.status === 'missing' ? (
                                        <span style={{ color: '#636E72' }}>—</span>
                                    ) : (
                                        <span style={{ color: '#D63031', fontWeight: 600 }}>
                                            ⚠️ {r.mismatches.length} lỗi
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {/* Extra items from target */}
                        {extraTargetItems.map((t, idx) => (
                            <tr key={`extra-${idx}`} style={{ background: 'rgba(253,203,110,0.08)' }}>
                                <td>+</td>
                                <td><span className="code-badge" style={{ opacity: 0.6 }}>{t.code}</span></td>
                                {fieldsToCompare.filter(f => f !== 'code').map(f => (
                                    <>
                                        <td key={f + '_s'} style={{ color: 'var(--text-tertiary)' }}>—</td>
                                        <td key={f + '_t'}>{t[f] ?? '—'}</td>
                                    </>
                                ))}
                                <td><span style={{ color: '#FDCB6E' }}>➕ Thừa</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Confirm actions */}
            {!readOnly && onConfirm && (
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                    padding: 'var(--space-3)', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    {overallStatus === 'mismatched' && (
                        <div className="form-group">
                            <label className="form-label">Ghi chú xác nhận sai lệch</label>
                            <textarea className="form-input" value={notes} rows={2}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Giải thích lý do chấp nhận sai lệch..." />
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        {overallStatus === 'matched' ? (
                            <button className="btn btn-primary" onClick={() => handleConfirm('matched')}>
                                <CheckCircle size={14} /> Xác nhận đã đối chiếu — Khớp
                            </button>
                        ) : (
                            <button className="btn btn-warning" onClick={() => handleConfirm('confirmed_with_note')}
                                style={{ background: '#FDCB6E', color: '#333' }}>
                                <AlertTriangle size={14} /> Xác nhận có sai lệch
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// Normalize values for comparison
function normalizeValue(val, field) {
    if (val == null || val === '') return ''
    if (field === 'quantity' || field === 'unit_price') return String(Number(val))
    if (field === 'expiry_date') return String(val).slice(0, 10)
    return String(val).trim().toLowerCase()
}
