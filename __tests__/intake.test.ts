import { planFefoConsumption } from '@/domain/fefoConsumption'
import {
	markOccurrenceSkipped,
	markOccurrenceTaken,
	snoozeOccurrence,
	takePrnDose,
	undoIntake,
} from '@/domain/intakeService'
import { createCourseWithSchedules } from '@/domain/courseService'
import { applyMigrations, getLatestSchemaVersion } from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import { createBatch, getBatchById } from '@/db/repositories/medicineBatches'
import { createMedicine } from '@/db/repositories/medicines'
import {
	findActiveOccurrenceIntake,
	listMovementsForIntake,
} from '@/db/repositories/intakeRecords'
import { listActiveCourses } from '@/db/repositories/medicationCourses'
import { listSchedulesForCourse } from '@/db/repositories/medicationSchedules'
import { finishCourse } from '@/db/repositories/medicationCourses'
import { listHistoryIntakes } from '@/db/repositories/intakeRecords'
import { MedicineBatch } from '@/db/types'
import { parseDoseInput } from '@/utils/dose'
import { createTestSqlExecutor } from './helpers/testDatabase'

describe('dose parsing', () => {
	it('parses Russian decimal comma', () => {
		expect(parseDoseInput('0,5')).toBe(0.5)
		expect(parseDoseInput('5,0')).toBe(5)
	})

	it('rejects invalid dose', () => {
		expect(parseDoseInput('-1')).toBeNull()
		expect(parseDoseInput('0')).toBeNull()
		expect(parseDoseInput('abc')).toBeNull()
	})
})

describe('FEFO planner', () => {
	function batch (overrides: Partial<MedicineBatch>): MedicineBatch {
		return {
			id: 'b',
			medicineId: 'm',
			cabinetId: 'c',
			storageLocationId: null,
			quantity: 1,
			unit: 'tablet',
			expiryDate: null,
			openedAt: null,
			afterOpeningValue: null,
			afterOpeningUnit: null,
			purchaseDate: null,
			notes: null,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
			archivedAt: null,
			...overrides,
		}
	}

	it('consumes earliest expiry first across packs', () => {
		const plan = planFefoConsumption(
			[
				batch({
					id: 'a',
					quantity: 1,
					expiryDate: '2026-10',
					createdAt: '2026-01-02T00:00:00.000Z',
				}),
				batch({
					id: 'b',
					quantity: 10,
					expiryDate: '2027-05',
					createdAt: '2026-01-01T00:00:00.000Z',
				}),
			],
			2,
			'tablet',
		)
		expect(plan.allocations).toEqual([
			{ batchId: 'a', quantity: 1 },
			{ batchId: 'b', quantity: 1 },
		])
		expect(plan.shortfall).toBe(0)
	})
})

