import { getBatchEffectiveExpiry } from '@/domain/batchExpiry'
import { MedicineBatch, MedicineUnit } from '@/db/types'

export interface FefoAllocation {
	batchId: string
	quantity: number
}

export interface FefoPlan {
	allocations: FefoAllocation[]
	consumed: number
	requested: number
	shortfall: number
}

/**
 * Plans FEFO consumption across active compatible batches.
 * Never allocates more than available; shortfall = requested - consumed.
 */
export function planFefoConsumption (
	batches: MedicineBatch[],
	requested: number,
	unit: MedicineUnit,
): FefoPlan {
	const eligible = batches
		.filter(
			(batch) =>
				batch.archivedAt === null &&
				batch.unit === unit &&
				Number.isFinite(batch.quantity) &&
				batch.quantity > 0,
		)
		.sort((a, b) => compareFefoOrder(a, b))

	let remaining = requested
	const allocations: FefoAllocation[] = []

	for (const batch of eligible) {
		if (remaining <= 0) {
			break
		}
		const take = Math.min(batch.quantity, remaining)
		if (take > 0) {
			allocations.push({ batchId: batch.id, quantity: take })
			remaining -= take
		}
	}

	const consumed = requested - remaining
	return {
		allocations,
		consumed,
		requested,
		shortfall: Math.max(0, remaining),
	}
}

function compareFefoOrder (a: MedicineBatch, b: MedicineBatch): number {
	const aExp = getBatchEffectiveExpiry(a)?.date ?? null
	const bExp = getBatchEffectiveExpiry(b)?.date ?? null

	if (aExp && bExp && aExp !== bExp) {
		return aExp < bExp ? -1 : 1
	}
	if (aExp && !bExp) {
		return -1
	}
	if (!aExp && bExp) {
		return 1
	}
	if (a.createdAt !== b.createdAt) {
		return a.createdAt < b.createdAt ? -1 : 1
	}
	return a.id.localeCompare(b.id)
}
