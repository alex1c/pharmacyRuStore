import {
	AttentionKind,
	ExpiryStatus,
	Medicine,
	MedicineBatch,
	MedicineSummary,
	MedicineUnit,
	StockStatus,
} from '@/db/types'
import { getBatchExpiryStatus } from '@/domain/batchExpiry'
import {
	getMedicineStockStatus,
	resolveLowStockThreshold,
} from '@/domain/stockStatus'
import { compareExpiryAsc } from '@/utils/expiry'

export interface InventorySettings {
	expiryWarningDays: number
	defaultLowStockThreshold: number
}

export interface MedicineAttentionState {
	kind: AttentionKind | null
	title: string
	detail: string
	actionLabel: string
}

const ATTENTION_PRIORITY: Record<AttentionKind, number> = {
	expired: 1,
	empty: 2,
	expiring_soon: 3,
	low_stock: 4,
}

/**
 * Builds full inventory summary for one medicine from its active batches.
 */
export function getMedicineInventorySummary (input: {
	medicine: Medicine
	batches: MedicineBatch[]
	settings: InventorySettings
	primaryCabinetName?: string | null
	today?: string
}): MedicineSummary {
	const active = input.batches.filter(
		(batch) =>
			batch.archivedAt === null &&
			Number.isFinite(batch.quantity) &&
			batch.quantity >= 0,
	)

	const lowStockThreshold = resolveLowStockThreshold(
		input.medicine.lowStockThreshold,
		input.settings.defaultLowStockThreshold,
	)

	if (active.length === 0) {
		return {
			medicine: input.medicine,
			totalQuantity: 0,
			unit: null,
			stockStatus: 'empty',
			lowStockThreshold,
			nearestExpiry: null,
			nearestEffectiveExpiry: null,
			nearestEffectiveSource: null,
			expiryStatus: 'unknown',
			expiredBatchCount: 0,
			expiringSoonBatchCount: 0,
			emptyBatchCount: 0,
			activeBatchCount: 0,
			primaryCabinetName: input.primaryCabinetName ?? null,
			attentionKind: 'empty',
		}
	}

	const unit = resolveCompatibleUnit(active)
	const totalQuantity = active.reduce((sum, batch) => sum + batch.quantity, 0)
	const stockStatus = getMedicineStockStatus(totalQuantity, lowStockThreshold)

	let expiredBatchCount = 0
	let expiringSoonBatchCount = 0
	let emptyBatchCount = 0
	let nearestEffectiveExpiry: string | null = null
	let nearestEffectiveSource: MedicineSummary['nearestEffectiveSource'] = null
	let nearestPackageExpiry: string | null = null
	let worstExpiryStatus: ExpiryStatus = 'unknown'

	for (const batch of active) {
		if (batch.quantity === 0) {
			emptyBatchCount += 1
		}

		const assessment = getBatchExpiryStatus(batch, {
			warningDays: input.settings.expiryWarningDays,
			today: input.today,
		})

		if (assessment.status === 'expired') {
			expiredBatchCount += 1
		} else if (assessment.status === 'expiring_soon') {
			expiringSoonBatchCount += 1
		}

		worstExpiryStatus = worseExpiryStatus(worstExpiryStatus, assessment.status)

		if (assessment.effective) {
			if (
				!nearestEffectiveExpiry ||
				assessment.effective.date < nearestEffectiveExpiry
			) {
				nearestEffectiveExpiry = assessment.effective.date
				nearestEffectiveSource = assessment.effective.source
			}
		}

		if (batch.expiryDate) {
			if (
				!nearestPackageExpiry ||
				compareExpiryAsc(batch.expiryDate, nearestPackageExpiry) < 0
			) {
				nearestPackageExpiry = batch.expiryDate
			}
		}
	}

	const attentionKind = pickAttentionKind({
		expiryStatus: worstExpiryStatus,
		stockStatus,
		expiredBatchCount,
		emptyBatchCount,
		expiringSoonBatchCount,
	})

	return {
		medicine: input.medicine,
		totalQuantity,
		unit,
		stockStatus,
		lowStockThreshold,
		nearestExpiry: nearestPackageExpiry,
		nearestEffectiveExpiry,
		nearestEffectiveSource,
		expiryStatus: worstExpiryStatus,
		expiredBatchCount,
		expiringSoonBatchCount,
		emptyBatchCount,
		activeBatchCount: active.length,
		primaryCabinetName: input.primaryCabinetName ?? null,
		attentionKind,
	}
}

