import { format, parseISO, addDays, differenceInDays, differenceInMonths, isValid } from 'date-fns'
import { vi } from 'date-fns/locale'

/**
 * Date utility functions — replaces manual date formatting throughout the app.
 * Uses date-fns with vi-VN locale for consistent formatting.
 */

/** Parse a date value (string, Date, or null) into a Date object */
function toDate(value) {
    if (!value) return null
    if (value instanceof Date) return isValid(value) ? value : null
    try {
        const d = parseISO(value)
        return isValid(d) ? d : null
    } catch {
        return null
    }
}

/** Format: dd/MM/yyyy */
export function formatDate(value) {
    const d = toDate(value)
    return d ? format(d, 'dd/MM/yyyy') : '—'
}

/** Format: dd/MM/yyyy HH:mm */
export function formatDateTime(value) {
    const d = toDate(value)
    return d ? format(d, 'dd/MM/yyyy HH:mm') : '—'
}

/** Format: MM/yyyy */
export function formatMonth(value) {
    const d = toDate(value)
    return d ? format(d, 'MM/yyyy') : '—'
}

/** Format: short month + year (T3/26) */
export function formatMonthShort(value) {
    const d = toDate(value)
    return d ? format(d, "'T'M/yy", { locale: vi }) : '—'
}

/** Returns yyyy-MM-dd for HTML date inputs */
export function toISODate(value) {
    if (!value) return new Date().toISOString().split('T')[0]
    const d = toDate(value)
    return d ? format(d, 'yyyy-MM-dd') : ''
}

/** Returns ISO string for API timestamps */
export function toISOString() {
    return new Date().toISOString()
}

/** Add N days to a date, returns Date */
export function addDaysToDate(value, n) {
    const d = toDate(value) || new Date()
    return addDays(d, n)
}

/** Get yyyy-MM-dd that is N days from now */
export function daysFromNow(n) {
    return format(addDays(new Date(), n), 'yyyy-MM-dd')
}

/** Difference in days between two dates */
export function daysBetween(a, b) {
    const da = toDate(a)
    const db = toDate(b)
    if (!da || !db) return 0
    return differenceInDays(db, da)
}

/** Difference in months from now */
export function monthsFromNow(dateValue) {
    const d = toDate(dateValue)
    if (!d) return 0
    return differenceInMonths(d, new Date())
}
