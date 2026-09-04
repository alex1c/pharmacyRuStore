import { MedicineBatch, MedicineUnit } from '@/db/types'
import { compareExpiryAsc } from '@/utils/expiry'

export interface AggregatedMedicineStock {
	totalQuantity: number
	unit: MedicineUnit | null
	nearestExpiry: string | null
	activeBatchCount: number
	primaryCabinetId: string | null
}

/**
 * Single source of truth for medicine stock summaries.
 * Only active (non-archived) batches participate.
 * Quantity may be 0; negative quantities are ignored as invalid data.
 */
export function aggregateMedicineBatches (
	batches: MedicineBatch[],
): AggregatedMedicineStock {
	const active = batches.filter(
		(batch) => batch.archivedAt === null && Number.isFinite(batch.quantity) && batch.quantity >= 0,
	)

	if (active.length === 0) {
		return {
			totalQuantity: 0,
			unit: null,
			nearestExpiry: null,
			activeBatchCount: 0,
			primaryCabinetId: null,
		}
	}

	const unit = active[0]?.unit ?? null
	const totalQuantity = active.reduce((sum, batch) => sum + batch.quantity, 0)

	const withExpiry = active
		.map((batch) => batch.expiryDate)
		.filter((value): value is string => Boolean(value))
		.sort(compareExpiryAsc)

	const cabinetCounts = new Map<string, number>()
	for (const batch of active) {
		cabinetCounts.set(
			batch.cabinetId,
			(cabinetCounts.get(batch.cabinetId) ?? 0) + 1,
		)
	}

	let primaryCabinetId: string | null = null
	let bestCount = -1
	for (const [cabinetId, count] of cabinetCounts) {
		if (count > bestCount) {
			bestCount = count
			primaryCabinetId = cabinetId
		}
	}

	return {
		totalQuantity,
		unit,
		nearestExpiry: withExpiry[0] ?? null,
		activeBatchCount: active.length,
		primaryCabinetId,
	}
}
