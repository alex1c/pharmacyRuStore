/** Stable Android notification channel for medication reminders. */
export const MEDICATION_REMINDER_CHANNEL_ID = 'medication-reminders'

export const MEDICATION_REMINDER_CHANNEL_NAME = 'Напоминания о лекарствах'

export const MEDICATION_REMINDER_CHANNEL_DESCRIPTION =
	'Напоминания о запланированном приёме лекарств'

/** Rolling horizon for native reminder scheduling (calendar days ahead). */
export const REMINDER_HORIZON_DAYS = 30

export const APP_NOTIFICATION_TITLE = 'Моя аптечка'

export type NotificationPermissionStatus =
	| 'granted'
	| 'denied'
	| 'undetermined'

export interface NotificationPermissionState {
	status: NotificationPermissionStatus
	canAskAgain: boolean
}

export interface MedicationReminderPayload {
	kind: 'medication_reminder'
	courseId: string
	scheduleId: string
	medicineId: string
	personId: string
	scheduledDate: string
	scheduledTime: string
	occurrenceKey: string
}

export interface DesiredReminder {
	occurrenceKey: string
	courseId: string
	scheduleId: string
	medicineId: string
	personId: string
	scheduledDate: string
	scheduledTime: string
	triggerAt: string
	title: string
	body: string
	payload: MedicationReminderPayload
}

/**
 * Injectable native notification client — Expo impl in production, mock in tests.
 */
export interface NotificationNativeClient {
	ensureChannel (): Promise<void>
	getPermissionState (): Promise<NotificationPermissionState>
	requestPermissions (): Promise<NotificationPermissionState>
	scheduleReminder (input: {
		identifier: string
		title: string
		body: string
		data: Record<string, string>
		triggerAt: Date
		channelId: string
	}): Promise<string>
	cancelReminder (nativeNotificationId: string): Promise<void>
	getScheduledIds (): Promise<string[]>
	openSystemSettings (): Promise<void>
}
