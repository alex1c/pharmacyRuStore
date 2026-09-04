import { isDateOnly, isYearMonth } from './dates'

export type ExpiryPrecision = 'unknown' | 'year-month' | 'date'

const MONTH_NAMES_RU = [
	'января',
	'февраля',
	'марта',
	'апреля',
	'мая',
	'июня',
	'июля',
	'августа',
	'сентября',
	'октября',
	'ноября',
	'декабря',
]

const MONTH_NAMES_RU_NOMINATIVE = [
	'январь',
	'февраль',
	'март',
	'апрель',
	'май',
	'июнь',
	'июль',
	'август',
	'сентябрь',
	'октябрь',
	'ноябрь',
	'декабрь',
]

/**
 * Detects stored expiry precision without timezone conversion.
 */
export function getExpiryPrecision (value: string | null | undefined): ExpiryPrecision {
	if (!value) {
		return 'unknown'
	}
	if (isDateOnly(value)) {
		return 'date'
	}
	if (isYearMonth(value)) {
		return 'year-month'
	}
	return 'unknown'
}

/**
 * Validates and normalizes user expiry input to storage format.
 */
export function normalizeExpiryInput (
	precision: ExpiryPrecision,
	yearMonth?: string,
	dateOnly?: string,
): string | null {
	if (precision === 'unknown') {
		return null
	}
	if (precision === 'year-month') {
		const value = yearMonth?.trim() ?? ''
		return isYearMonth(value) ? value : null
	}
	const value = dateOnly?.trim() ?? ''
	return isDateOnly(value) ? value : null
}

/**
 * Human-readable expiry for cards: «ноябрь 2026» / «15 мая 2028».
 */
export function formatExpiryDisplay (value: string | null | undefined): string | null {
	const precision = getExpiryPrecision(value)
	if (!value || precision === 'unknown') {
		return null
	}

	if (precision === 'year-month') {
		const [year, month] = value.split('-').map(Number)
		const monthName = MONTH_NAMES_RU_NOMINATIVE[month - 1]
		return `${monthName} ${year}`
	}

	const [year, month, day] = value.split('-').map(Number)
	const monthName = MONTH_NAMES_RU[month - 1]
	return `${day} ${monthName} ${year}`
}

/**
 * Prefix label used in lists: «Ближайший срок: ноябрь 2026».
 */
export function formatNearestExpiryLabel (value: string | null | undefined): string | null {
	const display = formatExpiryDisplay(value)
	return display ? `Ближайший срок: ${display}` : null
}

/**
 * Prefix for a single pack: «до ноября 2026» / «до 15 мая 2028».
 */
export function formatExpiryUntilLabel (value: string | null | undefined): string | null {
	const precision = getExpiryPrecision(value)
	if (!value || precision === 'unknown') {
		return null
	}

	if (precision === 'year-month') {
		const [year, month] = value.split('-').map(Number)
		const monthName = MONTH_NAMES_RU_GENITIVE_UNTIL[month - 1]
		return `до ${monthName} ${year}`
	}

	const display = formatExpiryDisplay(value)
	return display ? `до ${display}` : null
}

const MONTH_NAMES_RU_GENITIVE_UNTIL = [
	'января',
	'февраля',
	'марта',
	'апреля',
	'мая',
	'июня',
	'июля',
	'августа',
	'сентября',
	'октября',
	'ноября',
	'декабря',
]

/**
 * Compare expiry values lexicographically (YYYY-MM / YYYY-MM-DD sort correctly).
 * Year-month `2026-11` is treated as earlier than `2026-11-15` only if we
 * normalize month-only to `YYYY-MM` which sorts before any day in that month
 * when compared as strings... Actually `2026-11` < `2026-11-01` because
 * shorter prefix... In JS: '2026-11' < '2026-11-01' is true (char by char,
 * then end). That matches "nearest" preferring month-only as start-of-month-ish.
 */
export function compareExpiryAsc (
	a: string | null | undefined,
	b: string | null | undefined,
): number {
	if (!a && !b) {
		return 0
	}
	if (!a) {
		return 1
	}
	if (!b) {
		return -1
	}
	if (a === b) {
		return 0
	}
	return a < b ? -1 : 1
}
