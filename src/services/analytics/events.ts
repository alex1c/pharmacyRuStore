/**
 * Privacy-safe product analytics event taxonomy.
 * Only these events/params are allowed through the production adapter.
 */

export const AnalyticsEvents = {
	APP_OPEN: 'app_open',
	MEDICINE_CREATED: 'medicine_created',
	BATCH_ADDED: 'batch_added',
	MEDICINE_ARCHIVED: 'medicine_archived',
	COURSE_CREATED: 'course_created',
	COURSE_FINISHED: 'course_finished',
	INTAKE_TAKEN: 'intake_taken',
	INTAKE_SKIPPED: 'intake_skipped',
	INTAKE_SNOOZED: 'intake_snoozed',
	SCAN_STARTED: 'scan_started',
	SCAN_SUCCESS: 'scan_success',
	SCAN_FAILED: 'scan_failed',
	SHOPPING_ITEM_ADDED: 'shopping_item_added',
	SHOPPING_COMPLETED: 'shopping_completed',
	BACKUP_CREATED: 'backup_created',
	BACKUP_RESTORED: 'backup_restored',
	NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
	NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',
	AD_BANNER_LOADED: 'ad_banner_loaded',
	AD_BANNER_FAILED: 'ad_banner_failed',
	AD_INTERSTITIAL_LOADED: 'ad_interstitial_loaded',
	AD_INTERSTITIAL_SHOWN: 'ad_interstitial_shown',
	AD_INTERSTITIAL_FAILED: 'ad_interstitial_failed',
} as const

export type AnalyticsEventName =
	(typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]

export type MedicineCreateSource = 'manual' | 'scan'
export type BatchAddSource = 'manual' | 'scan' | 'shopping'
export type ScheduleTypeParam =
	| 'daily'
	| 'weekdays'
	| 'interval'
	| 'one_time'
	| 'prn'
export type ScanCodeTypeParam =
	| 'ean13'
	| 'ean8'
	| 'upc_a'
	| 'upc_e'
	| 'code128'
	| 'qr'
	| 'datamatrix'
	| 'other'
export type ShoppingAddSource = 'automatic' | 'manual'
export type ShoppingCompleteType = 'medicine' | 'custom'
export type SnoozeMinutes = 10 | 30 | 60
export type AdBannerPlacementParam =
	| 'cabinet'
	| 'shopping'
	| 'more'
	| 'history'
export type AdFormatParam = 'banner' | 'interstitial'

/**
 * Typed parameter maps — TypeScript rejects medicineName / rawCode etc.
 */
export type AnalyticsEventParams = {
	[AnalyticsEvents.APP_OPEN]: Record<string, never>
	[AnalyticsEvents.MEDICINE_CREATED]: { source: MedicineCreateSource }
	[AnalyticsEvents.BATCH_ADDED]: { source: BatchAddSource }
	[AnalyticsEvents.MEDICINE_ARCHIVED]: Record<string, never>
	[AnalyticsEvents.COURSE_CREATED]: {
		schedule_type: ScheduleTypeParam
		reminders_enabled: boolean
	}
	[AnalyticsEvents.COURSE_FINISHED]: Record<string, never>
	[AnalyticsEvents.INTAKE_TAKEN]: Record<string, never>
	[AnalyticsEvents.INTAKE_SKIPPED]: Record<string, never>
	[AnalyticsEvents.INTAKE_SNOOZED]: { minutes: SnoozeMinutes }
	[AnalyticsEvents.SCAN_STARTED]: Record<string, never>
	[AnalyticsEvents.SCAN_SUCCESS]: { code_type: ScanCodeTypeParam }
	[AnalyticsEvents.SCAN_FAILED]: Record<string, never>
	[AnalyticsEvents.SHOPPING_ITEM_ADDED]: { source: ShoppingAddSource }
	[AnalyticsEvents.SHOPPING_COMPLETED]: { type: ShoppingCompleteType }
	[AnalyticsEvents.BACKUP_CREATED]: { has_media: boolean }
	[AnalyticsEvents.BACKUP_RESTORED]: Record<string, never>
	[AnalyticsEvents.NOTIFICATION_PERMISSION_GRANTED]: Record<string, never>
	[AnalyticsEvents.NOTIFICATION_PERMISSION_DENIED]: Record<string, never>
	[AnalyticsEvents.AD_BANNER_LOADED]: {
		placement: AdBannerPlacementParam
		format: 'banner'
	}
	[AnalyticsEvents.AD_BANNER_FAILED]: {
		placement: AdBannerPlacementParam
		format: 'banner'
	}
	[AnalyticsEvents.AD_INTERSTITIAL_LOADED]: { format: 'interstitial' }
	[AnalyticsEvents.AD_INTERSTITIAL_SHOWN]: { format: 'interstitial' }
	[AnalyticsEvents.AD_INTERSTITIAL_FAILED]: { format: 'interstitial' }
}

/** Allowlisted param keys per event (runtime defense in depth). */
export const EVENT_PARAM_ALLOWLIST: {
	[K in AnalyticsEventName]: readonly (keyof AnalyticsEventParams[K])[]
} = {
	app_open: [],
	medicine_created: ['source'],
	batch_added: ['source'],
	medicine_archived: [],
	course_created: ['schedule_type', 'reminders_enabled'],
	course_finished: [],
	intake_taken: [],
	intake_skipped: [],
	intake_snoozed: ['minutes'],
	scan_started: [],
	scan_success: ['code_type'],
	scan_failed: [],
	shopping_item_added: ['source'],
	shopping_completed: ['type'],
	backup_created: ['has_media'],
	backup_restored: [],
	notification_permission_granted: [],
	notification_permission_denied: [],
	ad_banner_loaded: ['placement', 'format'],
	ad_banner_failed: ['placement', 'format'],
	ad_interstitial_loaded: ['format'],
	ad_interstitial_shown: ['format'],
	ad_interstitial_failed: ['format'],
}

export const AnalyticsScreens = [
	'today',
	'cabinet',
	'medicine_detail',
	'medicine_edit',
	'batch_edit',
	'intake',
	'course_edit',
	'history',
	'shopping',
	'family',
	'scanner',
	'backup',
	'settings',
] as const

export type AnalyticsScreen = (typeof AnalyticsScreens)[number]

/** Map legacy / local screen ids → allowed generic names. */
export const SCREEN_ALIASES: Record<string, AnalyticsScreen | null> = {
	today: 'today',
	cabinet: 'cabinet',
	medicine_detail: 'medicine_detail',
	medicine_edit: 'medicine_edit',
	medicine_add: 'medicine_edit',
	batch_edit: 'batch_edit',
	batch_add: 'batch_edit',
	intake: 'intake',
	course_edit: 'course_edit',
	course_add: 'course_edit',
	history: 'history',
	shopping: 'shopping',
	family: 'family',
	scanner: 'scanner',
	scan: 'scanner',
	scan_result: 'scanner',
	scan_select_medicine: 'scanner',
	backup: 'backup',
	settings: 'settings',
	settings_stock: 'settings',
	settings_reminders: 'settings',
	more: 'settings',
	cabinets: 'settings',
	storage_locations: 'settings',
	root: null,
}
