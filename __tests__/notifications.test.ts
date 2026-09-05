import { applyMigrations, getLatestSchemaVersion } from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import { createCourseWithSchedules, updateCourseWithSchedules } from '@/domain/courseService'
import {
	markOccurrenceSkipped,
	markOccurrenceTaken,
	snoozeOccurrence,
	undoIntake,
} from '@/domain/intakeService'
import { createBatch } from '@/db/repositories/medicineBatches'
import { archiveMedicine, createMedicine } from '@/db/repositories/medicines'
import { finishCourse } from '@/db/repositories/medicationCourses'
import { listScheduledNotificationsForHousehold } from '@/db/repositories/scheduledNotifications'
import {
	getAppSettings,
	setMedicationRemindersEnabled,
} from '@/db/repositories/settings'
import {
	addDaysToDateOnly,
	buildOccurrenceKey,
	localDateTimeToDate,
	NotificationNativeClient,
	NotificationPermissionState,
	REMINDER_HORIZON_DAYS,
	syncMedicationReminders,
} from '@/services/notifications'
import { toDateOnlyLocal } from '@/utils/dates'
import { createTestSqlExecutor } from './helpers/testDatabase'

function createMockClient (
	permission: NotificationPermissionState = {
		status: 'granted',
		canAskAgain: true,
	},
): NotificationNativeClient & {
	scheduled: Map<string, { triggerAt: Date; title: string }>
	scheduleFails: boolean
	cancelFails: boolean
} {
	const scheduled = new Map<string, { triggerAt: Date; title: string }>()
	let currentPermission = permission

	const client: NotificationNativeClient & {
		scheduled: Map<string, { triggerAt: Date; title: string }>
		scheduleFails: boolean
		cancelFails: boolean
	} = {
		scheduled,
		scheduleFails: false,
		cancelFails: false,
		async ensureChannel () {
			return
		},
		async getPermissionState () {
			return currentPermission
		},
		async requestPermissions () {
			currentPermission = { status: 'granted', canAskAgain: true }
			return currentPermission
		},
		async scheduleReminder (input) {
			if (client.scheduleFails) {
				throw new Error('SCHEDULE_FAIL')
			}
			scheduled.set(input.identifier, {
				triggerAt: input.triggerAt,
				title: input.title,
			})
			return input.identifier
		},
		async cancelReminder (id) {
			if (client.cancelFails) {
				throw new Error('CANCEL_FAIL')
			}
			scheduled.delete(id)
		},
		async getScheduledIds () {
			return [...scheduled.keys()]
		},
		async openSystemSettings () {
			return
		},
	}
	return client
}

describe('localDateTimeToDate', () => {
	it('keeps wall-clock HH:mm without UTC concatenation', () => {
		const date = localDateTimeToDate('2026-09-04', '08:00')
		expect(date.getFullYear()).toBe(2026)
		expect(date.getMonth()).toBe(8)
		expect(date.getDate()).toBe(4)
		expect(date.getHours()).toBe(8)
		expect(date.getMinutes()).toBe(0)
	})

	it('forms local morning hour on DST-sensitive calendar date', () => {
		const date = localDateTimeToDate('2026-03-29', '08:00')
		expect(date.getHours()).toBe(8)
		expect(date.getMinutes()).toBe(0)
	})
})

