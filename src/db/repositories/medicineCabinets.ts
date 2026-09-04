import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import { MedicineCabinet } from '../types'

interface CabinetRow {
	id: string
	household_id: string
	name: string
	created_at: string
	updated_at: string
	archived_at: string | null
}

function mapRow (row: CabinetRow): MedicineCabinet {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at ?? null,
	}
}

const SELECT_COLS = `id, household_id, name, created_at, updated_at, archived_at`

export async function listCabinetsByHousehold (
	db: SqlExecutor,
	householdId: string,
	options?: { includeArchived?: boolean },
): Promise<MedicineCabinet[]> {
	const includeArchived = options?.includeArchived ?? false
	const rows = await db.getAllAsync<CabinetRow>(
		includeArchived
			? `SELECT ${SELECT_COLS}
				 FROM medicine_cabinets
				 WHERE household_id = ?
				 ORDER BY name COLLATE NOCASE ASC`
			: `SELECT ${SELECT_COLS}
				 FROM medicine_cabinets
				 WHERE household_id = ? AND archived_at IS NULL
				 ORDER BY name COLLATE NOCASE ASC`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function getCabinetById (
	db: SqlExecutor,
	id: string,
): Promise<MedicineCabinet | null> {
	const row = await db.getFirstAsync<CabinetRow>(
		`SELECT ${SELECT_COLS} FROM medicine_cabinets WHERE id = ?`,
		[id],
	)
	return row ? mapRow(row) : null
}

export async function countCabinets (db: SqlExecutor): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM medicine_cabinets WHERE archived_at IS NULL`,
	)
	return row?.count ?? 0
}

export async function createCabinet (
	db: SqlExecutor,
	input: { householdId: string; name: string },
): Promise<MedicineCabinet> {
	const timestamp = nowIso()
	const cabinet: MedicineCabinet = {
		id: createId('cab'),
		householdId: input.householdId,
		name: input.name.trim(),
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
	}

	await db.runAsync(
		`INSERT INTO medicine_cabinets
			(id, household_id, name, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, NULL)`,
		[
			cabinet.id,
			cabinet.householdId,
			cabinet.name,
			cabinet.createdAt,
			cabinet.updatedAt,
		],
	)

	return cabinet
}

export async function updateCabinet (
	db: SqlExecutor,
	id: string,
	input: { name: string },
): Promise<MedicineCabinet> {
	const existing = await getCabinetById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Cabinet not found')
	}

	const updatedAt = nowIso()
	const name = input.name.trim()
	await db.runAsync(
		`UPDATE medicine_cabinets SET name = ?, updated_at = ? WHERE id = ?`,
		[name, updatedAt, id],
	)

	return { ...existing, name, updatedAt }
}

/**
 * Soft-archives a cabinet when it has no active batches.
 * Throws a typed error code when batches still exist.
 */
export async function archiveCabinet (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const existing = await getCabinetById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Cabinet not found')
	}

	const activeBatches = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count
		 FROM medicine_batches
		 WHERE cabinet_id = ? AND archived_at IS NULL`,
		[id],
	)

	if ((activeBatches?.count ?? 0) > 0) {
		const error = new Error('CABINET_HAS_ACTIVE_BATCHES')
		error.name = 'CABINET_HAS_ACTIVE_BATCHES'
		throw error
	}

	await db.runAsync(
		`UPDATE medicine_cabinets
		 SET archived_at = ?, updated_at = ?
		 WHERE id = ?`,
		[nowIso(), nowIso(), id],
	)
}

export async function countActiveBatchesInCabinet (
	db: SqlExecutor,
	cabinetId: string,
): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count
		 FROM medicine_batches
		 WHERE cabinet_id = ? AND archived_at IS NULL`,
		[cabinetId],
	)
	return row?.count ?? 0
}
