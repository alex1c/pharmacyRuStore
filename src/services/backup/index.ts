/**
 * Public backup / restore / export API for UI and tests.
 */

import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { SqlExecutor } from '@/db/sqlExecutor'
import { nowIso } from '@/utils/dates'
import { LAST_BACKUP_AT_KEY, LAST_BACKUP_FILENAME_KEY } from './constants'
import { buildInventoryCsv } from './csvExport'
import { withBackupOperationLock } from './operationLock'
import { restoreBackupPackage, RestoreOptions } from './restore'
import { createBackupPackage } from './snapshot'
import { BackupCreateResult, BackupPackage } from './types'
import { decodeBackupZip, encodeBackupZip } from './zipCodec'

export function buildBackupFilename (date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	const stamp =
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`-${pad(date.getHours())}${pad(date.getMinutes())}`
	return `moya-aptechka-backup-${stamp}.zip`
}

export function buildCsvFilename (date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	const stamp =
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	return `moya-aptechka-${stamp}.csv`
}

/**
 * Creates a logical backup package (in memory).
 */
export async function createLogicalBackup (
	db: SqlExecutor,
	options?: {
		readMediaBytes?: (uri: string) => Promise<Uint8Array | null>
		appVersion?: string
		platform?: string
	},
): Promise<{ pack: BackupPackage; warnings: string[] }> {
	return withBackupOperationLock(() =>
		createBackupPackage(db, {
			appVersion:
				options?.appVersion ??
				Constants.expoConfig?.version ??
				'1.0.0',
			platform: options?.platform ?? Platform.OS,
			readMediaBytes: options?.readMediaBytes,
		}),
	)
}

/**
 * Creates a ZIP backup byte array ready to share.
 */
export async function createBackupZipBytes (
	db: SqlExecutor,
	options?: {
		readMediaBytes?: (uri: string) => Promise<Uint8Array | null>
	},
): Promise<BackupCreateResult> {
	return withBackupOperationLock(async () => {
		const { pack, warnings } = await createBackupPackage(db, {
			appVersion: Constants.expoConfig?.version ?? '1.0.0',
			platform: Platform.OS,
			readMediaBytes: options?.readMediaBytes,
		})
		const bytes = await encodeBackupZip(pack)
		const filename = buildBackupFilename()
		await db.runAsync(
			`INSERT INTO app_meta (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			[LAST_BACKUP_AT_KEY, nowIso()],
		)
		await db.runAsync(
			`INSERT INTO app_meta (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			[LAST_BACKUP_FILENAME_KEY, filename],
		)
		return { filename, bytes, manifest: pack.manifest, warnings }
	})
}

/**
 * Validates and restores from ZIP bytes (replace policy).
 */
export async function restoreFromBackupZipBytes (
	db: SqlExecutor,
	bytes: Uint8Array,
	options: RestoreOptions = {},
): Promise<BackupPackage> {
	return withBackupOperationLock(async () => {
		const pack = await decodeBackupZip(bytes)
		await restoreBackupPackage(db, pack, options)
		return pack
	})
}

/**
 * Restores an already-decoded package (used by tests).
 */
export async function restoreFromBackupPackage (
	db: SqlExecutor,
	pack: BackupPackage,
	options: RestoreOptions = {},
): Promise<void> {
	return withBackupOperationLock(() => restoreBackupPackage(db, pack, options))
}

export async function exportInventoryCsvBytes (
	db: SqlExecutor,
): Promise<{ filename: string; text: string }> {
	const text = await buildInventoryCsv(db)
	return { filename: buildCsvFilename(), text }
}

export async function getLastBackupMeta (
	db: SqlExecutor,
): Promise<{ at: string | null; filename: string | null }> {
	const at = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_meta WHERE key = ?`,
		[LAST_BACKUP_AT_KEY],
	)
	const filename = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_meta WHERE key = ?`,
		[LAST_BACKUP_FILENAME_KEY],
	)
	return {
		at: at?.value ?? null,
		filename: filename?.value ?? null,
	}
}

export * from './types'
export { decodeBackupZip, encodeBackupZip } from './zipCodec'
export { escapeCsvField, buildInventoryCsv } from './csvExport'
export {
	isBackupOperationBusy,
	resetBackupOperationLockForTests,
} from './operationLock'
export { BackupValidationError } from './validator'
