import { listMedicineSummaries } from '@/db/repositories/medicines'
import {
	completeShoppingItem,
	findActiveAutomaticForMedicine,
	insertShoppingItem,
	listActiveShoppingItems,
	updateShoppingItemFields,
} from '@/db/repositories/shoppingItems'
import { SqlExecutor } from '@/db/sqlExecutor'
import { MedicineSummary, ShoppingReason } from '@/db/types'
import { analytics } from '@/services/analytics'
import { logger } from '@/services/logging'

export interface SyncShoppingResult {
	created: number
	updated: number
	completed: number
}

/**
 * Reconciles automatic shopping items from Phase 2 stock status.
 * Manual items are never created/removed here.
 * Idempotent: one active automatic row per medicine.
 *
 * Recovery policy: when stock returns to in_stock, automatic active items
 * are marked completed (kept in completed history).
 */
export async function syncAutomaticShoppingItems (
	db: SqlExecutor,
	householdId: string,
): Promise<SyncShoppingResult> {
	const summaries = await listMedicineSummaries(db, {
		householdId,
		sort: 'name',
	})
	const activeAutos = (
		await listActiveShoppingItems(db, householdId)
	).filter((item) => item.source === 'automatic' && item.medicineId)

	const autoByMedicine = new Map(
		activeAutos.map((item) => [item.medicineId as string, item]),
	)

	let created = 0
	let updated = 0
	let completed = 0

	const needing = new Map<string, { summary: MedicineSummary; reason: ShoppingReason }>()
	for (const summary of summaries) {
		if (summary.stockStatus === 'empty') {
			needing.set(summary.medicine.id, { summary, reason: 'empty' })
		} else if (summary.stockStatus === 'low') {
			needing.set(summary.medicine.id, { summary, reason: 'low_stock' })
		}
	}

	for (const [medicineId, { reason }] of needing) {
		const existing = autoByMedicine.get(medicineId)
		if (!existing) {
			try {
				await insertShoppingItem(db, {
					householdId,
					medicineId,
					reason,
					source: 'automatic',
					unit: needing.get(medicineId)?.summary.unit ?? null,
				})
				created += 1
			} catch (error) {
				// Unique index race: fetch and update instead.
				const raced = await findActiveAutomaticForMedicine(db, medicineId)
				if (raced && raced.reason !== reason) {
					await updateShoppingItemFields(db, raced.id, { reason })
					updated += 1
				} else if (!raced) {
					logger.error('Automatic shopping insert failed', error)
					analytics.reportError(error, {
						source: 'syncAutomaticShoppingItems.insert',
					})
				}
			}
			continue
		}
		if (existing.reason !== reason) {
			await updateShoppingItemFields(db, existing.id, { reason })
			updated += 1
		}
		autoByMedicine.delete(medicineId)
	}

	// Remaining automatic actives → stock recovered → complete.
	for (const leftover of autoByMedicine.values()) {
		await completeShoppingItem(db, leftover.id)
		completed += 1
	}

	return { created, updated, completed }
}

/**
 * Non-throwing wrapper for UI / intake / bootstrap callers.
 */
export async function safeSyncAutomaticShoppingItems (
	db: SqlExecutor,
	householdId: string,
): Promise<void> {
	try {
		await syncAutomaticShoppingItems(db, householdId)
	} catch (error) {
		logger.error('Automatic shopping sync failed', error)
		analytics.reportError(error, { source: 'safeSyncAutomaticShoppingItems' })
	}
}
