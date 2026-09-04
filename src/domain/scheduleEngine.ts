import { isDateOnly, isLocalTimeHm } from '@/utils/dates'
import {
	MedicationCourse,
	MedicationSchedule,
	ScheduledOccurrence,
	ScheduleType,
	WeekdaysMask,
} from '@/db/types'

export const WEEKDAY_BITS = {
	mon: 1,
	tue: 2,
	wed: 4,
	thu: 8,
	fri: 16,
	sat: 32,
	sun: 64,
} as const

export const WEEKDAY_ORDER = [
	{ bit: WEEKDAY_BITS.mon, label: 'Пн', jsDay: 1 },
	{ bit: WEEKDAY_BITS.tue, label: 'Вт', jsDay: 2 },
	{ bit: WEEKDAY_BITS.wed, label: 'Ср', jsDay: 3 },
	{ bit: WEEKDAY_BITS.thu, label: 'Чт', jsDay: 4 },
	{ bit: WEEKDAY_BITS.fri, label: 'Пт', jsDay: 5 },
	{ bit: WEEKDAY_BITS.sat, label: 'Сб', jsDay: 6 },
	{ bit: WEEKDAY_BITS.sun, label: 'Вс', jsDay: 0 },
] as const

/**
 * Converts JS Date.getDay() (0=Sun) to our weekday bit.
 */
export function weekdayBitFromJsDay (jsDay: number): number {
	const found = WEEKDAY_ORDER.find((item) => item.jsDay === jsDay)
	return found?.bit ?? 0
}

export function weekdayBitFromDateOnly (dateOnly: string): number {
	const [y, m, d] = dateOnly.split('-').map(Number)
	const date = new Date(y, m - 1, d)
	return weekdayBitFromJsDay(date.getDay())
}

export function hasWeekday (mask: WeekdaysMask, bit: number): boolean {
	return (mask & bit) === bit
}

/**
 * Inclusive calendar date comparison for YYYY-MM-DD strings.
 */
export function isDateInCourseRange (
	dateOnly: string,
	course: Pick<MedicationCourse, 'startDate' | 'endDate' | 'archivedAt' | 'isPrn'>,
): boolean {
	if (course.archivedAt) {
		return false
	}
	if (!isDateOnly(dateOnly) || !isDateOnly(course.startDate)) {
		return false
	}
	if (dateOnly < course.startDate) {
		return false
	}
	if (course.endDate && dateOnly > course.endDate) {
		return false
	}
	return true
}

/**
 * Days between start and date (0 on start day), local calendar.
 */
export function daysSinceStart (startDate: string, dateOnly: string): number {
	const [sy, sm, sd] = startDate.split('-').map(Number)
	const [ty, tm, td] = dateOnly.split('-').map(Number)
	const start = new Date(sy, sm - 1, sd)
	const target = new Date(ty, tm - 1, td)
	return Math.round((target.getTime() - start.getTime()) / 86400000)
}

/**
 * Whether a schedule rule produces an occurrence on the given calendar date.
 */
export function scheduleMatchesDate (
	schedule: MedicationSchedule,
	course: MedicationCourse,
	dateOnly: string,
): boolean {
	if (schedule.archivedAt || course.archivedAt || course.isPrn) {
		return false
	}
	if (!isDateInCourseRange(dateOnly, course)) {
		return false
	}

	switch (schedule.type as ScheduleType) {
		case 'daily':
			return Boolean(schedule.timeOfDay && isLocalTimeHm(schedule.timeOfDay))
		case 'weekdays': {
			if (!schedule.timeOfDay || !isLocalTimeHm(schedule.timeOfDay)) {
				return false
			}
			const mask = schedule.weekdaysMask ?? 0
			const bit = weekdayBitFromDateOnly(dateOnly)
			return hasWeekday(mask, bit)
		}
		case 'every_n_days': {
			if (!schedule.timeOfDay || !isLocalTimeHm(schedule.timeOfDay)) {
				return false
			}
			const interval = schedule.intervalDays ?? 0
			if (interval < 1) {
				return false
			}
			const offset = daysSinceStart(course.startDate, dateOnly)
			return offset >= 0 && offset % interval === 0
		}
		case 'one_time':
			return (
				schedule.oneTimeDate === dateOnly &&
				Boolean(schedule.timeOfDay && isLocalTimeHm(schedule.timeOfDay))
			)
		default:
			return false
	}
}