/**
 * One attention card per medicine — highest priority problem only.
 */
export function buildMedicineAttentionState (
	summary: MedicineSummary,
): MedicineAttentionState | null {
	if (!summary.attentionKind) {
		return null
	}

	const name = summary.medicine.name

	if (summary.attentionKind === 'expired') {
		const afterOpening =
			summary.nearestEffectiveSource === 'after_opening'
		return {
			kind: 'expired',
			title: name,
			detail: afterOpening
				? 'Истёк срок после вскрытия'
				: summary.expiredBatchCount > 1
					? 'Несколько упаковок просрочены'
					: 'Одна упаковка просрочена',
			actionLabel: 'Проверить',
		}
	}

	if (summary.attentionKind === 'empty') {
		return {
			kind: 'empty',
			title: name,
			detail: 'Упаковка закончилась',
			actionLabel: 'Убрать',
		}
	}

	if (summary.attentionKind === 'expiring_soon') {
		const afterOpening =
			summary.nearestEffectiveSource === 'after_opening'
		return {
			kind: 'expiring_soon',
			title: name,
			detail: afterOpening
				? 'Скоро истечёт срок после вскрытия'
				: summary.expiringSoonBatchCount > 1
					? 'Срок нескольких упаковок скоро истечёт'
					: 'Срок одной упаковки скоро истечёт',
			actionLabel: 'Открыть',
		}
	}

	return {
		kind: 'low_stock',
		title: name,
		detail: `Мало осталось`,
		actionLabel: 'Пополнить',
	}
}

export function compareAttentionPriority (
	a: AttentionKind | null,
	b: AttentionKind | null,
): number {
	const rankA = a ? ATTENTION_PRIORITY[a] : 99
	const rankB = b ? ATTENTION_PRIORITY[b] : 99
	return rankA - rankB
}

function pickAttentionKind (input: {
	expiryStatus: ExpiryStatus
	stockStatus: StockStatus
	expiredBatchCount: number
	emptyBatchCount: number
	expiringSoonBatchCount: number
}): AttentionKind | null {
	if (input.expiredBatchCount > 0 || input.expiryStatus === 'expired') {
		return 'expired'
	}
	if (input.stockStatus === 'empty' || input.emptyBatchCount > 0) {
		// Medicine-level empty only when total is empty; pack-level empty
		// still matters when total may be > 0 from other packs.
		if (input.stockStatus === 'empty') {
			return 'empty'
		}
	}
	if (
		input.expiringSoonBatchCount > 0 ||
		input.expiryStatus === 'expiring_soon'
	) {
		return 'expiring_soon'
	}
	if (input.stockStatus === 'low') {
		return 'low_stock'
	}
	return null
}

function worseExpiryStatus (current: ExpiryStatus, next: ExpiryStatus): ExpiryStatus {
	const rank: Record<ExpiryStatus, number> = {
		expired: 0,
		expiring_soon: 1,
		ok: 2,
		unknown: 3,
	}
	return rank[next] < rank[current] ? next : current
}

function resolveCompatibleUnit (batches: MedicineBatch[]): MedicineUnit | null {
	const units = new Set(batches.map((batch) => batch.unit))
	if (units.size === 0) {
		return null
	}
	// Incompatible units should be rejected at write time; if present, use first.
	return batches[0]?.unit ?? null
}

/** @deprecated Prefer getMedicineInventorySummary — kept for simple qty aggregation tests. */
export {
	aggregateMedicineBatches,
	type AggregatedMedicineStock,
} from './legacyAggregate'
