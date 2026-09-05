import { findActiveOccurrenceIntake } from '@/db/repositories/intakeRecords'
import { listActiveCourses } from '@/db/repositories/medicationCourses'
import { listActiveSchedulesForHousehold } from '@/db/repositories/medicationSchedules'
import {
	deleteByOccurrenceKey,
	deleteScheduledNotification,
	listScheduledNotificationsForHousehold,
	upsertScheduledNotification,
} from '@/db/repositories/scheduledNotifications'
import { getAppSettings } from '@/db/repositories/settings'
import { SqlExecutor } from '@/db/sqlExecutor'
import { getOccurrencesBetween } from '@/domain/scheduleEngine'
import { toDateOnlyLocal } from '@/utils/dates'
import { analytics } from '@/services/analytics'
import { logger } from '@/services/logging'
import { addDaysToDateOnly, localDateTimeToDate } from './localDateTime'
import { buildReminderContent, payloadToData } from './payload'
import {
	APP_NOTIFICATION_TITLE,
	DesiredReminder,
	MEDICATION_REMINDER_CHANNEL_ID,
	NotificationNativeClient,
	REMINDER_HORIZON_DAYS,
} from './types'

export interface SyncRemindersOptions {
	now?: Date
	client: NotificationNativeClient
	/** Default person name treated as «Я» (omit from body). */
	defaultPersonName?: string
}

export interface SyncRemindersResult {
	scheduled: number
	cancelled: number
	kept: number
	skippedReason?: 'permission_denied' | 'global_off' | 'ok'
}

/**
 * Reconciles DB schedule occurrences with native local notifications.
 * Safe to call repeatedly. Does not touch intake history.
 */
export async function syncMedicationReminders (
	db: SqlExecutor,
	householdId: string,
	options: SyncRemindersOptions,
): Promise<SyncRemindersResult> {
	const client = options.client
	const now = options.now ?? new Date()
	const defaultPersonName = options.defaultPersonName ?? 'Я'

	try {
		await client.ensureChannel()
	} catch (error) {
		logger.error('Notification channel setup failed', error)
		analytics.reportError(error, { source: 'syncMedicationReminders.channel' })
	}

	const permission = await client.getPermissionState()
	const settings = await getAppSettings(db)

	const ledger = await listScheduledNotificationsForHousehold(db, householdId)

	if (permission.status !== 'granted' || !settings.medicationRemindersEnabled) {
		const cancelled = await cancelLedgerEntries(db, client, ledger)
		return {
			scheduled: 0,
			cancelled,
			kept: 0,
			skippedReason:
				permission.status !== 'granted' ? 'permission_denied' : 'global_off',
		}
	}

	const desired = await computeDesiredReminders(db, householdId, {
		now,
		defaultPersonName,
	})

	const desiredByKey = new Map(desired.map((item) => [item.occurrenceKey, item]))
	let cancelled = 0
	let scheduled = 0
	let kept = 0

	for (const entry of ledger) {
		const want = desiredByKey.get(entry.occurrenceKey)
		if (!want) {
			await safeCancel(client, entry.nativeNotificationId)
			await deleteScheduledNotification(db, entry.id)
			cancelled += 1
			continue
		}
		if (want.triggerAt !== entry.triggerAt) {
			await safeCancel(client, entry.nativeNotificationId)
			const created = await scheduleDesired(db, client, want)
			if (created) {
				scheduled += 1
			}
			desiredByKey.delete(entry.occurrenceKey)
			continue
		}
		kept += 1
		desiredByKey.delete(entry.occurrenceKey)
	}

	for (const want of desiredByKey.values()) {
		const created = await scheduleDesired(db, client, want)
		if (created) {
			scheduled += 1
		}
	}

	return { scheduled, cancelled, kept, skippedReason: 'ok' }
}