/**
 * Builds scheduled occurrences for one calendar date (no PRN).
 */
export function getOccurrencesForDate (input: {
	courses: MedicationCourse[]
	schedules: MedicationSchedule[]
	dateOnly: string
}): ScheduledOccurrence[] {
	const schedulesByCourse = new Map<string, MedicationSchedule[]>()
	for (const schedule of input.schedules) {
		if (schedule.archivedAt) {
			continue
		}
		const list = schedulesByCourse.get(schedule.courseId) ?? []
		list.push(schedule)
		schedulesByCourse.set(schedule.courseId, list)
	}

	const occurrences: ScheduledOccurrence[] = []

	for (const course of input.courses) {
		if (course.archivedAt || course.isPrn) {
			continue
		}
		const schedules = schedulesByCourse.get(course.id) ?? []
		for (const schedule of schedules) {
			if (!scheduleMatchesDate(schedule, course, input.dateOnly)) {
				continue
			}
			if (!schedule.timeOfDay) {
				continue
			}
			occurrences.push({
				courseId: course.id,
				scheduleId: schedule.id,
				medicineId: course.medicineId,
				personId: course.personId,
				scheduledDate: input.dateOnly,
				scheduledTime: schedule.timeOfDay,
				doseQuantity: course.doseQuantity,
				doseUnit: course.doseUnit,
			})
		}
	}

	occurrences.sort((a, b) => {
		if (a.scheduledTime === b.scheduledTime) {
			return a.courseId.localeCompare(b.courseId)
		}
		return a.scheduledTime < b.scheduledTime ? -1 : 1
	})

	return occurrences
}

/**
 * Inclusive date range occurrence generation (local calendar days).
 * Does not materialize an unbounded future.
 */
export function getOccurrencesBetween (input: {
	courses: MedicationCourse[]
	schedules: MedicationSchedule[]
	startDate: string
	endDate: string
}): ScheduledOccurrence[] {
	if (!isDateOnly(input.startDate) || !isDateOnly(input.endDate)) {
		return []
	}
	if (input.endDate < input.startDate) {
		return []
	}

	const result: ScheduledOccurrence[] = []
	const [sy, sm, sd] = input.startDate.split('-').map(Number)
	const cursor = new Date(sy, sm - 1, sd)
	const [ey, em, ed] = input.endDate.split('-').map(Number)
	const end = new Date(ey, em - 1, ed)

	while (cursor.getTime() <= end.getTime()) {
		const y = cursor.getFullYear()
		const m = String(cursor.getMonth() + 1).padStart(2, '0')
		const d = String(cursor.getDate()).padStart(2, '0')
		const dateOnly = `${y}-${m}-${d}`
		result.push(
			...getOccurrencesForDate({
				courses: input.courses,
				schedules: input.schedules,
				dateOnly,
			}),
		)
		cursor.setDate(cursor.getDate() + 1)
	}

	return result
}

export function formatScheduleSummary (
	schedules: MedicationSchedule[],
	isPrn: boolean,
): string {
	if (isPrn) {
		return 'По необходимости'
	}
	const active = schedules.filter((item) => !item.archivedAt)
	if (active.length === 0) {
		return 'Без расписания'
	}

	const times = active
		.map((item) => item.timeOfDay)
		.filter((value): value is string => Boolean(value))
		.sort()

	const type = active[0]?.type
	if (type === 'daily') {
		return `Ежедневно · ${times.join(', ')}`
	}
	if (type === 'weekdays') {
		const mask = active[0]?.weekdaysMask ?? 0
		const days = WEEKDAY_ORDER.filter((item) => hasWeekday(mask, item.bit))
			.map((item) => item.label)
			.join(' ')
		return `${days} · ${times.join(', ')}`
	}
	if (type === 'every_n_days') {
		const n = active[0]?.intervalDays ?? 1
		return `Каждые ${n} дн. · ${times.join(', ')}`
	}
	if (type === 'one_time') {
		return `Один раз · ${active[0]?.oneTimeDate ?? ''} ${times[0] ?? ''}`.trim()
	}
	return times.join(', ')
}
