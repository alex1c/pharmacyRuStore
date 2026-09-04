import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import { ScheduledNotification } from '../types'

interface Row {
	id: string
	occurrence_key: string
	course_id: string
	schedule_id: string
	scheduled_date: string
	scheduled_time: string
	native_notification_id: string
	trigger_at: string
	created_at: string
	updated_at: string
}

function mapRow (row: Row): ScheduledNotification {
	return {
		id: row.id,
		occurrenceKey: row.occurrence_key,
		courseId: row.course_id,
		scheduleId: row.schedule_id,
		scheduledDate: row.scheduled_date,
		scheduledTime: row.scheduled_time,
		nativeNotificationId: row.native_notification_id,
		triggerAt: row.trigger_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

const SELECT_COLS = `
	id, occurrence_key, course_id, schedule_id, scheduled_date, scheduled_time,
	native_notification_id, trigger_at, created_at, updated_at
`

export async function listScheduledNotifications (
	db: SqlExecutor,
): Promise<ScheduledNotification[]> {
	const rows = await db.getAllAsync<Row>(
		`SELECT ${SELECT_COLS} FROM scheduled_notifications
		 ORDER BY trigger_at ASC`,
	)
	return rows.map(mapRow)
}

export async function listScheduledNotificationsForHousehold (
	db: SqlExecutor,
	householdId: string,
): Promise<ScheduledNotification[]> {
	const rows = await db.getAllAsync<Row>(
		`SELECT sn.id, sn.occurrence_key, sn.course_id, sn.schedule_id,
			sn.scheduled_date, sn.scheduled_time, sn.native_notification_id,
			sn.trigger_at, sn.created_at, sn.updated_at
		 FROM scheduled_notifications sn
		 INNER JOIN medication_courses c ON c.id = sn.course_id
		 WHERE c.household_id = ?
		 ORDER BY sn.trigger_at ASC`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function getByOccurrenceKey (
	db: SqlExecutor,
	occurrenceKey: string,
): Promise<ScheduledNotification | null> {
	const row = await db.getFirstAsync<Row>(
		`SELECT ${SELECT_COLS} FROM scheduled_notifications
		 WHERE occurrence_key = ?`,
		[occurrenceKey],
	)
	return row ? mapRow(row) : null
}

export async function upsertScheduledNotification (
	db: SqlExecutor,
	input: {
		occurrenceKey: string
		courseId: string
		scheduleId: string
		scheduledDate: string
		scheduledTime: string
		nativeNotificationId: string
		triggerAt: string
	},
): Promise<ScheduledNotification> {
	const existing = await getByOccurrenceKey(db, input.occurrenceKey)
	const timestamp = nowIso()

	if (existing) {
		await db.runAsync(
			`UPDATE scheduled_notifications
			 SET native_notification_id = ?, trigger_at = ?, updated_at = ?,
				 course_id = ?, schedule_id = ?, scheduled_date = ?, scheduled_time = ?
			 WHERE id = ?`,
			[
				input.nativeNotificationId,
				input.triggerAt,
				timestamp,
				input.courseId,
				input.scheduleId,
				input.scheduledDate,
				input.scheduledTime,
				existing.id,
			],
		)
		const updated = await getByOccurrenceKey(db, input.occurrenceKey)
		if (!updated) {
			throw new Error('Scheduled notification missing after update')
		}
		return updated
	}

	const row: ScheduledNotification = {
		id: createId('snot'),
		occurrenceKey: input.occurrenceKey,
		courseId: input.courseId,
		scheduleId: input.scheduleId,
		scheduledDate: input.scheduledDate,
		scheduledTime: input.scheduledTime,
		nativeNotificationId: input.nativeNotificationId,
		triggerAt: input.triggerAt,
		createdAt: timestamp,
		updatedAt: timestamp,
	}

	await db.runAsync(
		`INSERT INTO scheduled_notifications
			(id, occurrence_key, course_id, schedule_id, scheduled_date, scheduled_time,
			 native_notification_id, trigger_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			row.id,
			row.occurrenceKey,
			row.courseId,
			row.scheduleId,
			row.scheduledDate,
			row.scheduledTime,
			row.nativeNotificationId,
			row.triggerAt,
			row.createdAt,
			row.updatedAt,
		],
	)

	return row
}

export async function deleteScheduledNotification (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	await db.runAsync(`DELETE FROM scheduled_notifications WHERE id = ?`, [id])
}

export async function deleteByOccurrenceKey (
	db: SqlExecutor,
	occurrenceKey: string,
): Promise<void> {
	await db.runAsync(
		`DELETE FROM scheduled_notifications WHERE occurrence_key = ?`,
		[occurrenceKey],
	)
}
