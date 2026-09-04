export {
	MEDICATION_REMINDER_CHANNEL_ID,
	MEDICATION_REMINDER_CHANNEL_NAME,
	REMINDER_HORIZON_DAYS,
	APP_NOTIFICATION_TITLE,
} from './types'
export type {
	DesiredReminder,
	MedicationReminderPayload,
	NotificationNativeClient,
	NotificationPermissionState,
	NotificationPermissionStatus,
} from './types'

export { buildOccurrenceKey, parseOccurrenceKey } from './occurrenceKey'
export { localDateTimeToDate, addDaysToDateOnly } from './localDateTime'
export { buildReminderContent, payloadToData } from './payload'
export {
	configureForegroundNotificationHandler,
	createExpoNotificationClient,
} from './nativeClient'
export {
	getNotificationClient,
	setNotificationClientForTests,
	getNotificationPermissionState,
	requestNotificationPermissions,
	openNotificationSystemSettings,
	ensureReminderPermissionInteractive,
} from './permissions'
export {
	syncMedicationReminders,
	scheduleTestReminder,
} from './scheduler'
export type { SyncRemindersOptions, SyncRemindersResult } from './scheduler'
export { safeSyncMedicationReminders } from './safeSync'