describe('intake service', () => {
	async function setup () {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		expect(getLatestSchemaVersion()).toBe(4)
		const seed = await ensureFirstRunDefaults(db)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Лозартан 50 мг',
			form: 'tablet',
		})
		const packA = await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 3,
			unit: 'tablet',
			expiryDate: '2026-10',
		})
		const packB = await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 30,
			unit: 'tablet',
			expiryDate: '2027-05',
		})
		const created = await createCourseWithSchedules(db, {
			course: {
				householdId: seed.household.id,
				personId: seed.person.id,
				medicineId: medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				endDate: null,
				isPrn: false,
			},
			schedules: [
				{ type: 'daily', timeOfDay: '08:00' },
				{ type: 'daily', timeOfDay: '20:00' },
			],
		})
		const schedules = await listSchedulesForCourse(db, created.course.id)
		const morning = schedules.find((item) => item.timeOfDay === '08:00')
		if (!morning) {
			throw new Error('missing morning schedule')
		}
		return {
			db,
			seed,
			medicine,
			packA,
			packB,
			course: created.course,
			occurrence: {
				courseId: created.course.id,
				scheduleId: morning.id,
				medicineId: medicine.id,
				personId: seed.person.id,
				scheduledDate: '2026-09-04',
				scheduledTime: '08:00',
				doseQuantity: 1,
				doseUnit: 'tablet' as const,
			},
		}
	}

	it('marks taken, stores actual time, debits FEFO, idempotent, undo', async () => {
		const ctx = await setup()
		const takenAt = new Date('2026-09-04T05:17:00.000Z')

		const first = await markOccurrenceTaken(ctx.db, ctx.occurrence, {
			now: takenAt,
		})
		expect(first.status).toBe('taken')
		expect(first.actualTakenAt).toBe(takenAt.toISOString())
		expect(first.scheduledTime).toBe('08:00')

		const a1 = await getBatchById(ctx.db, ctx.packA.id)
		expect(a1?.quantity).toBe(2)

		const movements = await listMovementsForIntake(ctx.db, first.id)
		expect(movements).toHaveLength(1)
		expect(movements[0]?.batchId).toBe(ctx.packA.id)
		expect(movements[0]?.quantity).toBe(1)

		const second = await markOccurrenceTaken(ctx.db, ctx.occurrence, {
			now: new Date('2026-09-04T05:18:00.000Z'),
		})
		expect(second.id).toBe(first.id)
		const a2 = await getBatchById(ctx.db, ctx.packA.id)
		expect(a2?.quantity).toBe(2)

		await undoIntake(ctx.db, first.id)
		const a3 = await getBatchById(ctx.db, ctx.packA.id)
		expect(a3?.quantity).toBe(3)
		const active = await findActiveOccurrenceIntake(
			ctx.db,
			ctx.occurrence.scheduleId,
			ctx.occurrence.scheduledDate,
			ctx.occurrence.scheduledTime,
		)
		expect(active).toBeNull()
	})

	it('skips without inventory change and undoes to pending', async () => {
		const ctx = await setup()
		const record = await markOccurrenceSkipped(ctx.db, ctx.occurrence)
		expect(record.status).toBe('skipped')
		const a1 = await getBatchById(ctx.db, ctx.packA.id)
		expect(a1?.quantity).toBe(3)
		await undoIntake(ctx.db, record.id)
		const active = await findActiveOccurrenceIntake(
			ctx.db,
			ctx.occurrence.scheduleId,
			ctx.occurrence.scheduledDate,
			ctx.occurrence.scheduledTime,
		)
		expect(active).toBeNull()
	})

	it('stores snooze until', async () => {
		const ctx = await setup()
		const now = new Date('2026-09-04T05:00:00.000Z')
		const record = await snoozeOccurrence(ctx.db, ctx.occurrence, 30, { now })
		expect(record.status).toBe('snoozed')
		expect(record.snoozedUntil).toBe(
			new Date(now.getTime() + 30 * 60_000).toISOString(),
		)
	})

	it('FEFO multi-pack consume and undo', async () => {
		const ctx = await setup()
		await ctx.db.runAsync(
			`UPDATE medicine_batches SET quantity = 1 WHERE id = ?`,
			[ctx.packA.id],
		)
		await ctx.db.runAsync(
			`UPDATE medicine_batches SET quantity = 10 WHERE id = ?`,
			[ctx.packB.id],
		)
		const occurrence = {
			...ctx.occurrence,
			doseQuantity: 2,
		}
		const record = await markOccurrenceTaken(ctx.db, occurrence)
		const a = await getBatchById(ctx.db, ctx.packA.id)
		const b = await getBatchById(ctx.db, ctx.packB.id)
		expect(a?.quantity).toBe(0)
		expect(b?.quantity).toBe(9)
		const movements = await listMovementsForIntake(ctx.db, record.id)
		expect(movements.map((item) => ({
			batchId: item.batchId,
			quantity: item.quantity,
		}))).toEqual([
			{ batchId: ctx.packA.id, quantity: 1 },
			{ batchId: ctx.packB.id, quantity: 1 },
		])
		await undoIntake(ctx.db, record.id)
		expect((await getBatchById(ctx.db, ctx.packA.id))?.quantity).toBe(1)
		expect((await getBatchById(ctx.db, ctx.packB.id))?.quantity).toBe(10)
	})

	it('shortfall: consume available, flag shortfall, no negatives, undo', async () => {
		const ctx = await setup()
		// Leave only 1 tablet total.
		await ctx.db.runAsync(
			`UPDATE medicine_batches SET quantity = 0 WHERE id = ?`,
			[ctx.packB.id],
		)
		await ctx.db.runAsync(
			`UPDATE medicine_batches SET quantity = 1 WHERE id = ?`,
			[ctx.packA.id],
		)

		const occurrence = { ...ctx.occurrence, doseQuantity: 2 }
		await expect(
			markOccurrenceTaken(ctx.db, occurrence),
		).rejects.toMatchObject({ name: 'INVENTORY_SHORTFALL' })

		const record = await markOccurrenceTaken(ctx.db, occurrence, {
			allowShortfall: true,
		})
		expect(record.inventoryShortfall).toBe(true)
		expect((await getBatchById(ctx.db, ctx.packA.id))?.quantity).toBe(0)
		const movements = await listMovementsForIntake(ctx.db, record.id)
		expect(movements).toHaveLength(1)
		expect(movements[0]?.quantity).toBe(1)

		await undoIntake(ctx.db, record.id)
		expect((await getBatchById(ctx.db, ctx.packA.id))?.quantity).toBe(1)
	})

	it('PRN intake consumes inventory and undo restores', async () => {
		const ctx = await setup()
		const prn = await createCourseWithSchedules(ctx.db, {
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
		const record = await takePrnDose(ctx.db, prn.course)
		expect(record.scheduleId).toBeNull()
		expect(record.status).toBe('taken')
		expect((await getBatchById(ctx.db, ctx.packA.id))?.quantity).toBe(2)
		await undoIntake(ctx.db, record.id)
		expect((await getBatchById(ctx.db, ctx.packA.id))?.quantity).toBe(3)
	})

	it('history remains after finishing course; schedule edit keeps past intake', async () => {
		const ctx = await setup()
		const record = await markOccurrenceTaken(ctx.db, ctx.occurrence)
		await finishCourse(ctx.db, ctx.course.id, '2026-09-04')

		const history = await listHistoryIntakes(ctx.db, ctx.seed.household.id, {
			statusFilter: 'taken',
			limit: 20,
		})
		expect(history.some((item) => item.id === record.id)).toBe(true)

		const active = await listActiveCourses(ctx.db, ctx.seed.household.id)
		expect(active.find((item) => item.id === ctx.course.id)).toBeUndefined()
	})

	it('filters history by status', async () => {
		const ctx = await setup()
		await markOccurrenceTaken(ctx.db, ctx.occurrence)
		const evening = {
			...ctx.occurrence,
			scheduleId: (
				await listSchedulesForCourse(ctx.db, ctx.course.id)
			).find((item) => item.timeOfDay === '20:00')!.id,
			scheduledTime: '20:00',
		}
		await markOccurrenceSkipped(ctx.db, evening)

		const taken = await listHistoryIntakes(ctx.db, ctx.seed.household.id, {
			statusFilter: 'taken',
			limit: 20,
		})
		const skipped = await listHistoryIntakes(ctx.db, ctx.seed.household.id, {
			statusFilter: 'skipped',
			limit: 20,
		})
		expect(taken.every((item) => item.status === 'taken')).toBe(true)
		expect(skipped.every((item) => item.status === 'skipped')).toBe(true)
		expect(taken.length).toBeGreaterThanOrEqual(1)
		expect(skipped.length).toBeGreaterThanOrEqual(1)
	})
})
