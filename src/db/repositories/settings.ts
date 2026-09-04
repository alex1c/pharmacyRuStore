import { AppSettings } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'

export const SETTINGS_KEYS = {
	expiryWarningDays: 'expiry_warning_days',
	defaultLowStockThreshold: 'default_low_stock_threshold',
	medicationRemindersEnabled: 'medication_reminders_enabled',
} as const

export const DEFAULT_SETTINGS: AppSettings = {
	expiryWarningDays: 30,
	defaultLowStockThreshold: 5,
	medicationRemindersEnabled: true,
}

export const EXPIRY_WARNING_PRESETS = [7, 14, 30, 60, 90] as const

/**
 * Ensures monitoring defaults exist (idempotent).
 */
export async function ensureAppSettings (db: SqlExecutor): Promise<AppSettings> {
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[SETTINGS_KEYS.expiryWarningDays, String(DEFAULT_SETTINGS.expiryWarningDays)],
	)
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[
			SETTINGS_KEYS.defaultLowStockThreshold,
			String(DEFAULT_SETTINGS.defaultLowStockThreshold),
		],
	)
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[
			SETTINGS_KEYS.medicationRemindersEnabled,
			DEFAULT_SETTINGS.medicationRemindersEnabled ? '1' : '0',
		],
	)
	return getAppSettings(db)
}

export async function getAppSettings (db: SqlExecutor): Promise<AppSettings> {
	const expiry = await getMetaNumber(
		db,
		SETTINGS_KEYS.expiryWarningDays,
		DEFAULT_SETTINGS.expiryWarningDays,
	)
	const low = await getMetaNumber(
		db,
		SETTINGS_KEYS.defaultLowStockThreshold,
		DEFAULT_SETTINGS.defaultLowStockThreshold,
	)
	const reminders = await getMetaFlag(
		db,
		SETTINGS_KEYS.medicationRemindersEnabled,
		DEFAULT_SETTINGS.medicationRemindersEnabled,
	)

	return {
		expiryWarningDays: expiry,
		defaultLowStockThreshold: low,
		medicationRemindersEnabled: reminders,
	}
}

export async function setExpiryWarningDays (
	db: SqlExecutor,
	days: number,
): Promise<void> {
	if (!EXPIRY_WARNING_PRESETS.includes(days as (typeof EXPIRY_WARNING_PRESETS)[number])) {
		throw new Error('INVALID_EXPIRY_WARNING_DAYS')
	}
	await upsertMeta(db, SETTINGS_KEYS.expiryWarningDays, String(days))
}

export async function setDefaultLowStockThreshold (
	db: SqlExecutor,
	value: number,
): Promise<void> {
	if (!Number.isFinite(value) || value < 0) {
		throw new Error('INVALID_LOW_STOCK_THRESHOLD')
	}
	await upsertMeta(
		db,
		SETTINGS_KEYS.defaultLowStockThreshold,
		String(Math.round(value)),
	)
}

export async function setMedicationRemindersEnabled (
	db: SqlExecutor,
	enabled: boolean,
): Promise<void> {
	await upsertMeta(
		db,
		SETTINGS_KEYS.medicationRemindersEnabled,
		enabled ? '1' : '0',
	)
}

async function getMetaNumber (
	db: SqlExecutor,
	key: string,
	fallback: number,
): Promise<number> {
	const row = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_meta WHERE key = ?`,
		[key],
	)
	const parsed = Number(row?.value)
	return Number.isFinite(parsed) ? parsed : fallback
}

async function getMetaFlag (
	db: SqlExecutor,
	key: string,
	fallback: boolean,
): Promise<boolean> {
	const row = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_meta WHERE key = ?`,
		[key],
	)
	if (!row) {
		return fallback
	}
	return row.value === '1' || row.value === 'true'
}

async function upsertMeta (
	db: SqlExecutor,
	key: string,
	value: string,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO app_meta (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		[key, value],
	)
}
