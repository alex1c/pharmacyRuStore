import {
	AfterOpeningUnit,
	EffectiveExpiry,
	EffectiveExpirySource,
	ExpiryStatus,
	MedicineBatch,
} from '@/db/types'
import {
	addAfterOpeningDuration,
	daysBetweenDateOnly,
	expiryValueToEndDate,
	todayLocalDateOnly,
} from '@/utils/calendarDates'

export interface BatchExpiryAssessment {
	packageEndDate: string | null
	afterOpeningEndDate: string | null
	effective: EffectiveExpiry | null
	status: ExpiryStatus
	daysRemaining: number | null
}

/**
 * Computes after-opening end date when openedAt + duration are present.
 */
export function getAfterOpeningExpiryDate (
	batch: Pick<
		MedicineBatch,
		'openedAt' | 'afterOpeningValue' | 'afterOpeningUnit'
	>,
): string | null {
	if (
		!batch.openedAt ||
		batch.afterOpeningValue === null ||
		batch.afterOpeningValue === undefined ||
		!batch.afterOpeningUnit
	) {
		return null
	}

	return addAfterOpeningDuration(
		batch.openedAt,
		batch.afterOpeningValue,
		batch.afterOpeningUnit as AfterOpeningUnit,
	)
}

/**
 * Returns the earliest applicable expiry for a pack and its source.
 */
export function getBatchEffectiveExpiry (
	batch: Pick<
		MedicineBatch,
		'expiryDate' | 'openedAt' | 'afterOpeningValue' | 'afterOpeningUnit'
	>,
): EffectiveExpiry | null {
	const packageEndDate = expiryValueToEndDate(batch.expiryDate)
	const afterOpeningEndDate = getAfterOpeningExpiryDate(batch)

	if (!packageEndDate && !afterOpeningEndDate) {
		return null
	}

	let date: string
	let source: EffectiveExpirySource

	if (packageEndDate && afterOpeningEndDate) {
		if (afterOpeningEndDate < packageEndDate) {
			date = afterOpeningEndDate
			source = 'after_opening'
		} else {
			date = packageEndDate
			source = 'package'
		}
	} else if (afterOpeningEndDate) {
		date = afterOpeningEndDate
		source = 'after_opening'
	} else {
		date = packageEndDate as string
		source = 'package'
	}

	return {
		date,
		source,
		packageExpiry: batch.expiryDate,
		afterOpeningExpiry: afterOpeningEndDate,
	}
}

/**
 * Status for a single batch relative to local today and warning window.
 */
export function getBatchExpiryStatus (
	batch: Pick<
		MedicineBatch,
		| 'expiryDate'
		| 'openedAt'
		| 'afterOpeningValue'
		| 'afterOpeningUnit'
		| 'archivedAt'
	>,
	options: {
		warningDays: number
		today?: string
	},
): BatchExpiryAssessment {
	const today = options.today ?? todayLocalDateOnly()
	const packageEndDate = expiryValueToEndDate(batch.expiryDate)
	const afterOpeningEndDate = getAfterOpeningExpiryDate(batch)
	const effective = getBatchEffectiveExpiry(batch)

	if (!effective) {
		return {
			packageEndDate,
			afterOpeningEndDate,
			effective: null,
			status: 'unknown',
			daysRemaining: null,
		}
	}

	const daysRemaining = daysBetweenDateOnly(today, effective.date)
	let status: ExpiryStatus = 'ok'
	if (daysRemaining < 0) {
		status = 'expired'
	} else if (daysRemaining <= options.warningDays) {
		status = 'expiring_soon'
	}

	return {
		packageEndDate,
		afterOpeningEndDate,
		effective,
		status,
		daysRemaining,
	}
}
