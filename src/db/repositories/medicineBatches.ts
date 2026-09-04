import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { getExpiryPrecision } from '@/utils/expiry'
import { SqlExecutor } from '../sqlExecutor'
import {
	AfterOpeningUnit,
	MedicineBatch,
	MedicineUnit,
} from '../types'
import { assertLocationBelongsToCabinet } from './storageLocations'

interface BatchRow {
	id: string
	medicine_id: string
	cabinet_id: string
	storage_location_id: string | null
	quantity: number
	unit: string
	expiry_date: string | null
	opened_at: string | null
	after_opening_value: number | null
	after_opening_unit: string | null
	purchase_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
	archived_at: string | null
}

function mapRow (row: BatchRow): MedicineBatch {
	return {
		id: row.id,
		medicineId: row.medicine_id,
		cabinetId: row.cabinet_id,
		storageLocationId: row.storage_location_id,
		quantity: row.quantity,
		unit: row.unit as MedicineUnit,
		expiryDate: row.expiry_date,
		openedAt: row.opened_at,
		afterOpeningValue: row.after_opening_value,
		afterOpeningUnit: row.after_opening_unit as AfterOpeningUnit | null,
		purchaseDate: row.purchase_date,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at ?? null,
	}
}

const SELECT_COLS = `
	id, medicine_id, cabinet_id, storage_location_id, quantity, unit,
	expiry_date, opened_at, after_opening_value, after_opening_unit,
	purchase_date, notes, created_at, updated_at, archived_at
`

export interface BatchInput {
	medicineId: string
	cabinetId: string
	storageLocationId?: string | null
	quantity: number
	unit: MedicineUnit
	expiryDate?: string | null
	openedAt?: string | null
	afterOpeningValue?: number | null
	afterOpeningUnit?: AfterOpeningUnit | null
	purchaseDate?: string | null
	notes?: string | null
}

export async function getBatchById (
	db: SqlExecutor,
	id: string,
): Promise<MedicineBatch | null> {
	const row = await db.getFirstAsync<BatchRow>(
		`SELECT ${SELECT_COLS} FROM medicine_batches WHERE id = ?`,
		[id],
	)
	return row ? mapRow(row) : null
}

export async function listBatchesForMedicine (
	db: SqlExecutor,
	medicineId: string,
	options?: { includeArchived?: boolean },
): Promise<MedicineBatch[]> {
	const includeArchived = options?.includeArchived ?? false
	const rows = await db.getAllAsync<BatchRow>(
		includeArchived
			? `SELECT ${SELECT_COLS}
				 FROM medicine_batches
				 WHERE medicine_id = ?
				 ORDER BY created_at ASC`
			: `SELECT ${SELECT_COLS}
				 FROM medicine_batches
				 WHERE medicine_id = ? AND archived_at IS NULL
				 ORDER BY created_at ASC`,
		[medicineId],
	)
	return rows.map(mapRow)
}

