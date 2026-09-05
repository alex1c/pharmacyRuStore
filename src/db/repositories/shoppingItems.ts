import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import {
	MedicineUnit,
	ShoppingItem,
	ShoppingReason,
	ShoppingSource,
	ShoppingStatus,
} from '../types'

interface ShoppingRow {
	id: string
	household_id: string
	medicine_id: string | null
	custom_name: string | null
	desired_quantity: number | null
	unit: string | null
	reason: string
	source: string
	status: string
	note: string | null
	created_at: string
	updated_at: string
	completed_at: string | null
	archived_at: string | null
}

function mapRow (row: ShoppingRow): ShoppingItem {
	return {
		id: row.id,
		householdId: row.household_id,
		medicineId: row.medicine_id,
		customName: row.custom_name,
		desiredQuantity: row.desired_quantity,
		unit: (row.unit as MedicineUnit | null) ?? null,
		reason: row.reason as ShoppingReason,
		source: row.source as ShoppingSource,
		status: row.status as ShoppingStatus,
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		completedAt: row.completed_at,
		archivedAt: row.archived_at,
	}
}

const SELECT_COLS = `
	id, household_id, medicine_id, custom_name, desired_quantity, unit,
	reason, source, status, note, created_at, updated_at, completed_at, archived_at
`

export async function getShoppingItemById (
	db: SqlExecutor,
	id: string,
): Promise<ShoppingItem | null> {
	const row = await db.getFirstAsync<ShoppingRow>(
		`SELECT ${SELECT_COLS} FROM shopping_items WHERE id = ?`,
		[id],
	)
	return row ? mapRow(row) : null
}

export async function listActiveShoppingItems (
	db: SqlExecutor,
	householdId: string,
): Promise<ShoppingItem[]> {
	const rows = await db.getAllAsync<ShoppingRow>(
		`SELECT ${SELECT_COLS}
		 FROM shopping_items
		 WHERE household_id = ?
			 AND status = 'active'
			 AND archived_at IS NULL
		 ORDER BY created_at ASC`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function listCompletedShoppingItems (
	db: SqlExecutor,
	householdId: string,
	limit = 40,
): Promise<ShoppingItem[]> {
	const rows = await db.getAllAsync<ShoppingRow>(
		`SELECT ${SELECT_COLS}
		 FROM shopping_items
		 WHERE household_id = ?
			 AND status = 'completed'
			 AND archived_at IS NULL
		 ORDER BY completed_at DESC
		 LIMIT ?`,
		[householdId, limit],
	)
	return rows.map(mapRow)
}

export async function countActiveShoppingItems (
	db: SqlExecutor,
	householdId: string,
): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM shopping_items
		 WHERE household_id = ?
			 AND status = 'active'
			 AND archived_at IS NULL`,
		[householdId],
	)
	return row?.count ?? 0
}

export async function findActiveAutomaticForMedicine (
	db: SqlExecutor,
	medicineId: string,
): Promise<ShoppingItem | null> {
	const row = await db.getFirstAsync<ShoppingRow>(
		`SELECT ${SELECT_COLS}
		 FROM shopping_items
		 WHERE medicine_id = ?
			 AND source = 'automatic'
			 AND status = 'active'
			 AND archived_at IS NULL
		 LIMIT 1`,
		[medicineId],
	)
	return row ? mapRow(row) : null
}

export async function findActiveForMedicine (
	db: SqlExecutor,
	medicineId: string,
): Promise<ShoppingItem | null> {
	const row = await db.getFirstAsync<ShoppingRow>(
		`SELECT ${SELECT_COLS}
		 FROM shopping_items
		 WHERE medicine_id = ?
			 AND status = 'active'
			 AND archived_at IS NULL
		 ORDER BY
			 CASE source WHEN 'automatic' THEN 0 ELSE 1 END,
			 created_at ASC
		 LIMIT 1`,
		[medicineId],
	)
	return row ? mapRow(row) : null
}

export async function insertShoppingItem (
	db: SqlExecutor,
	input: {
		householdId: string
		medicineId?: string | null
		customName?: string | null
		desiredQuantity?: number | null
		unit?: MedicineUnit | null
		reason: ShoppingReason
		source: ShoppingSource
		note?: string | null
	},
): Promise<ShoppingItem> {
	const timestamp = nowIso()
	const item: ShoppingItem = {
		id: createId('shop'),
		householdId: input.householdId,
		medicineId: input.medicineId ?? null,
		customName: emptyToNull(input.customName),
		desiredQuantity: input.desiredQuantity ?? null,
		unit: input.unit ?? null,
		reason: input.reason,
		source: input.source,
		status: 'active',
		note: emptyToNull(input.note),
		createdAt: timestamp,
		updatedAt: timestamp,
		completedAt: null,
		archivedAt: null,
	}

	await db.runAsync(
		`INSERT INTO shopping_items
			(id, household_id, medicine_id, custom_name, desired_quantity, unit,
			 reason, source, status, note, created_at, updated_at, completed_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL, NULL)`,
		[
			item.id,
			item.householdId,
			item.medicineId,
			item.customName,
			item.desiredQuantity,
			item.unit,
			item.reason,
			item.source,
			item.note,
			item.createdAt,
			item.updatedAt,
		],
	)
	return item
}

export async function updateShoppingItemFields (
	db: SqlExecutor,
	id: string,
	fields: {
		reason?: ShoppingReason
		status?: ShoppingStatus
		note?: string | null
		desiredQuantity?: number | null
		completedAt?: string | null
	},
): Promise<ShoppingItem> {
	const existing = await getShoppingItemById(db, id)
	if (!existing) {
		throw new Error('Shopping item not found')
	}
	const updatedAt = nowIso()
	const next: ShoppingItem = {
		...existing,
		reason: fields.reason ?? existing.reason,
		status: fields.status ?? existing.status,
		note: fields.note !== undefined ? fields.note : existing.note,
		desiredQuantity:
			fields.desiredQuantity !== undefined
				? fields.desiredQuantity
				: existing.desiredQuantity,
		completedAt:
			fields.completedAt !== undefined
				? fields.completedAt
				: existing.completedAt,
		updatedAt,
	}
	await db.runAsync(
		`UPDATE shopping_items
		 SET reason = ?, status = ?, note = ?, desired_quantity = ?,
			 completed_at = ?, updated_at = ?
		 WHERE id = ?`,
		[
			next.reason,
			next.status,
			next.note,
			next.desiredQuantity,
			next.completedAt,
			next.updatedAt,
			id,
		],
	)
	return next
}

export async function completeShoppingItem (
	db: SqlExecutor,
	id: string,
): Promise<ShoppingItem> {
	return updateShoppingItemFields(db, id, {
		status: 'completed',
		completedAt: nowIso(),
	})
}

export async function reactivateShoppingItem (
	db: SqlExecutor,
	id: string,
): Promise<ShoppingItem> {
	return updateShoppingItemFields(db, id, {
		status: 'active',
		completedAt: null,
	})
}

function emptyToNull (value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null
	}
	const trimmed = value.trim()
	return trimmed.length === 0 ? null : trimmed
}
