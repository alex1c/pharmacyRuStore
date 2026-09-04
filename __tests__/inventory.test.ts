import { applyMigrations, getLatestSchemaVersion } from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import { createCabinet } from '@/db/repositories/medicineCabinets'
import {
	archiveBatch,
	createBatch,
	updateBatch,
} from '@/db/repositories/medicineBatches'
import {
	archiveMedicine,
	createMedicine,
	getMedicineSummary,
	listMedicineSummaries,
	updateMedicine,
} from '@/db/repositories/medicines'
import { createMedicineWithFirstBatch } from '@/db/repositories/inventory'
import {
	assertLocationBelongsToCabinet,
	createLocation,
} from '@/db/repositories/storageLocations'
import { createTestSqlExecutor } from './helpers/testDatabase'

describe('Phase 1 inventory', () => {
	it('applies migration v2 and stays idempotent on re-init', async () => {
		const db = createTestSqlExecutor()
		const version = await applyMigrations(db)
		expect(version).toBe(5)
		expect(getLatestSchemaVersion()).toBe(5)
		await ensureFirstRunDefaults(db)
		const again = await applyMigrations(db)
		expect(again).toBe(5)
		const seed = await ensureFirstRunDefaults(db)
		expect(seed.seeded).toBe(false)
	})

	it('creates, updates and archives medicines', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)

		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Нурофен',
			form: 'tablet',
			strengthText: '200 мг',
		})
		expect(medicine.name).toBe('Нурофен')

		const updated = await updateMedicine(db, medicine.id, {
			name: 'Нурофен',
			form: 'tablet',
			strengthText: '400 мг',
			notes: 'жаропонижающее',
		})
		expect(updated.strengthText).toBe('400 мг')
		expect(updated.notes).toBe('жаропонижающее')

		await archiveMedicine(db, medicine.id)
		const summary = await getMedicineSummary(db, medicine.id)
		expect(summary).toBeNull()
	})

	it('supports multiple batches with quantity and nearest expiry aggregation', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)

		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Нурофен',
			form: 'tablet',
			strengthText: '200 мг',
		})

		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 6,
			unit: 'tablet',
			expiryDate: '2026-11',
		})
		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 20,
			unit: 'tablet',
			expiryDate: '2028-05',
		})

		let summary = await getMedicineSummary(db, medicine.id)
		expect(summary?.totalQuantity).toBe(26)
		expect(summary?.nearestExpiry).toBe('2026-11')
		expect(summary?.activeBatchCount).toBe(2)

		const batches = await listMedicineSummaries(db, {
			householdId: seed.household.id,
			query: 'нур',
		})
		expect(batches).toHaveLength(1)
		expect(batches[0]?.medicine.name).toBe('Нурофен')
	})

	it('updates quantity and excludes archived batches from aggregation', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)

		const created = await createMedicineWithFirstBatch(
			db,
			{
				householdId: seed.household.id,
				name: 'Нурофен',
				form: 'tablet',
				strengthText: '200 мг',
			},
			{
				cabinetId: seed.cabinet.id,
				quantity: 6,
				unit: 'tablet',
				expiryDate: '2026-11',
			},
		)

		const second = await createBatch(db, {
			medicineId: created.medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 20,
			unit: 'tablet',
			expiryDate: '2028-05',
		})

		await updateBatch(db, created.batchId, {
			cabinetId: seed.cabinet.id,
			quantity: 5,
			unit: 'tablet',
			expiryDate: '2026-11',
		})

		let summary = await getMedicineSummary(db, created.medicine.id)
		expect(summary?.totalQuantity).toBe(25)

		await archiveBatch(db, second.id)
		summary = await getMedicineSummary(db, created.medicine.id)
		expect(summary?.totalQuantity).toBe(5)
		expect(summary?.nearestExpiry).toBe('2026-11')
		expect(summary?.activeBatchCount).toBe(1)
	})

	it('rejects location from another cabinet', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)

		const car = await createCabinet(db, {
			householdId: seed.household.id,
			name: 'Автомобиль',
		})
		const glovebox = await createLocation(db, {
			cabinetId: car.id,
			name: 'Бардачок',
		})

		await expect(
			assertLocationBelongsToCabinet(db, glovebox.id, seed.cabinet.id),
		).rejects.toMatchObject({ name: 'LOCATION_CABINET_MISMATCH' })

		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Нурофен',
			form: 'tablet',
		})

		await expect(
			createBatch(db, {
				medicineId: medicine.id,
				cabinetId: seed.cabinet.id,
				storageLocationId: glovebox.id,
				quantity: 10,
				unit: 'tablet',
			}),
		).rejects.toMatchObject({ name: 'LOCATION_CABINET_MISMATCH' })
	})

	it('stores year-month and exact expiry without mutation', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Тест',
			form: 'tablet',
		})

		const monthBatch = await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 1,
			unit: 'tablet',
			expiryDate: '2028-05',
		})
		const dayBatch = await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 1,
			unit: 'tablet',
			expiryDate: '2028-05-15',
		})

		expect(monthBatch.expiryDate).toBe('2028-05')
		expect(dayBatch.expiryDate).toBe('2028-05-15')
	})
})
