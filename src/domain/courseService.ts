import {
	createCourse,
	updateCourse,
	CourseInput,
} from '@/db/repositories/medicationCourses'
import {
	createSchedule,
	replaceSchedulesForCourse,
	ScheduleInput,
} from '@/db/repositories/medicationSchedules'
import { MedicationCourse, MedicationSchedule } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'

export interface CourseWithSchedulesInput {
	course: CourseInput
	/** Empty for PRN courses. */
	schedules: Omit<ScheduleInput, 'courseId'>[]
}

/**
 * Creates a course and its schedule rows in one transaction.
 */
export async function createCourseWithSchedules (
	db: SqlExecutor,
	input: CourseWithSchedulesInput,
): Promise<{ course: MedicationCourse; schedules: MedicationSchedule[] }> {
	const run = async (target: SqlExecutor) => {
		if (input.course.isPrn && input.schedules.length > 0) {
			throw new Error('PRN_HAS_SCHEDULE')
		}
		if (!input.course.isPrn && input.schedules.length === 0) {
			throw new Error('SCHEDULE_REQUIRED')
		}

		const course = await createCourse(target, input.course)
		const schedules: MedicationSchedule[] = []
		for (const schedule of input.schedules) {
			schedules.push(
				await createSchedule(target, {
					...schedule,
					courseId: course.id,
				}),
			)
		}
		return { course, schedules }
	}

	if (db.withTransactionAsync) {
		return db.withTransactionAsync(run)
	}
	return run(db)
}

/**
 * Updates course fields and replaces future schedule rules.
 * Past intake history is not rewritten.
 */
export async function updateCourseWithSchedules (
	db: SqlExecutor,
	courseId: string,
	input: {
		course: Omit<CourseInput, 'householdId' | 'medicineId'>
		schedules: Omit<ScheduleInput, 'courseId'>[]
	},
): Promise<{ course: MedicationCourse; schedules: MedicationSchedule[] }> {
	const run = async (target: SqlExecutor) => {
		if (input.course.isPrn && input.schedules.length > 0) {
			throw new Error('PRN_HAS_SCHEDULE')
		}
		if (!input.course.isPrn && input.schedules.length === 0) {
			throw new Error('SCHEDULE_REQUIRED')
		}

		const course = await updateCourse(target, courseId, input.course)
		const schedules = input.course.isPrn
			? await replaceSchedulesForCourse(target, courseId, [])
			: await replaceSchedulesForCourse(target, courseId, input.schedules)

		return { course, schedules }
	}

	if (db.withTransactionAsync) {
		return db.withTransactionAsync(run)
	}
	return run(db)
}
