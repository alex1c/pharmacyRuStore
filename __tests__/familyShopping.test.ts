import { applyMigrations, getLatestSchemaVersion } from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import { createCourseWithSchedules } from '@/domain/courseService'
import {
	markOccurrenceTaken,
	undoIntake,
} from '@/domain/intakeService'
import { createBatch, getBatchById } from '@/db/repositories/medicineBatches'
import { createMedicine, getMedicineSummary } from '@/db/repositories/medicines'
import {
	archivePerson,
	countActiveCoursesForPeople,
	createPerson,
	listPeopleByHousehold,
	updatePerson,
} from '@/db/repositories/people'
import {
	listActiveShoppingItems,
	listCompletedShoppingItems,
} from '@/db/repositories/shoppingItems'
import { setDefaultLowStockThreshold } from '@/db/repositories/settings'
import {
	addCustomShoppingItem,
	addMedicineToShopping,
	markPurchasedWithBatch,
} from '@/domain/purchaseService'
import { syncAutomaticShoppingItems } from '@/domain/shoppingService'
import { buildReminderContent } from '@/services/notifications'
import { createTestSqlExecutor } from './helpers/testDatabase'

describe('people CRUD', () => {
	async function setup () {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		expect(getLatestSchemaVersion()).toBe(6)
		const seed = await ensureFirstRunDefaults(db)
		return { db, seed }
	}

	it('creates, renames, counts courses, protects default archive', async () => {
		const ctx = await setup()
		const anna = await createPerson(ctx.db, {
			householdId: ctx.seed.household.id,
			name: 'Анна',
			note: 'дочь',
		})
		expect(anna.note).toBe('дочь')

		await updatePerson(ctx.db, anna.id, { name: 'Анна М.', note: null })
		const renamed = (await listPeopleByHousehold(ctx.db, ctx.seed.household.id))
			.find((p) => p.id === anna.id)
		expect(renamed?.name).toBe('Анна М.')

		const medicine = await createMedicine(ctx.db, {
			householdId: ctx.seed.household.id,
			name: 'Лозартан',
			form: 'tablet',
		})
		await createBatch(ctx.db, {
			medicineId: medicine.id,
			cabinetId: ctx.seed.cabinet.id,
			quantity: 10,
			unit: 'tablet',
		})
		await createCourseWithSchedules(ctx.db, {
			course: {
				householdId: ctx.seed.household.id,
				personId: anna.id,
				medicineId: medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [{ type: 'daily', timeOfDay: '08:00' }],
		})
		const counts = await countActiveCoursesForPeople(
			ctx.db,
			ctx.seed.household.id,
		)
		expect(counts.get(anna.id)).toBe(1)

		await expect(
			archivePerson(ctx.db, ctx.seed.person.id, {
				defaultPersonId: ctx.seed.person.id,
			}),
		).rejects.toMatchObject({ name: 'DEFAULT_PERSON' })

		await archivePerson(ctx.db, anna.id, {
			defaultPersonId: ctx.seed.person.id,
			finishActiveCourses: true,
		})
		const active = await listPeopleByHousehold(ctx.db, ctx.seed.household.id)
		expect(active.find((p) => p.id === anna.id)).toBeUndefined()
		const all = await listPeopleByHousehold(ctx.db, ctx.seed.household.id, {
			includeArchived: true,
		})
		expect(all.find((p) => p.id === anna.id)?.archivedAt).toBeTruthy()
	})
})

describe('automatic shopping', () => {
	async function setup (qty: number, threshold = 5) {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)
		await setDefaultLowStockThreshold(db, threshold)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Лозартан 50 мг',
			form: 'tablet',
			lowStockThreshold: threshold,
		})
		const batch = await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: qty,
			unit: 'tablet',
		})
		return { db, seed, medicine, batch }
	}

	it('creates one low-stock item and stays idempotent', async () => {
		const ctx = await setup(4, 5)
		const first = await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		expect(first.created).toBe(1)
		const second = await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		expect(second.created).toBe(0)
		const active = await listActiveShoppingItems(ctx.db, ctx.seed.household.id)
		expect(active).toHaveLength(1)
		expect(active[0]?.reason).toBe('low_stock')
	})

	it('updates low → empty on same row; recovers to completed', async () => {
		const ctx = await setup(4, 5)
		await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		await ctx.db.runAsync(
			`UPDATE medicine_batches SET quantity = 0 WHERE id = ?`,
			[ctx.batch.id],
		)
		await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		const active = await listActiveShoppingItems(ctx.db, ctx.seed.household.id)
		expect(active).toHaveLength(1)
		expect(active[0]?.reason).toBe('empty')

		await ctx.db.runAsync(
			`UPDATE medicine_batches SET quantity = 10 WHERE id = ?`,
			[ctx.batch.id],
		)
		await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		expect(
			await listActiveShoppingItems(ctx.db, ctx.seed.household.id),
		).toHaveLength(0)
		expect(
			(await listCompletedShoppingItems(ctx.db, ctx.seed.household.id)).length,
		).toBeGreaterThanOrEqual(1)
	})

	it('threshold change creates and completes items', async () => {
		const ctx = await setup(8, 5)
		await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		expect(
			await listActiveShoppingItems(ctx.db, ctx.seed.household.id),
		).toHaveLength(0)

		await setDefaultLowStockThreshold(ctx.db, 10)
		await ctx.db.runAsync(
			`UPDATE medicines SET low_stock_threshold = NULL WHERE id = ?`,
			[ctx.medicine.id],
		)
		await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		expect(
			await listActiveShoppingItems(ctx.db, ctx.seed.household.id),
		).toHaveLength(1)

		await setDefaultLowStockThreshold(ctx.db, 5)
		await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		expect(
			await listActiveShoppingItems(ctx.db, ctx.seed.household.id),
		).toHaveLength(0)
	})
})