async function computeDesiredReminders (
	db: SqlExecutor,
	householdId: string,
	opts: { now: Date; defaultPersonName: string },
): Promise<DesiredReminder[]> {
	const courses = await listActiveCourses(db, householdId)
	const schedules = await listActiveSchedulesForHousehold(db, householdId)
	const today = toDateOnlyLocal(opts.now)
	const horizonEnd = addDaysToDateOnly(today, REMINDER_HORIZON_DAYS)

	const reminderCourses = courses.filter(
		(course) =>
			!course.isPrn &&
			course.remindersEnabled &&
			!course.archivedAt,
	)

	const occurrences = getOccurrencesBetween({
		courses: reminderCourses,
		schedules,
		startDate: today,
		endDate: horizonEnd,
	})

	const medicineNames = new Map<string, string>()
	const personNames = new Map<string, string>()
	const desired: DesiredReminder[] = []

	for (const occurrence of occurrences) {
		const intake = await findActiveOccurrenceIntake(
			db,
			occurrence.scheduleId,
			occurrence.scheduledDate,
			occurrence.scheduledTime,
		)

		if (intake && !intake.cancelledAt) {
			if (intake.status === 'taken' || intake.status === 'skipped') {
				continue
			}
		}

		let triggerDate: Date
		if (
			intake &&
			intake.status === 'snoozed' &&
			intake.snoozedUntil
		) {
			triggerDate = new Date(intake.snoozedUntil)
			if (triggerDate.getTime() <= opts.now.getTime()) {
				// Expired snooze — fall back to original schedule if still future.
				triggerDate = localDateTimeToDate(
					occurrence.scheduledDate,
					occurrence.scheduledTime,
				)
				if (triggerDate.getTime() <= opts.now.getTime()) {
					continue
				}
			}
		} else {
			triggerDate = localDateTimeToDate(
				occurrence.scheduledDate,
				occurrence.scheduledTime,
			)
			if (triggerDate.getTime() <= opts.now.getTime()) {
				continue
			}
		}

		if (!medicineNames.has(occurrence.medicineId)) {
			const row = await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM medicines WHERE id = ?`,
				[occurrence.medicineId],
			)
			medicineNames.set(occurrence.medicineId, row?.name ?? 'Лекарство')
		}
		if (!personNames.has(occurrence.personId)) {
			const row = await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM people WHERE id = ?`,
				[occurrence.personId],
			)
			personNames.set(occurrence.personId, row?.name ?? 'Я')
		}

		const medicineName = medicineNames.get(occurrence.medicineId) ?? 'Лекарство'
		const personName = personNames.get(occurrence.personId) ?? 'Я'
		const content = buildReminderContent({
			medicineName,
			personName,
			isDefaultPerson: personName === opts.defaultPersonName,
			doseQuantity: occurrence.doseQuantity,
			doseUnit: occurrence.doseUnit,
			courseId: occurrence.courseId,
			scheduleId: occurrence.scheduleId,
			medicineId: occurrence.medicineId,
			personId: occurrence.personId,
			scheduledDate: occurrence.scheduledDate,
			scheduledTime: occurrence.scheduledTime,
		})

		desired.push({
			occurrenceKey: content.payload.occurrenceKey,
			courseId: occurrence.courseId,
			scheduleId: occurrence.scheduleId,
			medicineId: occurrence.medicineId,
			personId: occurrence.personId,
			scheduledDate: occurrence.scheduledDate,
			scheduledTime: occurrence.scheduledTime,
			triggerAt: triggerDate.toISOString(),
			title: content.title,
			body: content.body,
			payload: content.payload,
		})
	}

	return desired
}

async function scheduleDesired (
	db: SqlExecutor,
	client: NotificationNativeClient,
	want: DesiredReminder,
): Promise<boolean> {
	try {
		const nativeId = await client.scheduleReminder({
			identifier: want.occurrenceKey,
			title: want.title,
			body: want.body,
			data: payloadToData(want.payload),
			triggerAt: new Date(want.triggerAt),
			channelId: MEDICATION_REMINDER_CHANNEL_ID,
		})
		await upsertScheduledNotification(db, {
			occurrenceKey: want.occurrenceKey,
			courseId: want.courseId,
			scheduleId: want.scheduleId,
			scheduledDate: want.scheduledDate,
			scheduledTime: want.scheduledTime,
			nativeNotificationId: nativeId,
			triggerAt: want.triggerAt,
		})
		return true
	} catch (error) {
		logger.error('Failed to schedule medication reminder', error)
		analytics.reportError(error, {
			source: 'syncMedicationReminders.schedule',
		})
		// Do not leave a false-success ledger row.
		await deleteByOccurrenceKey(db, want.occurrenceKey)
		return false
	}
}

async function cancelLedgerEntries (
	db: SqlExecutor,
	client: NotificationNativeClient,
	ledger: Awaited<ReturnType<typeof listScheduledNotificationsForHousehold>>,
): Promise<number> {
	let cancelled = 0
	for (const entry of ledger) {
		await safeCancel(client, entry.nativeNotificationId)
		await deleteScheduledNotification(db, entry.id)
		cancelled += 1
	}
	return cancelled
}

async function safeCancel (
	client: NotificationNativeClient,
	nativeId: string,
): Promise<void> {
	try {
		await client.cancelReminder(nativeId)
	} catch (error) {
		logger.error('Failed to cancel native reminder', error)
		analytics.reportError(error, { source: 'syncMedicationReminders.cancel' })
	}
}

/**
 * Schedules a one-off test notification (~10s). Does not touch medication ledger.
 */
export async function scheduleTestReminder (
	client: NotificationNativeClient,
	options?: { delayMs?: number; now?: Date },
): Promise<{ scheduled: boolean; reason?: string }> {
	await client.ensureChannel()
	const permission = await client.getPermissionState()
	if (permission.status !== 'granted') {
		return { scheduled: false, reason: 'permission_denied' }
	}

	const now = options?.now ?? new Date()
	const delayMs = options?.delayMs ?? 10_000
	const triggerAt = new Date(now.getTime() + delayMs)
	const identifier = `test-reminder-${triggerAt.getTime()}`

	await client.scheduleReminder({
		identifier,
		title: APP_NOTIFICATION_TITLE,
		body: 'Тестовое напоминание «Моя аптечка»',
		data: { kind: 'test_reminder' },
		triggerAt,
		channelId: MEDICATION_REMINDER_CHANNEL_ID,
	})

	return { scheduled: true }
}
