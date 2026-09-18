/**
 * End-to-end critical user flow covering the OPPO failure cluster.
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import { createCabinet } from '@/db/repositories/medicineCabinets'
import { createMedicineWithFirstBatch } from '@/db/repositories/inventory'
import { listMedicineSummaries } from '@/db/repositories/medicines'
import { createPerson, listPeopleByHousehold } from '@/db/repositories/people'
import {
	getAppSettings,
	setDefaultLowStockThreshold,
	setExpiryWarningDays,
} from '@/db/repositories/settings'
import {
	listActiveShoppingItems,
	listCompletedShoppingItems,
} from '@/db/repositories/shoppingItems'
import {
	addCustomShoppingItem,
	markPurchasedSimple,
} from '@/domain/purchaseService'
import { createTestSqlExecutor } from './helpers/testDatabase'

describe('critical user flows', () => {
	it('creates cabinet, iodine, shopping, stock settings and family member', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)

		const cabinet = await createCabinet(db, {
			householdId: seed.household.id,
			name: 'Дача',
		})
		expect(cabinet.name).toBe('Дача')

		const { medicine } = await createMedicineWithFirstBatch(
			db,
			{
				householdId: seed.household.id,
				name: 'Йод',
				form: 'solution',
			},
			{
				cabinetId: cabinet.id,
				quantity: 1,
				unit: 'pcs',
			},
		)

		const summaries = await listMedicineSummaries(db, {
			householdId: seed.household.id,
		})
		expect(summaries.some((item) => item.medicine.id === medicine.id)).toBe(
			true,
		)
		expect(summaries.some((item) => item.medicine.name === 'Йод')).toBe(true)

		await addCustomShoppingItem(db, {
			householdId: seed.household.id,
			customName: 'Бинты',
		})
		const active = await listActiveShoppingItems(db, seed.household.id)
		expect(active).toHaveLength(1)
		expect(active[0]?.customName).toBe('Бинты')

		await markPurchasedSimple(db, active[0]!.id)
		const stillActive = await listActiveShoppingItems(db, seed.household.id)
		expect(stillActive).toHaveLength(0)
		const completed = await listCompletedShoppingItems(
			db,
			seed.household.id,
			30,
		)
		expect(completed.some((item) => item.customName === 'Бинты')).toBe(true)

		await db.withTransactionAsync!(async (tx) => {
			await setExpiryWarningDays(tx, 14)
			await setDefaultLowStockThreshold(tx, 3)
		})
		const settings = await getAppSettings(db)
		expect(settings.expiryWarningDays).toBe(14)
		expect(settings.defaultLowStockThreshold).toBe(3)

		const person = await createPerson(db, {
			householdId: seed.household.id,
			name: 'Мария',
		})
		const people = await listPeopleByHousehold(db, seed.household.id)
		expect(people.some((item) => item.id === person.id)).toBe(true)
	})
})
