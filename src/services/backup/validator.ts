/**
 * Validates backup packages before any destructive restore.
 */

import {
	BACKUP_FORMAT_NAME,
	BACKUP_FORMAT_VERSION,
	BACKUP_SETTINGS_ALLOWLIST,
} from './constants'
import { assertSafeMediaZipPath, logicalRefToZipPath } from './media'
import { BackupData, BackupManifest, BackupPackage } from './types'

const ALLOWED_SETTINGS = new Set<string>(BACKUP_SETTINGS_ALLOWLIST)

export class BackupValidationError extends Error {
	constructor (
		message: string,
		readonly code:
			| 'INVALID_MANIFEST'
			| 'UNSUPPORTED_FORMAT'
			| 'FUTURE_FORMAT'
			| 'INVALID_DATA'
			| 'UNSAFE_MEDIA_PATH',
	) {
		super(message)
		this.name = code
	}
}

export function validateBackupPackage (pack: BackupPackage): void {
	validateManifest(pack.manifest)
	validateData(pack.data)
	for (const file of pack.media) {
		assertSafeMediaZipPath(file.zipPath)
		const expected = logicalRefToZipPath(file.logicalRef)
		if (expected !== file.zipPath) {
			throw new BackupValidationError(
				'Media logical ref does not match zip path',
				'INVALID_DATA',
			)
		}
	}

	// Every medicine photo_uri that looks like media:// must exist in media set.
	const mediaRefs = new Set(pack.media.map((item) => item.logicalRef))
	for (const medicine of pack.data.medicines) {
		const photo = medicine.photo_uri
		if (typeof photo !== 'string' || !photo) {
			continue
		}
		if (photo.startsWith('media://') && !mediaRefs.has(photo)) {
			throw new BackupValidationError(
				'Medicine references missing media file',
				'INVALID_DATA',
			)
		}
		if (photo.startsWith('media://')) {
			const zipPath = logicalRefToZipPath(photo)
			if (!zipPath) {
				throw new BackupValidationError(
					'Unsafe media reference',
					'UNSAFE_MEDIA_PATH',
				)
			}
		}
	}
}

export function validateManifest (manifest: unknown): asserts manifest is BackupManifest {
	if (!manifest || typeof manifest !== 'object') {
		throw new BackupValidationError('Missing manifest', 'INVALID_MANIFEST')
	}
	const m = manifest as Record<string, unknown>
	if (m.format !== BACKUP_FORMAT_NAME) {
		throw new BackupValidationError(
			'Not a Моя аптечка backup',
			'UNSUPPORTED_FORMAT',
		)
	}
	if (typeof m.formatVersion !== 'number' || !Number.isFinite(m.formatVersion)) {
		throw new BackupValidationError('Invalid formatVersion', 'INVALID_MANIFEST')
	}
	if (m.formatVersion > BACKUP_FORMAT_VERSION) {
		throw new BackupValidationError(
			'Backup from a newer app version',
			'FUTURE_FORMAT',
		)
	}
	if (m.formatVersion < 1) {
		throw new BackupValidationError('Unsupported formatVersion', 'INVALID_MANIFEST')
	}
	if (typeof m.createdAt !== 'string' || !m.createdAt) {
		throw new BackupValidationError('Missing createdAt', 'INVALID_MANIFEST')
	}
	if (!m.counts || typeof m.counts !== 'object') {
		throw new BackupValidationError('Missing counts', 'INVALID_MANIFEST')
	}
}

