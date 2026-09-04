/**
 * Date / time helpers aligned with docs/DATE_TIME_STRATEGY.md.
 *
 * - Instant timestamps: ISO-8601 UTC strings (…Z)
 * - Calendar dates: YYYY-MM-DD (no timezone)
 * - Year-month expiry: YYYY-MM
 * - Local clock times for schedules: HH:mm (local wall clock, no TZ)
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const YEAR_MONTH_RE = /^\d{4}-\d{2}$/
const TIME_HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Returns current instant as ISO-8601 UTC string. */
export function nowIso (): string {
	return new Date().toISOString()
}

/**
 * Validates a calendar date string (YYYY-MM-DD).
 * Does not convert through Date UTC midnight — avoids timezone shifts.
 */
export function isDateOnly (value: string): boolean {
	if (!DATE_ONLY_RE.test(value)) {
		return false
	}

	const [year, month, day] = value.split('-').map(Number)
	const probe = new Date(year, month - 1, day)
	return (
		probe.getFullYear() === year &&
		probe.getMonth() === month - 1 &&
		probe.getDate() === day
	)
}

/**
 * Validates expiry year-month (YYYY-MM).
 * Store as text — never as a UTC timestamp.
 */
export function isYearMonth (value: string): boolean {
	if (!YEAR_MONTH_RE.test(value)) {
		return false
	}

	const [year, month] = value.split('-').map(Number)
	return month >= 1 && month <= 12 && year >= 1900 && year <= 2100
}

/** Validates a local schedule time HH:mm. */
export function isLocalTimeHm (value: string): boolean {
	return TIME_HM_RE.test(value)
}

/**
 * Formats a Date into a local calendar date YYYY-MM-DD without UTC conversion.
 */
export function toDateOnlyLocal (date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}
