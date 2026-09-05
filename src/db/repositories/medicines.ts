import {
	compareAttentionPriority,
	getMedicineInventorySummary,
} from '@/domain/medicineSummary'
import { aggregateMedicineBatches } from '@/domain/legacyAggregate'
import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import {
	AfterOpeningUnit,
	Medicine,
	MedicineBatch,
	MedicineForm,
	MedicineSummary,
	MedicineUnit,
} from '../types'
import { listBatchesForMedicine } from './medicineBatches'
import { getCabinetById } from './medicineCabinets'
import { getAppSettings } from './settings'

interface MedicineRow {
	id: string
	household_id: string
	name: string
	form: string
	strength_text: string | null
	notes: string | null
	photo_uri: string | null
	low_stock_threshold: number | null
	created_at: string
	updated_at: string
	archived_at: string | null
}

function mapRow (row: MedicineRow): Medicine {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		form: row.form as MedicineForm,
		strengthText: row.strength_text,
		notes: row.notes,
		photoUri: row.photo_uri,
		lowStockThreshold:
			row.low_stock_threshold === null || row.low_stock_threshold === undefined
				? null
				: Number(row.low_stock_threshold),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at ?? null,
	}
}

const SELECT_COLS = `
	id, household_id, name, form, strength_text, notes, photo_uri,
	low_stock_threshold, created_at, updated_at, archived_at
`

export type MedicineSort =
	| 'name'
	| 'nearestExpiry'
	| 'createdAt'
	| 'attention'

export type MedicineAttentionFilter =
	| 'all'
	| 'attention'
	| 'expired'
	| 'expiring'

export interface ListMedicinesOptions {
	householdId: string
	cabinetId?: string | null
	query?: string
	sort?: MedicineSort
	attentionFilter?: MedicineAttentionFilter
}

export async function getMedicineById (
	db: SqlExecutor,
	id: string,
): Promise<Medicine | null> {
	const row = await db.getFirstAsync<MedicineRow>(
		`SELECT ${SELECT_COLS} FROM medicines WHERE id = ?`,
		[id],
	)
	return row ? mapRow(row) : null
}

