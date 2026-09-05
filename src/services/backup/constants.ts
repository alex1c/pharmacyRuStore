/**
 * Logical backup format constants (independent of SQLite schema version).
 */

export const BACKUP_FORMAT_NAME = 'pharmacy-backup'
export const BACKUP_FORMAT_VERSION = 1
export const APP_IDENTIFIER = 'com.calculatorplatform.pharmacy'

/** User-facing settings allowed in backup (not migration/runtime markers). */
export const BACKUP_SETTINGS_ALLOWLIST = [
	'expiry_warning_days',
	'default_low_stock_threshold',
	'medication_reminders_enabled',
] as const

/** Install metadata we may write after backup (not restored as user content). */
export const LAST_BACKUP_AT_KEY = 'last_backup_at'
export const LAST_BACKUP_FILENAME_KEY = 'last_backup_filename'

export const MEDIA_PREFIX = 'media://medicine/'
