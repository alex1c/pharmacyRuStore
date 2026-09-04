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
import { migrations } from '@/db/migrations'

describe('database foundation', () => {
	it('applies migrations to the latest schema version', async () => {
		const db = createTestSqlExecutor()
		const version = await applyMigrations(db)
		expect(version).toBe(getLatestSchemaVersion())
		expect(await getSchemaVersion(db)).toBe(5)
	})

	it('upgrades a populated v3 database to v4 without data loss and is repeatable', async () => {
		const db = createTestSqlExecutor()
		for (const migration of migrations.slice(0, 3)) {
			await db.execAsync(migration.sql)
			await db.runAsync(
				'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
				[migration.version, '2026-09-04T00:00:00.000Z'],
			)
		}
		await db.runAsync(
			`INSERT INTO households (id, name, created_at, updated_at)
			 VALUES ('legacy-hh', 'Legacy', 'a', 'a')`,
		)

		expect(await applyMigrations(db)).toBe(5)
		expect(await applyMigrations(db)).toBe(5)
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM households WHERE id = 'legacy-hh'`,
			),
		).toEqual({ name: 'Legacy' })
		for (const table of [
			'medication_courses',
			'medication_schedules',
			'intake_records',
			'intake_inventory_movements',
		]) {
			expect(
				await db.getFirstAsync(
					`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
					[table],
				),
			).not.toBeNull()
		}
		const uniqueIndex = await db.getFirstAsync<{ sql: string }>(
			`SELECT sql FROM sqlite_master
			 WHERE type = 'index' AND name = 'idx_intake_occurrence_unique'`,
		)
		expect(uniqueIndex?.sql).toContain('CREATE UNIQUE INDEX')
		expect(uniqueIndex?.sql).toContain("status IN ('taken', 'skipped', 'snoozed')")
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
