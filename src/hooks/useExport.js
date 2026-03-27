import { useCallback } from 'react'
import { ROBOTO_BASE64 } from '../lib/Roboto-Regular.js'

/**
 * useExport — Reusable hook for exporting data to Excel and PDF
 *
 * Usage:
 *   const { exportExcel, exportPDF } = useExport()
 *   exportExcel(columns, data, 'purchase_orders')
 *   exportPDF(columns, data, 'Đơn Đặt Hàng', 'purchase_orders')
 */
export function useExport() {

    /**
     * Export data to Excel (.xlsx) using SheetJS
     * @param {Array} columns - [{ key, label, exportRender? }]
     * @param {Array} data - Array of row objects
     * @param {string} filename - Base filename (without extension)
     * @param {string} sheetName - Excel sheet name
     */
    const exportExcel = useCallback(async (columns, data, filename = 'export', sheetName = 'Data') => {
        const XLSX = await import('xlsx')

        // Build header row
        const exportCols = columns.filter(c => c.key && c.label)
        const headers = exportCols.map(c => c.label)

        // Build data rows
        const rows = data.map(row =>
            exportCols.map(c => {
                if (c.exportRender) return c.exportRender(row[c.key], row)
                const val = row[c.key]
                return val ?? ''
            })
        )

        // Create workbook
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

        // Auto-width columns
        const maxWidths = headers.map((h, i) => {
            const cellLengths = rows.map(r => String(r[i] || '').length)
            return Math.min(Math.max(h.length, ...cellLengths) + 2, 40)
        })
        ws['!cols'] = maxWidths.map(w => ({ wch: w }))

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, sheetName)

        const dateStr = new Date().toISOString().split('T')[0]
        XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`)
    }, [])

    /**
     * Export data to PDF using jsPDF + autoTable
     * Falls back to CSV if jsPDF is not available
     * @param {Array} columns - [{ key, label, exportRender? }]
     * @param {Array} data - Array of row objects
     * @param {string} title - PDF title header
     * @param {string} filename - Base filename
     */
    const exportPDF = useCallback(async (columns, data, title = 'Báo cáo', filename = 'report') => {
        try {
            const { default: jsPDF } = await import('jspdf')
            await import('jspdf-autotable')

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

            // Add Vietnamese Font (if available)
            if (ROBOTO_BASE64) {
                doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_BASE64)
                doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
                doc.setFont('Roboto')
            }

            // Title
            doc.setFontSize(16)
            doc.text(title, 14, 15)
            doc.setFontSize(9)
            doc.setTextColor(128, 128, 128)
            doc.text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} — MedLogixManage`, 14, 22)

            // Table
            const exportCols = columns.filter(c => c.key && c.label)
            const head = [exportCols.map(c => c.label)]
            const body = data.map(row =>
                exportCols.map(c => {
                    if (c.exportRender) return String(c.exportRender(row[c.key], row))
                    const val = row[c.key]
                    return val != null ? String(val) : ''
                })
            )

            doc.autoTable({
                head,
                body,
                startY: 28,
                styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
                headStyles: {
                    fillColor: [108, 92, 231],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                },
                alternateRowStyles: { fillColor: [245, 245, 255] },
                margin: { top: 28, left: 10, right: 10 },
            })

            // Footer
            const pageCount = doc.internal.getNumberOfPages()
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i)
                doc.setFontSize(8)
                doc.setTextColor(128, 128, 128)
                doc.text(`Trang ${i}/${pageCount}`, doc.internal.pageSize.getWidth() - 25, doc.internal.pageSize.getHeight() - 8)
            }

            const dateStr = new Date().toISOString().split('T')[0]
            doc.save(`${filename}_${dateStr}.pdf`)
        } catch (err) {
            // jsPDF not installed — fall back to simple print
            console.warn('jsPDF not available, falling back to browser print:', err)
            const exportCols = columns.filter(c => c.key && c.label)
            const header = exportCols.map(c => c.label).join('\t')
            const rows = data.map(row =>
                exportCols.map(c => {
                    if (c.exportRender) return String(c.exportRender(row[c.key], row))
                    return row[c.key] ?? ''
                }).join('\t')
            )

            const content = `${title}\nNgày: ${new Date().toLocaleDateString('vi-VN')}\n\n${header}\n${rows.join('\n')}`
            const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${filename}_${new Date().toISOString().split('T')[0]}.txt`
            a.click()
            URL.revokeObjectURL(url)
        }
    }, [])

    return { exportExcel, exportPDF }
}
