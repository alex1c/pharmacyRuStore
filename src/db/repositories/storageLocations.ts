import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import { StorageLocation } from '../types'
import { getCabinetById } from './medicineCabinets'

interface LocationRow {
	id: string
	cabinet_id: string
	name: string
	created_at: string
	updated_at: string
	archived_at: string | null
}

function mapRow (row: LocationRow): StorageLocation {
	return {
		id: row.id,
		cabinetId: row.cabinet_id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at ?? null,
	}
}

const SELECT_COLS = `id, cabinet_id, name, created_at, updated_at, archived_at`

export async function listLocationsByCabinet (
	db: SqlExecutor,
	cabinetId: string,
	options?: { includeArchived?: boolean },
): Promise<StorageLocation[]> {
	const includeArchived = options?.includeArchived ?? false
	const rows = await db.getAllAsync<LocationRow>(
		includeArchived
			? `SELECT ${SELECT_COLS}
				 FROM storage_locations
				 WHERE cabinet_id = ?
				 ORDER BY name COLLATE NOCASE ASC`
			: `SELECT ${SELECT_COLS}
				 FROM storage_locations
				 WHERE cabinet_id = ? AND archived_at IS NULL
				 ORDER BY name COLLATE NOCASE ASC`,
		[cabinetId],
	)
	return rows.map(mapRow)
}

export async function getLocationById (
	db: SqlExecutor,
	id: string,
): Promise<StorageLocation | null> {
	const row = await db.getFirstAsync<LocationRow>(
		`SELECT ${SELECT_COLS} FROM storage_locations WHERE id = ?`,
		[id],
	)
	return row ? mapRow(row) : null
}

export async function createLocation (
	db: SqlExecutor,
	input: { cabinetId: string; name: string },
): Promise<StorageLocation> {
	const cabinet = await getCabinetById(db, input.cabinetId)
	if (!cabinet || cabinet.archivedAt) {
		throw new Error('Cabinet not found')
	}

	const timestamp = nowIso()
	const location: StorageLocation = {
		id: createId('loc'),
		cabinetId: input.cabinetId,
		name: input.name.trim(),
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
	}

	await db.runAsync(
		`INSERT INTO storage_locations
			(id, cabinet_id, name, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, NULL)`,
		[
			location.id,
			location.cabinetId,
			location.name,
			location.createdAt,
			location.updatedAt,
		],
	)

	return location
}

export async function updateLocation (
	db: SqlExecutor,
	id: string,
	input: { name: string },
): Promise<StorageLocation> {
	const existing = await getLocationById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Location not found')
	}

	const updatedAt = nowIso()
	const name = input.name.trim()
	await db.runAsync(
		`UPDATE storage_locations SET name = ?, updated_at = ? WHERE id = ?`,
		[name, updatedAt, id],
	)

	return { ...existing, name, updatedAt }
}

/**
 * Soft-archives a location. Active batches keep cabinet; location becomes null.
 */
export async function archiveLocation (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const existing = await getLocationById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Location not found')
	}

	const timestamp = nowIso()
	const run = async () => {
		await db.runAsync(
			`UPDATE medicine_batches
			 SET storage_location_id = NULL, updated_at = ?
			 WHERE storage_location_id = ? AND archived_at IS NULL`,
			[timestamp, id],
		)
		await db.runAsync(
			`UPDATE storage_locations
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

/**
 * Ensures a storage location belongs to the given cabinet.
 */
export async function assertLocationBelongsToCabinet (
	db: SqlExecutor,
	storageLocationId: string | null | undefined,
	cabinetId: string,
): Promise<void> {
	if (!storageLocationId) {
		return
	}

	const location = await getLocationById(db, storageLocationId)
	if (!location || location.archivedAt) {
		throw new Error('Storage location not found')
	}
	if (location.cabinetId !== cabinetId) {
		const error = new Error('LOCATION_CABINET_MISMATCH')
		error.name = 'LOCATION_CABINET_MISMATCH'
		throw error
	}
}