export async function createMedicine (
	db: SqlExecutor,
	input: {
		householdId: string
		name: string
		form?: MedicineForm
		strengthText?: string | null
		notes?: string | null
		photoUri?: string | null
		lowStockThreshold?: number | null
	},
): Promise<Medicine> {
	const name = input.name.trim()
	if (!name) {
		throw new Error('Medicine name is required')
	}

	const timestamp = nowIso()
	const medicine: Medicine = {
		id: createId('med'),
		householdId: input.householdId,
		name,
		form: input.form ?? 'other',
		strengthText: emptyToNull(input.strengthText),
		notes: emptyToNull(input.notes),
		photoUri: input.photoUri ?? null,
		lowStockThreshold: normalizeThreshold(input.lowStockThreshold),
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
	}

	await db.runAsync(
		`INSERT INTO medicines
			(id, household_id, name, form, strength_text, notes, photo_uri,
			 low_stock_threshold, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			medicine.id,
			medicine.householdId,
			medicine.name,
			medicine.form,
			medicine.strengthText,
			medicine.notes,
			medicine.photoUri,
			medicine.lowStockThreshold,
			medicine.createdAt,
			medicine.updatedAt,
		],
	)

	return medicine
}

export async function updateMedicine (
	db: SqlExecutor,
	id: string,
	input: {
		name: string
		form: MedicineForm
		strengthText?: string | null
		notes?: string | null
		photoUri?: string | null
		lowStockThreshold?: number | null
	},
): Promise<Medicine> {
	const existing = await getMedicineById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Medicine not found')
	}

	const name = input.name.trim()
	if (!name) {
		throw new Error('Medicine name is required')
	}

	const updatedAt = nowIso()
	const next: Medicine = {
		...existing,
		name,
		form: input.form,
		strengthText: emptyToNull(input.strengthText),
		notes: emptyToNull(input.notes),
		photoUri:
			input.photoUri === undefined ? existing.photoUri : input.photoUri,
		lowStockThreshold:
			input.lowStockThreshold === undefined
				? existing.lowStockThreshold
				: normalizeThreshold(input.lowStockThreshold),
		updatedAt,
	}

	await db.runAsync(
		`UPDATE medicines
		 SET name = ?, form = ?, strength_text = ?, notes = ?, photo_uri = ?,
			 low_stock_threshold = ?, updated_at = ?
		 WHERE id = ?`,
		[
			next.name,
			next.form,
			next.strengthText,
			next.notes,
			next.photoUri,
			next.lowStockThreshold,
			next.updatedAt,
			id,
		],
	)

	return next
}

export async function archiveMedicine (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const existing = await getMedicineById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Medicine not found')
	}

	const timestamp = nowIso()
	const run = async () => {
		// Stop future occurrences while retaining courses, schedules, intakes and
		// movements as immutable historical references.
		await db.runAsync(
			`UPDATE medication_courses
			 SET archived_at = ?, updated_at = ?
			 WHERE medicine_id = ? AND archived_at IS NULL`,
			[timestamp, timestamp, id],
		)
		await db.runAsync(
			`UPDATE medicine_batches
			 SET archived_at = ?, updated_at = ?
			 WHERE medicine_id = ? AND archived_at IS NULL`,
			[timestamp, timestamp, id],
		)
		await db.runAsync(
			`UPDATE medicines
			 SET archived_at = ?, updated_at = ?
			 WHERE id = ?`,
			[timestamp, timestamp, id],
		)
	}

	if (db.withTransactionAsync) {
		await db.withTransactionAsync(run)
	} else {
		await run()
	}
}

export async function getMedicineSummary (
	db: SqlExecutor,
	medicineId: string,
): Promise<MedicineSummary | null> {
	const medicine = await getMedicineById(db, medicineId)
	if (!medicine || medicine.archivedAt) {
		return null
	}

	const settings = await getAppSettings(db)
	const batches = await listBatchesForMedicine(db, medicineId)
	const stock = aggregateMedicineBatches(batches)
	const primaryCabinet = stock.primaryCabinetId
		? await getCabinetById(db, stock.primaryCabinetId)
		: null

	return getMedicineInventorySummary({
		medicine,
		batches,
		settings,
		primaryCabinetName: primaryCabinet?.name ?? null,
	})
}

export async function listMedicineSummaries (
	db: SqlExecutor,
	options: ListMedicinesOptions,
): Promise<MedicineSummary[]> {
	const medicines = await listMedicines(db, options)
	if (medicines.length === 0) {
		return []
	}

	const settings = await getAppSettings(db)
	const ids = medicines.map((item) => item.id)
	const placeholders = ids.map(() => '?').join(', ')
	const batchRows = await db.getAllAsync<{
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
	}>(
		`SELECT id, medicine_id, cabinet_id, storage_location_id, quantity, unit,
			expiry_date, opened_at, after_opening_value, after_opening_unit,
			purchase_date, notes, created_at, updated_at, archived_at
		 FROM medicine_batches
		 WHERE medicine_id IN (${placeholders}) AND archived_at IS NULL`,
		ids,
	)

	const batchesByMedicine = new Map<string, typeof batchRows>()
	for (const row of batchRows) {
		const list = batchesByMedicine.get(row.medicine_id) ?? []
		list.push(row)
		batchesByMedicine.set(row.medicine_id, list)
	}

	const cabinetIds = [
		...new Set(batchRows.map((row) => row.cabinet_id)),
	]
	const cabinetNames = new Map<string, string>()
	for (const cabinetId of cabinetIds) {
		const cabinet = await getCabinetById(db, cabinetId)
		if (cabinet) {
			cabinetNames.set(cabinetId, cabinet.name)
		}
	}

	const summaries: MedicineSummary[] = medicines.map((medicine) => {
		const rows = batchesByMedicine.get(medicine.id) ?? []
		const batches: MedicineBatch[] = rows.map((row) => ({
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
			lotNumber: null,
			serialNumber: null,
			scannedCodeRaw: null,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			archivedAt: row.archived_at,
		}))

		const stock = aggregateMedicineBatches(batches)
		const primaryCabinetName = stock.primaryCabinetId
			? cabinetNames.get(stock.primaryCabinetId) ?? null
			: null

		return getMedicineInventorySummary({
			medicine,
			batches,
			settings,
			primaryCabinetName,
		})
	})

	const filtered = filterByAttention(summaries, options.attentionFilter ?? 'all')
	return sortSummaries(filtered, options.sort ?? 'name')
}

export async function listMedicines (
	db: SqlExecutor,
	options: ListMedicinesOptions,
): Promise<Medicine[]> {
	const params: (string | number | null)[] = []
	let sql = `
		SELECT DISTINCT m.id, m.household_id, m.name, m.form, m.strength_text,
			m.notes, m.photo_uri, m.low_stock_threshold, m.created_at, m.updated_at,
			m.archived_at
		FROM medicines m
	`

	if (options.cabinetId) {
		sql += `
			INNER JOIN medicine_batches b
				ON b.medicine_id = m.id
				AND b.archived_at IS NULL
				AND b.cabinet_id = ?
		`
		params.push(options.cabinetId)
	}

	sql += ` WHERE m.household_id = ? AND m.archived_at IS NULL`
	params.push(options.householdId)
	sql += ` ORDER BY m.name COLLATE NOCASE ASC`

	const rows = await db.getAllAsync<MedicineRow>(sql, params)
	const medicines = rows.map(mapRow)

	const query = options.query?.trim()
	if (!query) {
		return medicines
	}

	const needle = query.toLocaleLowerCase('ru-RU')
	return medicines.filter((medicine) => {
		const haystack = [
			medicine.name,
			medicine.strengthText ?? '',
			medicine.notes ?? '',
		]
			.join(' ')
			.toLocaleLowerCase('ru-RU')
		return haystack.includes(needle)
	})
}

export async function countActiveMedicines (
	db: SqlExecutor,
	householdId: string,
): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM medicines
		 WHERE household_id = ? AND archived_at IS NULL`,
		[householdId],
	)
	return row?.count ?? 0
}

