import { isDateOnly } from '@/utils/dates'

const MONTHS_RU = [
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
] as const

/**
 * Formats YYYY-MM-DD as «1 сентября 2026» for Russian UI.
 */
export function formatDateRu (dateOnly: string): string {
	if (!isDateOnly(dateOnly)) {
		return dateOnly
	}
	const [y, m, d] = dateOnly.split('-').map(Number)
	return `${d} ${MONTHS_RU[m - 1]} ${y}`
}

/**
 * Formats ISO instant to local HH:mm.
 */
export function formatInstantHm (iso: string): string {
	const date = new Date(iso)
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	return `${hours}:${minutes}`
}

/**
 * Local calendar date group label for history.
 */
export function historyDateLabel (
	dateOnly: string,
	today: string,
): string {
	if (dateOnly === today) {
		return 'Сегодня'
	}
	const [y, m, d] = today.split('-').map(Number)
	const yesterdayDate = new Date(y, m - 1, d - 1)
	const yy = yesterdayDate.getFullYear()
	const mm = String(yesterdayDate.getMonth() + 1).padStart(2, '0')
	const dd = String(yesterdayDate.getDate()).padStart(2, '0')
	if (dateOnly === `${yy}-${mm}-${dd}`) {
		return 'Вчера'
	}
	return formatDateRu(dateOnly)
}
