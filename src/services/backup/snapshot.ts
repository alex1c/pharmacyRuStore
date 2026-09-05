/**
 * Collect a consistent logical snapshot of user data from SQLite.
 */

import { LATEST_SCHEMA_VERSION } from '@/db/migrations'
import { SqlExecutor } from '@/db/sqlExecutor'
import { SETTINGS_KEYS } from '@/db/repositories/settings'
import { nowIso } from '@/utils/dates'
import {
	APP_IDENTIFIER,
	BACKUP_FORMAT_NAME,
	BACKUP_FORMAT_VERSION,
	BACKUP_SETTINGS_ALLOWLIST,
} from './constants'
import { BackupData, BackupManifest, BackupPackage } from './types'
import { collectMedicineMedia } from './media'

const ALLOWED_SETTINGS = new Set<string>(BACKUP_SETTINGS_ALLOWLIST)

export async function createBackupPackage (
	db: SqlExecutor,
	options?: {
		appVersion?: string
		platform?: string
		/** Injected media reader for tests / native FS. */
		readMediaBytes?: (uri: string) => Promise<Uint8Array | null>
	},
): Promise<{ pack: BackupPackage; warnings: string[] }> {
	const run = async () => {
		const data = await readBackupData(db)
		const { media, warnings, medicines } = await collectMedicineMedia(
			data.medicines,
			options?.readMediaBytes,
		)
		data.medicines = medicines

		const manifest: BackupManifest = {
			format: BACKUP_FORMAT_NAME,
			formatVersion: BACKUP_FORMAT_VERSION,
			appIdentifier: APP_IDENTIFIER,
			appVersion: options?.appVersion ?? '1.0.0',
			schemaVersion: LATEST_SCHEMA_VERSION,
			createdAt: nowIso(),
			platform: options?.platform ?? 'unknown',
			counts: {
				households: data.households.length,
				people: data.people.length,
				cabinets: data.medicine_cabinets.length,
				locations: data.storage_locations.length,
				medicines: data.medicines.length,
				batches: data.medicine_batches.length,
				medicineCodes: data.medicine_codes.length,
				courses: data.medication_courses.length,
				schedules: data.medication_schedules.length,
				intakes: data.intake_records.length,
				movements: data.intake_inventory_movements.length,
				shoppingItems: data.shopping_items.length,
				settings: data.settings.length,
				media: media.length,
				warnings: warnings.length,
			},
			warnings: warnings.length > 0 ? warnings : undefined,
		}

		return { pack: { manifest, data, media }, warnings }
	}

	if (db.withTransactionAsync) {
		return db.withTransactionAsync(run)
	}
	return run()
}

export async function readBackupData (db: SqlExecutor): Promise<BackupData> {
	const [
		households,
		people,
		medicine_cabinets,
		storage_locations,
		medicines,
		medicine_batches,
		medicine_codes,
		medication_courses,
		medication_schedules,
		intake_records,
		intake_inventory_movements,
		shopping_items,
		settingsRows,
	] = await Promise.all([
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM households`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM people`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM medicine_cabinets`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM storage_locations`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM medicines`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM medicine_batches`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM medicine_codes`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM medication_courses`),
		db.getAllAsync<Record<string, unknown>>(
			`SELECT * FROM medication_schedules`,
		),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM intake_records`),
		db.getAllAsync<Record<string, unknown>>(
			`SELECT * FROM intake_inventory_movements`,
		),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM shopping_items`),
		db.getAllAsync<{ key: string; value: string }>(
			`SELECT key, value FROM app_meta`,
		),
	])

	const settings = settingsRows
		.filter((row) => ALLOWED_SETTINGS.has(row.key))
		.map((row) => ({ key: row.key, value: row.value }))

	// Ensure allowlisted keys are always present with current values when missing.
	for (const key of Object.values(SETTINGS_KEYS)) {
		if (!settings.some((item) => item.key === key)) {
			const row = settingsRows.find((item) => item.key === key)
			if (row && ALLOWED_SETTINGS.has(row.key)) {
				settings.push({ key: row.key, value: row.value })
			}
		}
	}

	return {
		households,
		people,
		medicine_cabinets,
		storage_locations,
		medicines,
		medicine_batches,
		medicine_codes,
		medication_courses,
		medication_schedules,
		intake_records,
		intake_inventory_movements,
		shopping_items,
		settings,
	}
}
