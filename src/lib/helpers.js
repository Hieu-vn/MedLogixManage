/**
 * Re-export date utilities from dateUtils.js (single source of truth)
 * This ensures all existing `import { formatDate } from '../lib/helpers'` still work.
 */
export { formatDate, formatDateTime, daysBetween } from './dateUtils'

/**
 * Cached Intl formatters (singleton pattern — created once, reused forever)
 */
const currencyFormatters = {}
function getCurrencyFormatter(currency) {
    if (!currencyFormatters[currency]) {
        currencyFormatters[currency] = new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency,
            maximumFractionDigits: currency === 'VND' ? 0 : 2,
        })
    }
    return currencyFormatters[currency]
}

/**
 * Format number as Vietnamese currency (VND)
 */
export function formatCurrency(amount, currency = 'VND') {
    if (amount == null) return '—'
    return getCurrencyFormatter(currency).format(amount)
}

/**
 * Generate unique code using timestamp + strong random suffix
 * A14: Increased from 2-digit random (1/100) to 6-char alphanumeric (1/2.2B)
 * @param {string} prefix - e.g., 'SF', 'PF', 'PO'
 * @returns {string} e.g., 'SF-20260308-143022-a3f1b2'
 */
export function generateCode(prefix) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    const rand = Math.random().toString(36).substring(2, 8)
    return `${prefix}-${year}${month}${day}-${h}${m}${s}-${rand}`
}

/**
 * Calculate months between two dates
 */
export function monthsBetween(date1, date2) {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
}

/**
 * Determine priority level based on deadline and stock
 */
export function calculatePriority(neededDate, availableStock, totalRequested) {
    const daysUntilNeeded = daysBetween(new Date(), neededDate)

    if (daysUntilNeeded <= 15 || availableStock === 0) return 'urgent'
    if (daysUntilNeeded <= 45 && availableStock < totalRequested) return 'normal'
    return 'low'
}

/**
 * Determine HSD (expiry date) warning level
 */
export function getExpiryWarning(expiryDate, neededDate) {
    const months = monthsBetween(neededDate || new Date(), expiryDate)

    if (months <= 8) return { level: 'danger', label: 'HSD nguy hiểm', color: '#D63031' }
    if (months <= 12) return { level: 'warning', label: 'HSD sắp hết', color: '#FDCB6E' }
    return { level: 'ok', label: 'HSD tốt', color: '#00B894' }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str, maxLength = 50) {
    if (!str) return ''
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str
}

/**
 * Debounce function for search inputs
 */
export function debounce(func, wait = 300) {
    let timeout
    return function executedFunction(...args) {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), wait)
    }
}

/**
 * Storage condition labels
 */
export const STORAGE_CONDITIONS = {
    normal: { label: 'Thường', icon: '🏠', color: '#00B894' },
    cool: { label: 'Mát (2-8°C)', icon: '❄️', color: '#0984E3' },
    cold: { label: 'Lạnh (-20°C)', icon: '🧊', color: '#6C5CE7' },
}

/**
 * Status labels for all modules
 */
export const STATUS_CONFIG = {
    // Module 1
    draft: { label: 'Nháp', color: '#636E72', bg: 'rgba(99,110,114,0.15)' },
    pending: { label: 'Chờ duyệt', color: '#FDCB6E', bg: 'rgba(253,203,110,0.15)' },
    approved: { label: 'Đã duyệt', color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
    rejected: { label: 'Từ chối', color: '#D63031', bg: 'rgba(214,48,49,0.15)' },
    transferred: { label: 'Đã chuyển', color: '#0984E3', bg: 'rgba(9,132,227,0.15)' },
    // Module 2
    po_created: { label: 'Đã tạo PO', color: '#6C5CE7', bg: 'rgba(108,92,231,0.15)' },
    // Module 3
    sent: { label: 'Đã gửi NCC', color: '#0984E3', bg: 'rgba(9,132,227,0.15)' },
    confirmed: { label: 'NCC xác nhận', color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
    shipping: { label: 'Đang giao', color: '#E17055', bg: 'rgba(225,112,85,0.15)' },
    received: { label: 'Đã nhận', color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
    // Module 4
    arrived: { label: 'Đến cảng', color: '#FDCB6E', bg: 'rgba(253,203,110,0.15)' },
    declaring: { label: 'Khai báo HQ', color: '#E17055', bg: 'rgba(225,112,85,0.15)' },
    cleared: { label: 'Thông quan', color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
    domestic_transport: { label: 'VC nội địa', color: '#0984E3', bg: 'rgba(9,132,227,0.15)' },
    completed: { label: 'Hoàn thành', color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
    // Module 5
    quarantine: { label: 'Biệt trữ', color: '#D63031', bg: 'rgba(214,48,49,0.15)' },
    released: { label: 'Đã giải phóng', color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
    // Module 6
    dispatched: { label: 'Đã xuất kho', color: '#E17055', bg: 'rgba(225,112,85,0.15)' },
    delivered: { label: 'Đã giao', color: '#0984E3', bg: 'rgba(9,132,227,0.15)' },
}

/**
 * Priority config
 */
export const PRIORITY_CONFIG = {
    urgent: { label: 'Khẩn', color: '#D63031', bg: 'rgba(214,48,49,0.2)', icon: '🔴' },
    normal: { label: 'Bình thường', color: '#FDCB6E', bg: 'rgba(253,203,110,0.2)', icon: '🟡' },
    low: { label: 'Thấp', color: '#00B894', bg: 'rgba(0,184,148,0.2)', icon: '🟢' },
}