describe('medication reminder reconciliation', () => {
	async function setup () {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		expect(getLatestSchemaVersion()).toBe(6)
		const seed = await ensureFirstRunDefaults(db)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Лозартан 50 мг',
			form: 'tablet',
		})
		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 30,
			unit: 'tablet',
			expiryDate: '2027-05',
		})
		return { db, seed, medicine }
	}

	it('creates reminders when permission granted; repeated sync is idempotent', async () => {
		const ctx = await setup()
		const client = createMockClient()
		const now = new Date(2026, 8, 4, 7, 0, 0)
		const created = await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
				remindersEnabled: true,
			},
			schedules: [{ type: 'daily', timeOfDay: '08:00' }],
		})

		const first = await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(first.scheduled).toBeGreaterThan(0)

		const second = await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(second.scheduled).toBe(0)
		expect(second.kept).toBeGreaterThan(0)

		const ledger = await listScheduledNotificationsForHousehold(
			ctx.db,
			ctx.seed.household.id,
		)
		expect(new Set(ledger.map((item) => item.occurrenceKey)).size).toBe(
			ledger.length,
		)
		expect(
			client.scheduled.has(
				buildOccurrenceKey(created.schedules[0]!.id, '2026-09-04', '08:00'),
			),
		).toBe(true)
	})

	it('does not schedule when permission denied or global OFF', async () => {
		const ctx = await setup()
		await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [{ type: 'daily', timeOfDay: '08:00' }],
		})
		const now = new Date(2026, 8, 4, 7, 0, 0)

		const denied = createMockClient({ status: 'denied', canAskAgain: false })
		const deniedResult = await syncMedicationReminders(
			ctx.db,
			ctx.seed.household.id,
			{ client: denied, now },
		)
		expect(deniedResult.skippedReason).toBe('permission_denied')
		expect(denied.scheduled.size).toBe(0)

		const granted = createMockClient()
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client: granted,
			now,
		})
		expect(granted.scheduled.size).toBeGreaterThan(0)

		await setMedicationRemindersEnabled(ctx.db, false)
		expect((await getAppSettings(ctx.db)).medicationRemindersEnabled).toBe(false)
		const off = await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client: granted,
			now,
		})
		expect(off.skippedReason).toBe('global_off')
		expect(granted.scheduled.size).toBe(0)
	})

	it('undetermined permission skips scheduling without prompting', async () => {
		const ctx = await setup()
		await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [{ type: 'daily', timeOfDay: '09:00' }],
		})
		const client = createMockClient({
			status: 'undetermined',
			canAskAgain: true,
		})
		const result = await syncMedicationReminders(
			ctx.db,
			ctx.seed.household.id,
			{ client, now: new Date(2026, 8, 4, 7, 0, 0) },
		)
		expect(result.skippedReason).toBe('permission_denied')
		expect(client.scheduled.size).toBe(0)
	})

	it('reschedules after course edit; cancels on finish', async () => {
		const ctx = await setup()
		const client = createMockClient()
		const now = new Date(2026, 8, 4, 7, 0, 0)
		const created = await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [{ type: 'daily', timeOfDay: '08:00' }],
		})
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		const oldKey = buildOccurrenceKey(
			created.schedules[0]!.id,
			'2026-09-04',
			'08:00',
		)
		expect(client.scheduled.has(oldKey)).toBe(true)

		const updated = await updateCourseWithSchedules(ctx.db, created.course.id, {
			course: {
				personId: ctx.seed.person.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
				remindersEnabled: true,
			},
			schedules: [{ type: 'daily', timeOfDay: '09:00' }],
		})
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.has(oldKey)).toBe(false)
		expect(
			client.scheduled.has(
				buildOccurrenceKey(updated.schedules[0]!.id, '2026-09-04', '09:00'),
			),
		).toBe(true)

		await finishCourse(ctx.db, created.course.id, '2026-09-04')
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.size).toBe(0)
	})

	it('snooze moves trigger; taken/skipped cancel; undo restores future', async () => {
		const ctx = await setup()
		const client = createMockClient()
		const now = new Date(2026, 8, 4, 7, 0, 0)
		const created = await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [
				{ type: 'daily', timeOfDay: '08:00' },
				{ type: 'daily', timeOfDay: '20:00' },
			],
		})
		const morning = created.schedules.find((item) => item.timeOfDay === '08:00')!
		const evening = created.schedules.find((item) => item.timeOfDay === '20:00')!
		const morningOcc = {
			courseId: created.course.id,
			scheduleId: morning.id,
			medicineId: ctx.medicine.id,
			personId: ctx.seed.person.id,
			scheduledDate: '2026-09-04',
			scheduledTime: '08:00',
			doseQuantity: 1,
			doseUnit: 'tablet' as const,
		}
		const eveningOcc = {
			...morningOcc,
			scheduleId: evening.id,
			scheduledTime: '20:00',
		}
		const morningKey = buildOccurrenceKey(morning.id, '2026-09-04', '08:00')
		const eveningKey = buildOccurrenceKey(evening.id, '2026-09-04', '20:00')

		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.has(morningKey)).toBe(true)

		await snoozeOccurrence(ctx.db, morningOcc, 30, { now })
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.get(morningKey)?.triggerAt.getTime()).toBe(
			now.getTime() + 30 * 60_000,
		)

		const taken = await markOccurrenceTaken(ctx.db, morningOcc, {
			now: new Date(now.getTime() + 1000),
		})
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.has(morningKey)).toBe(false)

		await markOccurrenceSkipped(ctx.db, eveningOcc)
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.has(eveningKey)).toBe(false)

		// Past occurrence undo must not recreate a past reminder.
		await undoIntake(ctx.db, taken.id)
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now: new Date(2026, 8, 4, 9, 0, 0),
		})
		expect(client.scheduled.has(morningKey)).toBe(false)

		// Future day undo restores reminder.
		const futureNow = new Date(2026, 8, 5, 7, 0, 0)
		const futureOcc = { ...morningOcc, scheduledDate: '2026-09-05' }
		const futureKey = buildOccurrenceKey(morning.id, '2026-09-05', '08:00')
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now: futureNow,
		})
		expect(client.scheduled.has(futureKey)).toBe(true)
		const futureTaken = await markOccurrenceTaken(ctx.db, futureOcc, {
			now: futureNow,
		})
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now: futureNow,
		})
		expect(client.scheduled.has(futureKey)).toBe(false)
		await undoIntake(ctx.db, futureTaken.id)
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now: futureNow,
		})
		expect(client.scheduled.has(futureKey)).toBe(true)
	})

	it('PRN none; one-time exactly one; outside horizon none', async () => {
		const ctx = await setup()
		const client = createMockClient()
		const now = new Date(2026, 8, 4, 7, 0, 0)

		await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: true,
			},
			schedules: [],
		})
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.size).toBe(0)

		const oneTime = await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [
				{ type: 'one_time', timeOfDay: '11:00', oneTimeDate: '2026-09-10' },
			],
		})
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		const oneKey = buildOccurrenceKey(
			oneTime.schedules[0]!.id,
			'2026-09-10',
			'11:00',
		)
		expect(client.scheduled.has(oneKey)).toBe(true)
		expect(
			[...client.scheduled.keys()].filter((key) =>
				key.includes(oneTime.schedules[0]!.id),
			),
		).toHaveLength(1)

		const farDate = addDaysToDateOnly(
			toDateOnlyLocal(now),
			REMINDER_HORIZON_DAYS + 5,
		)
		const far = await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [
				{ type: 'one_time', timeOfDay: '12:00', oneTimeDate: farDate },
			],
		})
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(
			client.scheduled.has(
				buildOccurrenceKey(far.schedules[0]!.id, farDate, '12:00'),
			),
		).toBe(false)
	})

	it('medicine archive cancels; schedule failure leaves no ledger success row', async () => {
		const ctx = await setup()
		const client = createMockClient()
		const now = new Date(2026, 8, 4, 7, 0, 0)
		await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: ctx.medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [{ type: 'daily', timeOfDay: '08:00' }],
		})
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.size).toBeGreaterThan(0)

		await archiveMedicine(ctx.db, ctx.medicine.id)
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(client.scheduled.size).toBe(0)
		expect(
			await listScheduledNotificationsForHousehold(
				ctx.db,
				ctx.seed.household.id,
			),
		).toHaveLength(0)

		const medicine2 = await createMedicine(ctx.db, {
			householdId: ctx.seed.household.id,
			name: 'Ибупрофен',
			form: 'tablet',
		})
		await createBatch(ctx.db, {
			medicineId: medicine2.id,
			cabinetId: ctx.seed.cabinet.id,
			quantity: 10,
			unit: 'tablet',
		})
		await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: ctx.seed.person.id,
				medicineId: medicine2.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [{ type: 'daily', timeOfDay: '10:00' }],
		})
		client.scheduleFails = true
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(
			await listScheduledNotificationsForHousehold(
				ctx.db,
				ctx.seed.household.id,
			),
		).toHaveLength(0)

		client.scheduleFails = false
		client.cancelFails = true
		await syncMedicationReminders(ctx.db, ctx.seed.household.id, {
			client,
			now,
		})
		expect(getLatestSchemaVersion()).toBe(6)
	})
})
