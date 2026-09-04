import {
	applyMigrations,
	getLatestSchemaVersion,
	getSchemaVersion,
} from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import {
	countCabinets,
	listCabinetsByHousehold,
} from '@/db/repositories/medicineCabinets'
import { countHouseholds } from '@/db/repositories/households'
import { countPeople } from '@/db/repositories/people'
import { defaultSeed } from '@/constants/copy'
import { createTestSqlExecutor } from './helpers/testDatabase'

describe('database foundation', () => {
	it('applies migrations to the latest schema version', async () => {
		const db = createTestSqlExecutor()
		const version = await applyMigrations(db)
		expect(version).toBe(getLatestSchemaVersion())
		expect(await getSchemaVersion(db)).toBe(1)
	})

	it('seeds default household, person and cabinet once', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		const first = await ensureFirstRunDefaults(db)
		expect(first.seeded).toBe(true)
		expect(first.person.name).toBe(defaultSeed.personName)
		expect(first.cabinet.name).toBe(defaultSeed.cabinetName)
		expect(await countHouseholds(db)).toBe(1)
		expect(await countPeople(db)).toBe(1)
		expect(await countCabinets(db)).toBe(1)

		const second = await ensureFirstRunDefaults(db)
		expect(second.seeded).toBe(false)
		expect(second.household.id).toBe(first.household.id)
		expect(second.person.id).toBe(first.person.id)
		expect(second.cabinet.id).toBe(first.cabinet.id)
		expect(await countHouseholds(db)).toBe(1)
		expect(await countPeople(db)).toBe(1)
		expect(await countCabinets(db)).toBe(1)
	})

	it('lists seeded cabinet through repository', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)

		const cabinets = await listCabinetsByHousehold(db, seed.household.id)
		expect(cabinets).toHaveLength(1)
		expect(cabinets[0]?.name).toBe('Дом')
	})
})
