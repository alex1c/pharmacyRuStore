/**
 * Destructive restore: replace user data with backup contents.
 * Validates first, takes an in-memory safety snapshot, rolls back on failure.
 */

import { SqlExecutor } from '@/db/sqlExecutor'
import { MEDIA_PREFIX } from './constants'
import { readBackupData } from './snapshot'
import { validateBackupPackage } from './validator'
import { BackupPackage } from './types'

export interface RestoreOptions {
	/** Write restored media bytes; returns new local URI. */
	writeMediaFile?: (
		fileName: string,
		bytes: Uint8Array,
	) => Promise<string>
	/** Called after DB commit for derived-state reconcile (shopping/reminders). */
	afterCommit?: () => Promise<void>
	/** Test hook: throw after clearing a named table. */
	failAfterClearTable?: string
	/** Test hook: throw after inserting a named table. */
	failAfterInsertTable?: string
	/** Safety rollback may keep absolute device photo URIs. */
	allowAbsolutePhotoUris?: boolean
}

/**
 * Restores a validated backup package into the current database.
 * On failure before commit, the previous snapshot is re-applied.
 */
export async function restoreBackupPackage (
	db: SqlExecutor,
	pack: BackupPackage,
	options: RestoreOptions = {},
): Promise<void> {
	validateBackupPackage(pack)

	// Safety snapshot keeps absolute photo URIs (no media remapping) so rollback
	// does not depend on re-writing files that are still on disk.
	const safetyData = await readBackupData(db)
	const safetyPack: BackupPackage = {
		manifest: {
			format: 'pharmacy-backup',
			formatVersion: 1,
			appIdentifier: 'safety',
			appVersion: 'safety',
			schemaVersion: 0,
			createdAt: new Date().toISOString(),
			platform: 'safety',
			counts: {
				households: safetyData.households.length,
				people: safetyData.people.length,
				cabinets: safetyData.medicine_cabinets.length,
				locations: safetyData.storage_locations.length,
				medicines: safetyData.medicines.length,
				batches: safetyData.medicine_batches.length,
				medicineCodes: safetyData.medicine_codes.length,
				courses: safetyData.medication_courses.length,
				schedules: safetyData.medication_schedules.length,
				intakes: safetyData.intake_records.length,
				movements: safetyData.intake_inventory_movements.length,
				shoppingItems: safetyData.shopping_items.length,
				settings: safetyData.settings.length,
				media: 0,
				warnings: 0,
			},
		},
		data: safetyData,
		media: [],
	}

	try {
		await applyPackageToDatabase(db, pack, options)
		if (options.afterCommit) {
			await options.afterCommit()
		}
	} catch (error) {
		// Roll back to pre-restore state (absolute photo paths preserved).
		try {
			await applyPackageToDatabase(db, safetyPack, {
				allowAbsolutePhotoUris: true,
			})
		} catch (rollbackError) {
			const wrapped = new Error('RESTORE_FAILED')
			wrapped.name = 'RESTORE_FAILED'
			wrapped.cause = { error, rollbackError }
			throw wrapped
		}
		throw error
	}
}

async function applyPackageToDatabase (
	db: SqlExecutor,
	pack: BackupPackage,
	options: RestoreOptions,
): Promise<void> {
	const mediaUriByRef = new Map<string, string>()
	if (options.writeMediaFile) {
		for (const file of pack.media) {
			const fileName = file.zipPath.slice('media/medicine/'.length)
			const uri = await options.writeMediaFile(fileName, file.bytes)
			mediaUriByRef.set(file.logicalRef, uri)
		}
	} else {
		for (const file of pack.media) {
			// Tests without FS: keep logical refs as-is.
			mediaUriByRef.set(file.logicalRef, file.logicalRef)
		}
	}

	const medicines = pack.data.medicines.map((row) => {
		const photo = row.photo_uri
		if (typeof photo === 'string' && photo.startsWith(MEDIA_PREFIX)) {
			return {
				...row,
				photo_uri: mediaUriByRef.get(photo) ?? null,
			}
		}
		if (options.allowAbsolutePhotoUris) {
			return row
		}
		// Do not restore absolute device paths from untrusted backup files.
		return { ...row, photo_uri: null }
	})

	const run = async () => {
		await clearUserTables(db, options.failAfterClearTable)
		await insertUserTables(
			db,
			{ ...pack.data, medicines },
			options.failAfterInsertTable,
		)
	}

	if (db.withTransactionAsync) {
		await db.withTransactionAsync(run)
	} else {
		await run()
	}
}

const CLEAR_ORDER = [
	'scheduled_notifications',
	'intake_inventory_movements',
	'intake_records',
	'medication_schedules',
	'medication_courses',
	'shopping_items',
	'medicine_codes',
	'medicine_batches',
	'medicines',
	'storage_locations',
	'medicine_cabinets',
	'people',
	'households',
] as const

async function clearUserTables (
	db: SqlExecutor,
	failAfter?: string,
): Promise<void> {
	for (const table of CLEAR_ORDER) {
		await db.runAsync(`DELETE FROM ${table}`)
		if (failAfter && failAfter === table) {
			throw new Error(`TEST_FAIL_AFTER_CLEAR:${table}`)
		}
	}

	// Replace only allowlisted settings; keep first_run_seeded and other markers.
	for (const key of [
		'expiry_warning_days',
		'default_low_stock_threshold',
		'medication_reminders_enabled',
	]) {
		await db.runAsync(`DELETE FROM app_meta WHERE key = ?`, [key])
	}
}

async function insertUserTables (
	db: SqlExecutor,
	data: BackupPackage['data'],
	failAfter?: string,
): Promise<void> {
	await insertRows(db, 'households', data.households)
	if (failAfter === 'households') {
		throw new Error('TEST_FAIL_AFTER_INSERT:households')
	}
	await insertRows(db, 'people', data.people)
	await insertRows(db, 'medicine_cabinets', data.medicine_cabinets)
	await insertRows(db, 'storage_locations', data.storage_locations)
	await insertRows(db, 'medicines', data.medicines)
	await insertRows(db, 'medicine_codes', data.medicine_codes)
	await insertRows(db, 'medicine_batches', data.medicine_batches)
	await insertRows(db, 'medication_courses', data.medication_courses)
	await insertRows(db, 'medication_schedules', data.medication_schedules)
	await insertRows(db, 'intake_records', data.intake_records)
	await insertRows(db, 'intake_inventory_movements', data.intake_inventory_movements)
	await insertRows(db, 'shopping_items', data.shopping_items)

	for (const setting of data.settings) {
		await db.runAsync(
			`INSERT INTO app_meta (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			[setting.key, setting.value],
		)
	}

	// Ensure seed flag remains so bootstrap does not recreate defaults.
	await db.runAsync(
		`INSERT INTO app_meta (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		['first_run_seeded', '1'],
	)
}

async function insertRows (
	db: SqlExecutor,
	table: string,
	rows: Record<string, unknown>[],
): Promise<void> {
	for (const row of rows) {
		const columns = Object.keys(row)
		if (columns.length === 0) {
			continue
		}
		const placeholders = columns.map(() => '?').join(', ')
		const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
		const params = columns.map((column) => {
			const value = row[column]
			if (value === undefined) {
				return null
			}
			if (typeof value === 'boolean') {
				return value ? 1 : 0
			}
			if (typeof value === 'number' || typeof value === 'string' || value === null) {
				return value
			}
			return String(value)
		})
		await db.runAsync(sql, params)
	}
}
