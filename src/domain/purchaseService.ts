import { createBatch, BatchInput } from '@/db/repositories/medicineBatches'
import {
	completeShoppingItem,
	findActiveForMedicine,
	getShoppingItemById,
	insertShoppingItem,
	reactivateShoppingItem,
} from '@/db/repositories/shoppingItems'
import { SqlExecutor } from '@/db/sqlExecutor'
import { MedicineUnit, ShoppingItem } from '@/db/types'
import { AnalyticsEvents, analytics } from '@/services/analytics'
import { syncAutomaticShoppingItems } from './shoppingService'

/**
 * Adds a medicine to the shopping list (manual). Dedupes against any active item.
 */
export async function addMedicineToShopping (
	db: SqlExecutor,
	input: {
		householdId: string
		medicineId: string
		unit?: MedicineUnit | null
		note?: string | null
	},
): Promise<{ item: ShoppingItem; created: boolean }> {
	const existing = await findActiveForMedicine(db, input.medicineId)
	if (existing) {
		return { item: existing, created: false }
	}
	const item = await insertShoppingItem(db, {
		householdId: input.householdId,
		medicineId: input.medicineId,
		unit: input.unit ?? null,
		reason: 'manual',
		source: 'manual',
		note: input.note,
	})
	analytics.trackEvent(AnalyticsEvents.SHOPPING_ITEM_ADDED, {
		source: 'manual',
	})
	return { item, created: true }
}

/**
 * Adds a free-text custom shopping item.
 */
export async function addCustomShoppingItem (
	db: SqlExecutor,
	input: { householdId: string; customName: string; note?: string | null },
): Promise<ShoppingItem> {
	const name = input.customName.trim()
	if (!name) {
		throw new Error('INVALID_NAME')
	}
	const item = await insertShoppingItem(db, {
		householdId: input.householdId,
		customName: name,
		reason: 'manual',
		source: 'manual',
		note: input.note,
	})
	analytics.trackEvent(AnalyticsEvents.SHOPPING_ITEM_ADDED, {
		source: 'manual',
	})
	return item
}

/**
 * Completes purchase by creating a new batch for an existing medicine.
 * Atomic: batch + shopping complete in one transaction.
 * Idempotent: if item already completed, returns without creating another batch.
 */
export async function markPurchasedWithBatch (
	db: SqlExecutor,
	input: {
		shoppingItemId: string
		batch: BatchInput
	},
): Promise<{ shoppingItem: ShoppingItem; batchId: string }> {
	const run = async () => {
		const item = await getShoppingItemById(db, input.shoppingItemId)
		if (!item) {
			throw new Error('Shopping item not found')
		}
		if (item.status === 'completed') {
			throw new Error('ALREADY_COMPLETED')
		}
		if (!item.medicineId) {
			throw new Error('NO_MEDICINE')
		}
		if (input.batch.medicineId !== item.medicineId) {
			throw new Error('MEDICINE_MISMATCH')
		}

		const batch = await createBatch(db, input.batch)
		const completed = await completeShoppingItem(db, item.id)
		await syncAutomaticShoppingItems(db, item.householdId)
		return { shoppingItem: completed, batchId: batch.id }
	}

	if (db.withTransactionAsync) {
		const result = await db.withTransactionAsync(run)
		analytics.trackEvent(AnalyticsEvents.SHOPPING_COMPLETED, {
			type: 'medicine',
		})
		return result
	}
	const result = await run()
	analytics.trackEvent(AnalyticsEvents.SHOPPING_COMPLETED, {
		type: 'medicine',
	})
	return result
}

/**
 * Marks a custom (or any) item completed without creating a batch.
 */
export async function markPurchasedSimple (
	db: SqlExecutor,
	shoppingItemId: string,
): Promise<ShoppingItem> {
	const item = await getShoppingItemById(db, shoppingItemId)
	if (!item) {
		throw new Error('Shopping item not found')
	}
	if (item.status === 'completed') {
		return item
	}
	const completed = await completeShoppingItem(db, shoppingItemId)
	analytics.trackEvent(AnalyticsEvents.SHOPPING_COMPLETED, {
		type: item.medicineId ? 'medicine' : 'custom',
	})
	return completed
}

/**
 * Restores a completed manual item to active (if stock still needs it for auto).
 * For automatic items: re-run sync instead of blind restore.
 */
export async function restoreManualShoppingItem (
	db: SqlExecutor,
	shoppingItemId: string,
): Promise<ShoppingItem> {
	const item = await getShoppingItemById(db, shoppingItemId)
	if (!item) {
		throw new Error('Shopping item not found')
	}
	if (item.source === 'automatic') {
		await syncAutomaticShoppingItems(db, item.householdId)
		const refreshed = await getShoppingItemById(db, shoppingItemId)
		if (!refreshed) {
			throw new Error('Shopping item not found')
		}
		return refreshed
	}
	if (item.medicineId) {
		const active = await findActiveForMedicine(db, item.medicineId)
		if (active && active.id !== item.id) {
			return active
		}
	}
	return reactivateShoppingItem(db, shoppingItemId)
}
