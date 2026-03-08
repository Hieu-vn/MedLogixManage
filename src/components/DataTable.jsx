import { useState, useMemo, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Download, X, Check } from 'lucide-react'

/**
 * DataTable — Enhanced reusable table
 * Features: search, sort, pagination, page-size selector, CSV export, bulk selection, skeleton loading
 *
 * @param {Array} columns - [{ key, label, sortable, render, width, exportRender }]
 * @param {Array} data - Array of row objects
 * @param {Function} onRowClick
 * @param {number} pageSize - default page size
 * @param {string} searchPlaceholder
 * @param {Array} searchKeys
 * @param {React.ReactNode} actions
 * @param {boolean} loading
 * @param {string} emptyMessage
 * @param {boolean} exportable - show CSV export button
 * @param {string} exportFilename
 * @param {boolean} selectable - show row checkboxes
 * @param {Function} onSelectionChange - callback with selected rows
 * @param {React.ReactNode} bulkActions - render when rows selected
 */
export default function DataTable({
    columns = [],
    data = [],
    onRowClick,
    pageSize: defaultPageSize = 10,
    searchPlaceholder = 'Tìm kiếm...',
    searchKeys,
    actions,
    loading = false,
    emptyMessage = 'Không có dữ liệu',
    emptyIcon,
    exportable = false,
    exportFilename = 'export',
    selectable = false,
    onSelectionChange,
    bulkActions,
}) {
    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState(null)
    const [sortDir, setSortDir] = useState('asc')
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(defaultPageSize)
    const [selectedIds, setSelectedIds] = useState(new Set())

    // Filter
    const filteredData = useMemo(() => {
        if (!search.trim()) return data
        const query = search.toLowerCase().trim()
        const keys = searchKeys || columns.filter(c => c.key).map(c => c.key)
        return data.filter(row =>
            keys.some(key => {
                const val = row[key]
                if (val == null) return false
                return String(val).toLowerCase().includes(query)
            })
        )
    }, [data, search, searchKeys, columns])

    // Sort
    const sortedData = useMemo(() => {
        if (!sortKey) return filteredData
        return [...filteredData].sort((a, b) => {
            let va = a[sortKey], vb = b[sortKey]
            if (va == null) return 1
            if (vb == null) return -1
            if (typeof va === 'number' && typeof vb === 'number') {
                return sortDir === 'asc' ? va - vb : vb - va
            }
            if (typeof va === 'string' && !isNaN(Date.parse(va))) {
                return sortDir === 'asc'
                    ? new Date(va).getTime() - new Date(vb).getTime()
                    : new Date(vb).getTime() - new Date(va).getTime()
            }
            va = String(va).toLowerCase()
            vb = String(vb).toLowerCase()
            if (va < vb) return sortDir === 'asc' ? -1 : 1
            if (va > vb) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredData, sortKey, sortDir])

    // Paginate
    const totalPages = Math.ceil(sortedData.length / pageSize)
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return sortedData.slice(start, start + pageSize)
    }, [sortedData, currentPage, pageSize])

    const handleSearch = (e) => { setSearch(e.target.value); setCurrentPage(1) }
    const handleSort = (key) => {
        if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir('asc') }
    }

    // Selection
    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedData.length) {
            setSelectedIds(new Set())
            onSelectionChange?.([])
        } else {
            const ids = new Set(paginatedData.map(r => r.id))
            setSelectedIds(ids)
            onSelectionChange?.(paginatedData)
        }
    }

    const toggleSelect = (row) => {
        const next = new Set(selectedIds)
        if (next.has(row.id)) next.delete(row.id)
        else next.add(row.id)
        setSelectedIds(next)
        onSelectionChange?.(sortedData.filter(r => next.has(r.id)))
    }

    const clearSelection = () => {
        setSelectedIds(new Set())
        onSelectionChange?.([])
    }

    // CSV Export
    const exportCSV = useCallback(() => {
        const exportCols = columns.filter(c => c.key)
        const header = exportCols.map(c => c.label).join(',')
        const rows = sortedData.map(row =>
            exportCols.map(c => {
                let val = c.exportRender ? c.exportRender(row[c.key], row) : row[c.key]
                if (val == null) val = ''
                val = String(val).replace(/"/g, '""')
                return `"${val}"`
            }).join(',')
        )
        const csv = '\ufeff' + [header, ...rows].join('\n') // BOM for Excel UTF-8
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${exportFilename}_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }, [sortedData, columns, exportFilename])

    const SortIcon = ({ colKey }) => {
        if (sortKey !== colKey) return <ChevronsUpDown size={14} style={{ opacity: 0.3 }} />
        return sortDir === 'asc'
            ? <ChevronUp size={14} style={{ color: 'var(--primary-400)' }} />
            : <ChevronDown size={14} style={{ color: 'var(--primary-400)' }} />
    }

    const isAllSelected = paginatedData.length > 0 && selectedIds.size === paginatedData.length

    return (
        <div className="card" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--border-secondary)',
                gap: 'var(--space-3)', flexWrap: 'wrap',
            }}>
                {/* Left: Search or Bulk Selection bar */}
                {selectedIds.size > 0 ? (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        background: 'rgba(108,92,231,0.08)', padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)',
                    }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary-400)' }}>
                            {selectedIds.size} đã chọn
                        </span>
                        {bulkActions}
                        <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
                            <X size={12} /> Bỏ chọn
                        </button>
                    </div>
                ) : (
                    <div className="search-bar">
                        <Search size={16} />
                        <input placeholder={searchPlaceholder} value={search} onChange={handleSearch} />
                        {search && (
                            <X size={14} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}
                                onClick={() => { setSearch(''); setCurrentPage(1) }} />
                        )}
                    </div>
                )}

                {/* Right: Actions + Export */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {exportable && (
                        <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Xuất CSV">
                            <Download size={14} /> CSV
                        </button>
                    )}
                    {actions}
                </div>
            </div>

            {/* Table */}
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                    <thead>
                        <tr>
                            {selectable && (
                                <th style={{ width: 40, textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={toggleSelectAll}
                                        style={{ cursor: 'pointer', accentColor: 'var(--primary-500)' }}
                                    />
                                </th>
                            )}
                            {columns.map(col => (
                                <th
                                    key={col.key || col.label}
                                    style={{
                                        width: col.width, cursor: col.sortable ? 'pointer' : 'default',
                                        userSelect: 'none',
                                    }}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {col.label}
                                        {col.sortable && <SortIcon colKey={col.key} />}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            // Skeleton loading rows
                            Array.from({ length: pageSize }).map((_, i) => (
                                <tr key={`skeleton-${i}`}>
                                    {selectable && (
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="skeleton" style={{ width: 16, height: 16, margin: '0 auto' }} />
                                        </td>
                                    )}
                                    {columns.map((col, j) => (
                                        <td key={j}>
                                            <div className="skeleton" style={{
                                                height: 14, width: `${60 + Math.random() * 30}%`,
                                                animationDelay: `${(i * columns.length + j) * 50}ms`,
                                            }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (selectable ? 1 : 0)}
                                    style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                                    <div style={{ color: 'var(--text-tertiary)' }}>
                                        {emptyIcon && <div style={{ marginBottom: 'var(--space-2)' }}>{emptyIcon}</div>}
                                        {emptyMessage}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((row, idx) => (
                                <tr
                                    key={row.id || idx}
                                    onClick={() => onRowClick?.(row)}
                                    style={{
                                        cursor: onRowClick ? 'pointer' : 'default',
                                        background: selectedIds.has(row.id) ? 'rgba(108,92,231,0.06)' : undefined,
                                    }}
                                >
                                    {selectable && (
                                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(row.id)}
                                                onChange={() => toggleSelect(row)}
                                                style={{ cursor: 'pointer', accentColor: 'var(--primary-500)' }}
                                            />
                                        </td>
                                    )}
                                    {columns.map(col => (
                                        <td key={col.key || col.label}>
                                            {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer: Pagination + Page size */}
            {(totalPages > 1 || sortedData.length > 10) && (
                <div className="pagination" style={{ flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span>
                            {((currentPage - 1) * pageSize) + 1}—{Math.min(currentPage * pageSize, sortedData.length)} / {sortedData.length}
                            {search && ` (tìm từ ${data.length})`}
                        </span>
                        <select
                            className="form-select"
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                            style={{
                                width: 'auto', padding: '2px 24px 2px 8px',
                                fontSize: 'var(--font-xs)', minWidth: 60,
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <div className="pagination-buttons">
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let page
                            if (totalPages <= 5) page = i + 1
                            else if (currentPage <= 3) page = i + 1
                            else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
                            else page = currentPage - 2 + i
                            return (
                                <button
                                    key={page}
                                    className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            )
                        })}
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
