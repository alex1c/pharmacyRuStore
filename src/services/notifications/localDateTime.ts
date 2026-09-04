import { isDateOnly, isLocalTimeHm } from '@/utils/dates'

/**
 * Builds a local wall-clock Date from calendar date + HH:mm.
 * Uses the device timezone constructor (year, monthIndex, day, h, m)
 * so DST transitions keep the intended civil time.
 */
export function localDateTimeToDate (
	dateOnly: string,
	timeHm: string,
): Date {
	if (!isDateOnly(dateOnly) || !isLocalTimeHm(timeHm)) {
		throw new Error('INVALID_LOCAL_DATETIME')
	}
	const [year, month, day] = dateOnly.split('-').map(Number)
	const [hour, minute] = timeHm.split(':').map(Number)
	return new Date(year, month - 1, day, hour, minute, 0, 0)
}

/**
 * Adds calendar days to a YYYY-MM-DD string (local calendar arithmetic).
 */
export function addDaysToDateOnly (dateOnly: string, days: number): string {
	const [year, month, day] = dateOnly.split('-').map(Number)
	const date = new Date(year, month - 1, day)
	date.setDate(date.getDate() + days)
	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}