export function validateData (data: unknown): asserts data is BackupData {
	if (!data || typeof data !== 'object') {
		throw new BackupValidationError('Missing data.json', 'INVALID_DATA')
	}
	const d = data as Record<string, unknown>
	const tables: (keyof BackupData)[] = [
		'households',
		'people',
		'medicine_cabinets',
		'storage_locations',
		'medicines',
		'medicine_batches',
		'medicine_codes',
		'medication_courses',
		'medication_schedules',
		'intake_records',
		'intake_inventory_movements',
		'shopping_items',
		'settings',
	]
	for (const table of tables) {
		if (!Array.isArray(d[table])) {
			throw new BackupValidationError(`Missing array: ${table}`, 'INVALID_DATA')
		}
	}

	assertUniqueIds(d.households as Record<string, unknown>[], 'households')
	assertUniqueIds(d.people as Record<string, unknown>[], 'people')
	assertUniqueIds(d.medicine_cabinets as Record<string, unknown>[], 'medicine_cabinets')
	assertUniqueIds(d.storage_locations as Record<string, unknown>[], 'storage_locations')
	assertUniqueIds(d.medicines as Record<string, unknown>[], 'medicines')
	assertUniqueIds(d.medicine_batches as Record<string, unknown>[], 'medicine_batches')
	assertUniqueIds(d.medicine_codes as Record<string, unknown>[], 'medicine_codes')
	assertUniqueIds(d.medication_courses as Record<string, unknown>[], 'medication_courses')
	assertUniqueIds(
		d.medication_schedules as Record<string, unknown>[],
		'medication_schedules',
	)
	assertUniqueIds(d.intake_records as Record<string, unknown>[], 'intake_records')
	assertUniqueIds(
		d.intake_inventory_movements as Record<string, unknown>[],
		'intake_inventory_movements',
	)
	assertUniqueIds(d.shopping_items as Record<string, unknown>[], 'shopping_items')

	const householdIds = idSet(d.households as Record<string, unknown>[])
	const people = d.people as Record<string, unknown>[]
	for (const row of people) {
		assertStringId(row.id, 'people.id')
		assertStringId(row.household_id, 'people.household_id')
		if (!householdIds.has(String(row.household_id))) {
			throw new BackupValidationError('Orphan person household', 'INVALID_DATA')
		}
	}

	const medicineIds = idSet(d.medicines as Record<string, unknown>[])
	for (const row of d.medicine_batches as Record<string, unknown>[]) {
		assertStringId(row.id, 'batch.id')
		assertStringId(row.medicine_id, 'batch.medicine_id')
		if (!medicineIds.has(String(row.medicine_id))) {
			throw new BackupValidationError('Orphan batch medicine', 'INVALID_DATA')
		}
		const qty = row.quantity
		if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0) {
			throw new BackupValidationError('Invalid batch quantity', 'INVALID_DATA')
		}
	}

	for (const row of d.medicine_codes as Record<string, unknown>[]) {
		assertStringId(row.id, 'code.id')
		assertStringId(row.medicine_id, 'code.medicine_id')
		assertStringId(row.code_value, 'code.code_value')
		if (!medicineIds.has(String(row.medicine_id))) {
			throw new BackupValidationError('Orphan medicine code', 'INVALID_DATA')
		}
	}

	const intakeIds = idSet(d.intake_records as Record<string, unknown>[])
	const batchIds = idSet(d.medicine_batches as Record<string, unknown>[])
	for (const row of d.intake_inventory_movements as Record<string, unknown>[]) {
		assertStringId(row.id, 'movement.id')
		assertStringId(row.intake_record_id, 'movement.intake_record_id')
		assertStringId(row.batch_id, 'movement.batch_id')
		if (!intakeIds.has(String(row.intake_record_id))) {
			throw new BackupValidationError('Orphan movement intake', 'INVALID_DATA')
		}
		if (!batchIds.has(String(row.batch_id))) {
			throw new BackupValidationError('Orphan movement batch', 'INVALID_DATA')
		}
	}

	for (const row of d.settings as BackupData['settings']) {
		if (typeof row.key !== 'string' || typeof row.value !== 'string') {
			throw new BackupValidationError('Invalid settings entry', 'INVALID_DATA')
		}
		if (!ALLOWED_SETTINGS.has(row.key)) {
			throw new BackupValidationError(
				`Disallowed settings key: ${row.key}`,
				'INVALID_DATA',
			)
		}
	}
}

function assertUniqueIds (rows: Record<string, unknown>[], label: string): void {
	const seen = new Set<string>()
	for (const row of rows) {
		assertStringId(row.id, `${label}.id`)
		const id = String(row.id)
		if (seen.has(id)) {
			throw new BackupValidationError(`Duplicate id in ${label}`, 'INVALID_DATA')
		}
		seen.add(id)
	}
}

function assertStringId (value: unknown, label: string): void {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new BackupValidationError(`Invalid id: ${label}`, 'INVALID_DATA')
	}
}

function idSet (rows: Record<string, unknown>[]): Set<string> {
	return new Set(rows.map((row) => String(row.id)))
}

/**
 * Placeholder for future format migrations (v1 → v2, …).
 */
export function migrateBackupFormat (pack: BackupPackage): BackupPackage {
	if (pack.manifest.formatVersion === BACKUP_FORMAT_VERSION) {
		return pack
	}
	// No older formats yet beyond validation rejection.
	return pack
}
