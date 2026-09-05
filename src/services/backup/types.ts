/**
 * Logical backup payload types — ZIP contains manifest.json + data.json + media/.
 */

import { BACKUP_FORMAT_NAME } from './constants'

export interface BackupCounts {
	households: number
	people: number
	cabinets: number
	locations: number
	medicines: number
	batches: number
	medicineCodes: number
	courses: number
	schedules: number
	intakes: number
	movements: number
	shoppingItems: number
	settings: number
	media: number
	warnings: number
}

export interface BackupManifest {
	format: typeof BACKUP_FORMAT_NAME | string
	formatVersion: number
	appIdentifier: string
	appVersion: string
	schemaVersion: number
	createdAt: string
	platform: string
	counts: BackupCounts
	warnings?: string[]
}

export interface BackupSettingsEntry {
	key: string
	value: string
}

/**
 * Raw row shapes as stored in SQLite (snake_case) for fidelity.
 */
export interface BackupData {
	households: Record<string, unknown>[]
	people: Record<string, unknown>[]
	medicine_cabinets: Record<string, unknown>[]
	storage_locations: Record<string, unknown>[]
	medicines: Record<string, unknown>[]
	medicine_batches: Record<string, unknown>[]
	medicine_codes: Record<string, unknown>[]
	medication_courses: Record<string, unknown>[]
	medication_schedules: Record<string, unknown>[]
	intake_records: Record<string, unknown>[]
	intake_inventory_movements: Record<string, unknown>[]
	shopping_items: Record<string, unknown>[]
	settings: BackupSettingsEntry[]
}

export interface BackupMediaFile {
	/** Relative path inside ZIP, e.g. media/medicine/abc.jpg */
	zipPath: string
	/** Logical ref stored in data.json photo_uri, e.g. media://medicine/abc.jpg */
	logicalRef: string
	bytes: Uint8Array
}

export interface BackupPackage {
	manifest: BackupManifest
	data: BackupData
	media: BackupMediaFile[]
}

export interface BackupCreateResult {
	filename: string
	bytes: Uint8Array
	manifest: BackupManifest
	warnings: string[]
}

export type BackupValidationErrorCode =
	| 'INVALID_ZIP'
	| 'INVALID_MANIFEST'
	| 'UNSUPPORTED_FORMAT'
	| 'FUTURE_FORMAT'
	| 'INVALID_DATA'
	| 'UNSAFE_MEDIA_PATH'
	| 'BACKUP_BUSY'
	| 'RESTORE_FAILED'
