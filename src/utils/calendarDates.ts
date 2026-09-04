import { AfterOpeningUnit } from '@/db/types'
import { isDateOnly, isYearMonth, toDateOnlyLocal } from './dates'
import { getExpiryPrecision } from './expiry'

/**
 * Returns the last calendar day of a month as YYYY-MM-DD (local civil date).
 * Handles leap years via Date local constructor.
 */
export function lastDayOfMonth (year: number, month: number): string {
	// Day 0 of next month = last day of `month`.
	const date = new Date(year, month, 0)
	return toDateOnlyLocal(date)
}

/**
 * Converts stored expiry (YYYY-MM or YYYY-MM-DD) to an inclusive end date YYYY-MM-DD.
 * Year-month values remain valid through the last day of that month.
 */
export function expiryValueToEndDate (value: string | null | undefined): string | null {
	if (!value) {
		return null
	}
	const precision = getExpiryPrecision(value)
	if (precision === 'date' && isDateOnly(value)) {
		return value
	}
	if (precision === 'year-month' && isYearMonth(value)) {
		const [year, month] = value.split('-').map(Number)
		return lastDayOfMonth(year, month)
	}
	return null
}

/**
 * Adds after-opening duration to openedAt (YYYY-MM-DD) using local calendar math.
 */
export function addAfterOpeningDuration (
	openedAt: string,
	value: number,
	unit: AfterOpeningUnit,
): string | null {
	if (!isDateOnly(openedAt) || !Number.isFinite(value) || value <= 0) {
		return null
	}

	const [year, month, day] = openedAt.split('-').map(Number)
	const date = new Date(year, month - 1, day)

	if (unit === 'days') {
		date.setDate(date.getDate() + Math.round(value))
	} else if (unit === 'weeks') {
		date.setDate(date.getDate() + Math.round(value * 7))
	} else if (unit === 'months') {
		const whole = Math.trunc(value)
		date.setMonth(date.getMonth() + whole)
		const fraction = value - whole
		if (fraction > 0) {
			date.setDate(date.getDate() + Math.round(fraction * 30))
		}
	} else {
		return null
	}

	return toDateOnlyLocal(date)
}

/**
 * Signed day difference: target - today (local calendar dates).
 * Negative means target is already past.
 */
export function daysBetweenDateOnly (today: string, target: string): number {
	const [ty, tm, td] = today.split('-').map(Number)
	const [ay, am, ad] = target.split('-').map(Number)
	const start = new Date(ty, tm - 1, td)
	const end = new Date(ay, am - 1, ad)
	const ms = end.getTime() - start.getTime()
	return Math.round(ms / (24 * 60 * 60 * 1000))
}

export function todayLocalDateOnly (now: Date = new Date()): string {
	return toDateOnlyLocal(now)
}