export async function countActiveBatches (
	db: SqlExecutor,
	householdId: string,
): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count
		 FROM medicine_batches b
		 INNER JOIN medicines m ON m.id = b.medicine_id
		 WHERE m.household_id = ?
			 AND m.archived_at IS NULL
			 AND b.archived_at IS NULL`,
		[householdId],
	)
	return row?.count ?? 0
}

function filterByAttention (
	summaries: MedicineSummary[],
	filter: MedicineAttentionFilter,
): MedicineSummary[] {
	if (filter === 'all') {
		return summaries
	}
	if (filter === 'attention') {
		return summaries.filter((item) => item.attentionKind !== null)
	}
	if (filter === 'expired') {
		return summaries.filter((item) => item.attentionKind === 'expired')
	}
	return summaries.filter((item) => item.attentionKind === 'expiring_soon')
}

function sortSummaries (
	summaries: MedicineSummary[],
	sort: MedicineSort,
): MedicineSummary[] {
	const copy = [...summaries]
	if (sort === 'createdAt') {
		copy.sort((a, b) =>
			a.medicine.createdAt < b.medicine.createdAt ? 1 : -1,
		)
		return copy
	}
	if (sort === 'attention') {
		copy.sort((a, b) => {
			const byKind = compareAttentionPriority(a.attentionKind, b.attentionKind)
			if (byKind !== 0) {
				return byKind
			}
			const aDate = a.nearestEffectiveExpiry
			const bDate = b.nearestEffectiveExpiry
			if (aDate && bDate && aDate !== bDate) {
				return aDate < bDate ? -1 : 1
			}
			return a.medicine.name.localeCompare(b.medicine.name, 'ru')
		})
		return copy
	}
	if (sort === 'nearestExpiry') {
		copy.sort((a, b) => {
			const aDate = a.nearestEffectiveExpiry ?? a.nearestExpiry
			const bDate = b.nearestEffectiveExpiry ?? b.nearestExpiry
			if (!aDate && !bDate) {
				return a.medicine.name.localeCompare(b.medicine.name, 'ru')
			}
			if (!aDate) {
				return 1
			}
			if (!bDate) {
				return -1
			}
			if (aDate === bDate) {
				return a.medicine.name.localeCompare(b.medicine.name, 'ru')
			}
			return aDate < bDate ? -1 : 1
		})
		return copy
	}

	copy.sort((a, b) => a.medicine.name.localeCompare(b.medicine.name, 'ru'))
	return copy
}

function emptyToNull (value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null
	}
	const trimmed = value.trim()
	return trimmed.length === 0 ? null : trimmed
}

function normalizeThreshold (
	value: number | null | undefined,
): number | null {
	if (value === null || value === undefined) {
		return null
	}
	if (!Number.isFinite(value) || value < 0) {
		throw new Error('INVALID_LOW_STOCK_THRESHOLD')
	}
	return value
}

export type { MedicineUnit }