export async function createBatch (
	db: SqlExecutor,
	input: BatchInput,
): Promise<MedicineBatch> {
	await validateBatchInput(db, input)

	const timestamp = nowIso()
	const batch: MedicineBatch = {
		id: createId('batch'),
		medicineId: input.medicineId,
		cabinetId: input.cabinetId,
		storageLocationId: input.storageLocationId ?? null,
		quantity: input.quantity,
		unit: input.unit,
		expiryDate: normalizeOptionalExpiry(input.expiryDate),
		openedAt: emptyToNull(input.openedAt),
		afterOpeningValue: input.afterOpeningValue ?? null,
		afterOpeningUnit: input.afterOpeningUnit ?? null,
		purchaseDate: emptyToNull(input.purchaseDate),
		notes: emptyToNull(input.notes),
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
	}

	await db.runAsync(
		`INSERT INTO medicine_batches
			(id, medicine_id, cabinet_id, storage_location_id, quantity, unit,
			 expiry_date, opened_at, after_opening_value, after_opening_unit,
			 purchase_date, notes, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			batch.id,
			batch.medicineId,
			batch.cabinetId,
			batch.storageLocationId,
			batch.quantity,
			batch.unit,
			batch.expiryDate,
			batch.openedAt,
			batch.afterOpeningValue,
			batch.afterOpeningUnit,
			batch.purchaseDate,
			batch.notes,
			batch.createdAt,
			batch.updatedAt,
		],
	)

	return batch
}

export async function updateBatch (
	db: SqlExecutor,
	id: string,
	input: Omit<BatchInput, 'medicineId'>,
): Promise<MedicineBatch> {
	const existing = await getBatchById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Batch not found')
	}

	const nextInput: BatchInput = {
		medicineId: existing.medicineId,
		cabinetId: input.cabinetId,
		storageLocationId: input.storageLocationId,
		quantity: input.quantity,
		unit: input.unit,
		expiryDate: input.expiryDate,
		openedAt: input.openedAt,
		afterOpeningValue: input.afterOpeningValue,
		afterOpeningUnit: input.afterOpeningUnit,
		purchaseDate: input.purchaseDate,
		notes: input.notes,
	}

	await validateBatchInput(db, nextInput, id)

	const updatedAt = nowIso()
	const next: MedicineBatch = {
		...existing,
		cabinetId: nextInput.cabinetId,
		storageLocationId: nextInput.storageLocationId ?? null,
		quantity: nextInput.quantity,
		unit: nextInput.unit,
		expiryDate: normalizeOptionalExpiry(nextInput.expiryDate),
		openedAt: emptyToNull(nextInput.openedAt),
		afterOpeningValue: nextInput.afterOpeningValue ?? null,
		afterOpeningUnit: nextInput.afterOpeningUnit ?? null,
		purchaseDate: emptyToNull(nextInput.purchaseDate),
		notes: emptyToNull(nextInput.notes),
		updatedAt,
	}

	await db.runAsync(
		`UPDATE medicine_batches
		 SET cabinet_id = ?, storage_location_id = ?, quantity = ?, unit = ?,
			 expiry_date = ?, opened_at = ?, after_opening_value = ?,
			 after_opening_unit = ?, purchase_date = ?, notes = ?, updated_at = ?
		 WHERE id = ?`,
		[
			next.cabinetId,
			next.storageLocationId,
			next.quantity,
			next.unit,
			next.expiryDate,
			next.openedAt,
			next.afterOpeningValue,
			next.afterOpeningUnit,
			next.purchaseDate,
			next.notes,
			next.updatedAt,
			id,
		],
	)

	return next
}

export async function archiveBatch (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const existing = await getBatchById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Batch not found')
	}

	const timestamp = nowIso()
	await db.runAsync(
		`UPDATE medicine_batches
		 SET archived_at = ?, updated_at = ?
		 WHERE id = ?`,
		[timestamp, timestamp, id],
	)
}

/**
 * Returns the unit used by active packs, if any.
 */
export async function getActiveUnitForMedicine (
	db: SqlExecutor,
	medicineId: string,
): Promise<MedicineUnit | null> {
	const row = await db.getFirstAsync<{ unit: string }>(
		`SELECT unit FROM medicine_batches
		 WHERE medicine_id = ? AND archived_at IS NULL
		 ORDER BY created_at ASC
		 LIMIT 1`,
		[medicineId],
	)
	return row ? (row.unit as MedicineUnit) : null
}

/**
 * Prefill hints for «Пополнить» from the latest active pack.
 */
export async function getLatestActiveBatchPrefill (
	db: SqlExecutor,
	medicineId: string,
): Promise<{
	cabinetId: string
	storageLocationId: string | null
	unit: MedicineUnit
} | null> {
	const row = await db.getFirstAsync<{
		cabinet_id: string
		storage_location_id: string | null
		unit: string
	}>(
		`SELECT cabinet_id, storage_location_id, unit
		 FROM medicine_batches
		 WHERE medicine_id = ? AND archived_at IS NULL
		 ORDER BY created_at DESC
		 LIMIT 1`,
		[medicineId],
	)
	if (!row) {
		return null
	}
	return {
		cabinetId: row.cabinet_id,
		storageLocationId: row.storage_location_id,
		unit: row.unit as MedicineUnit,
	}
}

async function validateBatchInput (
	db: SqlExecutor,
	input: BatchInput,
	excludeBatchId: string | null = null,
): Promise<void> {
	const medicine = await db.getFirstAsync<{
		id: string
		archived_at: string | null
	}>(`SELECT id, archived_at FROM medicines WHERE id = ?`, [input.medicineId])
	if (!medicine || medicine.archived_at) {
		throw new Error('Medicine not found')
	}

	if (!Number.isFinite(input.quantity) || input.quantity < 0) {
		throw new Error('INVALID_QUANTITY')
	}

	await assertLocationBelongsToCabinet(
		db,
		input.storageLocationId,
		input.cabinetId,
	)

	await assertCompatibleUnit(db, input.medicineId, input.unit, excludeBatchId)

	if (input.expiryDate) {
		const precision = getExpiryPrecision(input.expiryDate)
		if (precision === 'unknown') {
			throw new Error('INVALID_EXPIRY')
		}
	}

	if (
		(input.afterOpeningValue !== null &&
			input.afterOpeningValue !== undefined) ||
		input.afterOpeningUnit
	) {
		if (
			input.afterOpeningValue === null ||
			input.afterOpeningValue === undefined ||
			!Number.isFinite(input.afterOpeningValue) ||
			input.afterOpeningValue <= 0 ||
			!input.afterOpeningUnit
		) {
			throw new Error('INVALID_AFTER_OPENING')
		}
	}
}

/**
 * Blocks saving a pack unit that conflicts with other active packs.
 */
async function assertCompatibleUnit (
	db: SqlExecutor,
	medicineId: string,
	unit: MedicineUnit,
	excludeBatchId: string | null,
): Promise<void> {
	const rows = await db.getAllAsync<{ id: string; unit: string }>(
		excludeBatchId
			? `SELECT id, unit FROM medicine_batches
				 WHERE medicine_id = ? AND archived_at IS NULL AND id != ?`
			: `SELECT id, unit FROM medicine_batches
				 WHERE medicine_id = ? AND archived_at IS NULL`,
		excludeBatchId ? [medicineId, excludeBatchId] : [medicineId],
	)

	for (const row of rows) {
		if (row.unit !== unit) {
			const error = new Error('INCOMPATIBLE_UNIT')
			error.name = 'INCOMPATIBLE_UNIT'
			throw error
		}
	}
}

function normalizeOptionalExpiry (
	value: string | null | undefined,
): string | null {
	if (!value) {
		return null
	}
	const precision = getExpiryPrecision(value)
	return precision === 'unknown' ? null : value
}

function emptyToNull (value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null
	}
	const trimmed = value.trim()
	return trimmed.length === 0 ? null : trimmed
}
