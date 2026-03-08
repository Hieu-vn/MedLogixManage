import { Search, X } from 'lucide-react'

/**
 * FilterBar — Reusable search + filter bar
 * Props:
 *   searchValue, onSearch, searchPlaceholder
 *   filters: [{ key, label, value, options: [{value, label}] }]
 *   onFilterChange(key, value)
 *   onClear
 *   actions (ReactNode)
 */
export default function FilterBar({
    searchValue = '', onSearch, searchPlaceholder = 'Tìm kiếm...',
    filters = [], onFilterChange, onClear, actions,
}) {
    const hasActiveFilter = searchValue || filters.some(f => f.value)

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--glass-border)',
            marginBottom: 'var(--space-4)', flexWrap: 'wrap',
        }}>
            {/* Search */}
            {onSearch && (
                <div className="search-bar" style={{ minWidth: 200, flex: '0 1 280px' }}>
                    <Search size={16} />
                    <input
                        value={searchValue}
                        onChange={e => onSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                    />
                    {searchValue && (
                        <X size={14} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}
                            onClick={() => onSearch('')} />
                    )}
                </div>
            )}

            {/* Filter dropdowns */}
            {filters.map(filter => (
                <select
                    key={filter.key}
                    className="form-select"
                    value={filter.value || ''}
                    onChange={e => onFilterChange?.(filter.key, e.target.value)}
                    style={{
                        width: 'auto', minWidth: 130,
                        fontSize: 'var(--font-xs)',
                        padding: 'var(--space-2) var(--space-3)',
                    }}
                >
                    <option value="">{filter.label}</option>
                    {filter.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            ))}

            {/* Clear all filters */}
            {hasActiveFilter && onClear && (
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={onClear}
                    style={{ fontSize: 'var(--font-xs)' }}
                >
                    <X size={12} /> Xóa lọc
                </button>
            )}

            {/* Spacer + actions */}
            {actions && (
                <>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {actions}
                    </div>
                </>
            )}
        </div>
    )
}