describe('intake ↔ shopping', () => {
	it('taken creates low item; undo completes it', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)
		await setDefaultLowStockThreshold(db, 5)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Лозартан',
			form: 'tablet',
		})
		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 5,
			unit: 'tablet',
		})
		const course = await createCourseWithSchedules(db, {
			course: {
				householdId: seed.household.id,
				personId: seed.person.id,
				medicineId: medicine.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [{ type: 'daily', timeOfDay: '08:00' }],
		})
		const occurrence = {
			courseId: course.course.id,
			scheduleId: course.schedules[0]!.id,
			medicineId: medicine.id,
			personId: seed.person.id,
			scheduledDate: '2026-09-04',
			scheduledTime: '08:00',
			doseQuantity: 1,
			doseUnit: 'tablet' as const,
		}
		const taken = await markOccurrenceTaken(db, occurrence)
		await syncAutomaticShoppingItems(db, seed.household.id)
		expect(await listActiveShoppingItems(db, seed.household.id)).toHaveLength(1)

		await undoIntake(db, taken.id)
		await syncAutomaticShoppingItems(db, seed.household.id)
		expect(await listActiveShoppingItems(db, seed.household.id)).toHaveLength(0)
	})
})

describe('manual shopping + purchase', () => {
	async function setup () {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Лозартан 50 мг',
			form: 'tablet',
		})
		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 4,
			unit: 'tablet',
		})
		return { db, seed, medicine }
	}

	it('dedupes medicine add; custom complete; purchase creates one batch', async () => {
		const ctx = await setup()
		await syncAutomaticShoppingItems(ctx.db, ctx.seed.household.id)
		const auto = (await listActiveShoppingItems(ctx.db, ctx.seed.household.id))[0]!
		const manual = await addMedicineToShopping(ctx.db, {
			householdId: ctx.seed.household.id,
			medicineId: ctx.medicine.id,
		})
		expect(manual.created).toBe(false)
		expect(manual.item.id).toBe(auto.id)

		const custom = await addCustomShoppingItem(ctx.db, {
			householdId: ctx.seed.household.id,
			customName: 'Бинт стерильный',
		})
		expect(custom.customName).toBe('Бинт стерильный')

		const purchased = await markPurchasedWithBatch(ctx.db, {
			shoppingItemId: auto.id,
			batch: {
				medicineId: ctx.medicine.id,
				cabinetId: ctx.seed.cabinet.id,
				quantity: 30,
				unit: 'tablet',
				expiryDate: '2027-12',
			},
		})
		expect(purchased.shoppingItem.status).toBe('completed')
		const summary = await getMedicineSummary(ctx.db, ctx.medicine.id)
		expect(summary?.totalQuantity).toBe(34)

		await expect(
			markPurchasedWithBatch(ctx.db, {
				shoppingItemId: auto.id,
				batch: {
					medicineId: ctx.medicine.id,
					cabinetId: ctx.seed.cabinet.id,
					quantity: 1,
					unit: 'tablet',
				},
			}),
		).rejects.toThrow('ALREADY_COMPLETED')

		const batchesBefore = await ctx.db.getFirstAsync<{ count: number }>(
			`SELECT COUNT(*) AS count FROM medicine_batches WHERE medicine_id = ?`,
			[ctx.medicine.id],
		)
		expect(batchesBefore?.count).toBe(2)
	})
})

describe('notification person payload', () => {
	it('includes non-default person name; hides default', () => {
		const withPerson = buildReminderContent({
			medicineName: 'Лозартан 50 мг',
			personName: 'Анна',
			isDefaultPerson: false,
			doseQuantity: 1,
			doseUnit: 'tablet',
			courseId: 'c',
			scheduleId: 's',
			medicineId: 'm',
			personId: 'p',
			scheduledDate: '2026-09-04',
			scheduledTime: '08:00',
		})
		expect(withPerson.body).toContain('Анна')

		const self = buildReminderContent({
			medicineName: 'Лозартан 50 мг',
			personName: 'Я',
			isDefaultPerson: true,
			doseQuantity: 1,
			doseUnit: 'tablet',
			courseId: 'c',
			scheduleId: 's',
			medicineId: 'm',
			personId: 'p',
			scheduledDate: '2026-09-04',
			scheduledTime: '08:00',
		})
		expect(self.body.startsWith('Я')).toBe(false)
	})
})
