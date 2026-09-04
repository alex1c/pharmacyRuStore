import { aggregateMedicineBatches } from '@/domain/medicineSummary'
import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import {
	Medicine,
	MedicineForm,
	MedicineSummary,
	MedicineUnit,
} from '../types'
import { listBatchesForMedicine } from './medicineBatches'
import { getCabinetById } from './medicineCabinets'

interface MedicineRow {
	id: string
	household_id: string
	name: string
	form: string
	strength_text: string | null
	notes: string | null
	photo_uri: string | null
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
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at ?? null,
	}
}

const SELECT_COLS = `
	id, household_id, name, form, strength_text, notes, photo_uri,
	created_at, updated_at, archived_at
`

export type MedicineSort = 'name' | 'nearestExpiry' | 'createdAt'

export interface ListMedicinesOptions {
	householdId: string
	cabinetId?: string | null
	query?: string
	sort?: MedicineSort
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
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
	}

	await db.runAsync(
		`INSERT INTO medicines
			(id, household_id, name, form, strength_text, notes, photo_uri,
			 created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			medicine.id,
			medicine.householdId,
			medicine.name,
			medicine.form,
			medicine.strengthText,
			medicine.notes,
			medicine.photoUri,
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
		updatedAt,
	}

	await db.runAsync(
		`UPDATE medicines
		 SET name = ?, form = ?, strength_text = ?, notes = ?, photo_uri = ?,
			 updated_at = ?
		 WHERE id = ?`,
		[
			next.name,
			next.form,
			next.strengthText,
			next.notes,
			next.photoUri,
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

	const batches = await listBatchesForMedicine(db, medicineId)
	const stock = aggregateMedicineBatches(batches)
	const primaryCabinet = stock.primaryCabinetId
		? await getCabinetById(db, stock.primaryCabinetId)
		: null

	return {
		medicine,
		totalQuantity: stock.totalQuantity,
		unit: stock.unit,
		nearestExpiry: stock.nearestExpiry,
		activeBatchCount: stock.activeBatchCount,
		primaryCabinetName: primaryCabinet?.name ?? null,
	}
}

export async function listMedicineSummaries (
	db: SqlExecutor,
	options: ListMedicinesOptions,
): Promise<MedicineSummary[]> {
	const medicines = await listMedicines(db, options)
	const summaries: MedicineSummary[] = []

	for (const medicine of medicines) {
		const summary = await getMedicineSummary(db, medicine.id)
		if (summary) {
			summaries.push(summary)
		}
	}

	return sortSummaries(summaries, options.sort ?? 'name')
}

export async function listMedicines (
	db: SqlExecutor,
	options: ListMedicinesOptions,
): Promise<Medicine[]> {
	const params: (string | number | null)[] = []
	let sql = `
		SELECT DISTINCT m.id, m.household_id, m.name, m.form, m.strength_text,
			m.notes, m.photo_uri, m.created_at, m.updated_at, m.archived_at
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

	// SQLite NOCASE is ASCII-only — filter Russian text in JS.
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
	if (sort === 'nearestExpiry') {
		copy.sort((a, b) => {
			if (!a.nearestExpiry && !b.nearestExpiry) {
				return a.medicine.name.localeCompare(b.medicine.name, 'ru')
			}
			if (!a.nearestExpiry) {
				return 1
			}
			if (!b.nearestExpiry) {
				return -1
			}
			if (a.nearestExpiry === b.nearestExpiry) {
				return a.medicine.name.localeCompare(b.medicine.name, 'ru')
			}
			return a.nearestExpiry < b.nearestExpiry ? -1 : 1
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

export type { MedicineUnit }
