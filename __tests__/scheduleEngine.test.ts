import {
	getOccurrencesForDate,
	WEEKDAY_BITS,
} from '@/domain/scheduleEngine'
import { MedicationCourse, MedicationSchedule } from '@/db/types'

function makeCourse (
	overrides: Partial<MedicationCourse> = {},
): MedicationCourse {
	return {
		id: 'course1',
		householdId: 'hh',
		personId: 'person1',
		medicineId: 'med1',
		doseQuantity: 1,
		doseUnit: 'tablet',
		startDate: '2026-09-01',
		endDate: null,
		instructions: null,
		isPrn: false,
		createdAt: 'a',
		updatedAt: 'a',
		archivedAt: null,
		...overrides,
	}
}

function makeSchedule (
	overrides: Partial<MedicationSchedule> = {},
): MedicationSchedule {
	return {
		id: 'sched1',
		courseId: 'course1',
		type: 'daily',
		timeOfDay: '08:00',
		weekdaysMask: null,
		intervalDays: null,
		oneTimeDate: null,
		createdAt: 'a',
		updatedAt: 'a',
		archivedAt: null,
		...overrides,
	}
}

describe('schedule engine — daily', () => {
	const course = makeCourse()
	const schedule = makeSchedule({ type: 'daily', timeOfDay: '08:00' })

	it('creates occurrence today within range', () => {
		const items = getOccurrencesForDate({
			courses: [course],
			schedules: [schedule],
			dateOnly: '2026-09-04',
		})
		expect(items).toHaveLength(1)
		expect(items[0]?.scheduledTime).toBe('08:00')
	})

	it('skips dates before start', () => {
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [schedule],
				dateOnly: '2026-08-31',
			}),
		).toHaveLength(0)
	})

	it('skips dates after end', () => {
		expect(
			getOccurrencesForDate({
				courses: [makeCourse({ endDate: '2026-09-03' })],
				schedules: [schedule],
				dateOnly: '2026-09-04',
			}),
		).toHaveLength(0)
	})
})

describe('schedule engine — weekdays', () => {
	const course = makeCourse({ startDate: '2026-08-31' })
	const schedule = makeSchedule({
		type: 'weekdays',
		timeOfDay: '09:00',
		// Mon Wed Fri
		weekdaysMask: WEEKDAY_BITS.mon | WEEKDAY_BITS.wed | WEEKDAY_BITS.fri,
	})

	it('matches Monday', () => {
		// 2026-09-07 is Monday
		const items = getOccurrencesForDate({
			courses: [course],
			schedules: [schedule],
			dateOnly: '2026-09-07',
		})
		expect(items).toHaveLength(1)
	})

	it('skips Tuesday', () => {
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [schedule],
				dateOnly: '2026-09-08',
			}),
		).toHaveLength(0)
	})

	it('handles Sunday boundary', () => {
		const sundayOnly = makeSchedule({
			id: 'sched-sun',
			type: 'weekdays',
			timeOfDay: '09:00',
			weekdaysMask: WEEKDAY_BITS.sun,
		})
		// 2026-09-06 is Sunday
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [sundayOnly],
				dateOnly: '2026-09-06',
			}),
		).toHaveLength(1)
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [sundayOnly],
				dateOnly: '2026-09-07',
			}),
		).toHaveLength(0)
	})
})

describe('schedule engine — every N days', () => {
	const course = makeCourse({ startDate: '2026-09-01' })
	const schedule = makeSchedule({
		type: 'every_n_days',
		timeOfDay: '10:00',
		intervalDays: 2,
	})

	it('matches day 0 (start)', () => {
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [schedule],
				dateOnly: '2026-09-01',
			}),
		).toHaveLength(1)
	})

	it('matches day N', () => {
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [schedule],
				dateOnly: '2026-09-03',
			}),
		).toHaveLength(1)
	})

	it('skips non-match day', () => {
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [schedule],
				dateOnly: '2026-09-02',
			}),
		).toHaveLength(0)
	})

	it('crosses month/year boundary', () => {
		const yearCourse = makeCourse({ startDate: '2026-12-31' })
		expect(
			getOccurrencesForDate({
				courses: [yearCourse],
				schedules: [schedule],
				dateOnly: '2027-01-02',
			}),
		).toHaveLength(1)
		expect(
			getOccurrencesForDate({
				courses: [yearCourse],
				schedules: [schedule],
				dateOnly: '2027-01-01',
			}),
		).toHaveLength(0)
	})
})

describe('schedule engine — one-time & PRN', () => {
	it('one-time exact day only', () => {
		const course = makeCourse()
		const schedule = makeSchedule({
			type: 'one_time',
			timeOfDay: '12:00',
			oneTimeDate: '2026-09-10',
		})
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [schedule],
				dateOnly: '2026-09-10',
			}),
		).toHaveLength(1)
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [schedule],
				dateOnly: '2026-09-11',
			}),
		).toHaveLength(0)
	})

	it('PRN produces no scheduled occurrences', () => {
		const course = makeCourse({ isPrn: true })
		const schedule = makeSchedule()
		expect(
			getOccurrencesForDate({
				courses: [course],
				schedules: [schedule],
				dateOnly: '2026-09-04',
			}),
		).toHaveLength(0)
	})
})
