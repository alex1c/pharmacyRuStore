import { isDateOnly, isLocalTimeHm, nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import {
	MedicationSchedule,
	ScheduleType,
	WeekdaysMask,
} from '../types'

interface ScheduleRow {
	id: string
	course_id: string
	type: string
	time_of_day: string | null
	weekdays_mask: number | null
	interval_days: number | null
	one_time_date: string | null
	created_at: string
	updated_at: string
	archived_at: string | null
}

function mapRow (row: ScheduleRow): MedicationSchedule {
	return {
		id: row.id,
		courseId: row.course_id,
		type: row.type as ScheduleType,
		timeOfDay: row.time_of_day,
		weekdaysMask: row.weekdays_mask,
		intervalDays: row.interval_days,
		oneTimeDate: row.one_time_date,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at,
	}
}

const SELECT_COLS = `
	id, course_id, type, time_of_day, weekdays_mask, interval_days,
	one_time_date, created_at, updated_at, archived_at
`

export interface ScheduleInput {
	courseId: string
	type: ScheduleType
	timeOfDay?: string | null
	weekdaysMask?: WeekdaysMask | null
	intervalDays?: number | null
	oneTimeDate?: string | null
}

export async function createSchedule (
	db: SqlExecutor,
	input: ScheduleInput,
): Promise<MedicationSchedule> {
	assertScheduleInput(input)

	const timestamp = nowIso()
	const schedule: MedicationSchedule = {
		id: createId('sched'),
		courseId: input.courseId,
		type: input.type,
		timeOfDay: input.timeOfDay ?? null,
		weekdaysMask: input.weekdaysMask ?? null,
		intervalDays: input.intervalDays ?? null,
		oneTimeDate: input.oneTimeDate ?? null,
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
	}

	await db.runAsync(
		`INSERT INTO medication_schedules
			(id, course_id, type, time_of_day, weekdays_mask, interval_days,
			 one_time_date, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			schedule.id,
			schedule.courseId,
			schedule.type,
			schedule.timeOfDay,
			schedule.weekdaysMask,
			schedule.intervalDays,
			schedule.oneTimeDate,
			schedule.createdAt,
			schedule.updatedAt,
		],
	)

	return schedule
}

export async function listSchedulesForCourse (
	db: SqlExecutor,
	courseId: string,
	options?: { includeArchived?: boolean },
): Promise<MedicationSchedule[]> {
	const includeArchived = options?.includeArchived ?? false
	const rows = await db.getAllAsync<ScheduleRow>(
		includeArchived
			? `SELECT ${SELECT_COLS}
				 FROM medication_schedules
				 WHERE course_id = ?
				 ORDER BY time_of_day ASC, created_at ASC`
			: `SELECT ${SELECT_COLS}
				 FROM medication_schedules
				 WHERE course_id = ? AND archived_at IS NULL
				 ORDER BY time_of_day ASC, created_at ASC`,
		[courseId],
	)
	return rows.map(mapRow)
}

export async function listActiveSchedulesForHousehold (
	db: SqlExecutor,
	householdId: string,
): Promise<MedicationSchedule[]> {
	const rows = await db.getAllAsync<ScheduleRow>(
		`SELECT s.id, s.course_id, s.type, s.time_of_day, s.weekdays_mask,
			s.interval_days, s.one_time_date, s.created_at, s.updated_at, s.archived_at
		 FROM medication_schedules s
		 INNER JOIN medication_courses c ON c.id = s.course_id
		 WHERE c.household_id = ?
			 AND c.archived_at IS NULL
			 AND s.archived_at IS NULL`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function archiveSchedulesForCourse (
	db: SqlExecutor,
	courseId: string,
): Promise<void> {
	const timestamp = nowIso()
	await db.runAsync(
		`UPDATE medication_schedules
		 SET archived_at = ?, updated_at = ?
		 WHERE course_id = ? AND archived_at IS NULL`,
		[timestamp, timestamp, courseId],
	)
}

/**
 * Replaces active schedules for a course (archives old, inserts new).
 * Past intake history is untouched.
 */
export async function replaceSchedulesForCourse (
	db: SqlExecutor,
	courseId: string,
	inputs: Omit<ScheduleInput, 'courseId'>[],
): Promise<MedicationSchedule[]> {
	await archiveSchedulesForCourse(db, courseId)
	const created: MedicationSchedule[] = []
	for (const input of inputs) {
		created.push(
			await createSchedule(db, {
				...input,
				courseId,
			}),
		)
	}
	return created
}

function assertScheduleInput (input: ScheduleInput): void {
	switch (input.type) {
		case 'daily':
			if (!input.timeOfDay || !isLocalTimeHm(input.timeOfDay)) {
				throw new Error('INVALID_SCHEDULE_TIME')
			}
			break
		case 'weekdays':
			if (!input.timeOfDay || !isLocalTimeHm(input.timeOfDay)) {
				throw new Error('INVALID_SCHEDULE_TIME')
			}
			if (!input.weekdaysMask || input.weekdaysMask <= 0) {
				throw new Error('INVALID_WEEKDAYS')
			}
			break
		case 'every_n_days':
			if (!input.timeOfDay || !isLocalTimeHm(input.timeOfDay)) {
				throw new Error('INVALID_SCHEDULE_TIME')
			}
			if (
				!input.intervalDays ||
				!Number.isInteger(input.intervalDays) ||
				input.intervalDays < 1
			) {
				throw new Error('INVALID_INTERVAL')
			}
			break
		case 'one_time':
			if (!input.timeOfDay || !isLocalTimeHm(input.timeOfDay)) {
				throw new Error('INVALID_SCHEDULE_TIME')
			}
			if (!input.oneTimeDate || !isDateOnly(input.oneTimeDate)) {
				throw new Error('INVALID_ONE_TIME_DATE')
			}
			break
		default:
			throw new Error('INVALID_SCHEDULE_TYPE')
	}
}
