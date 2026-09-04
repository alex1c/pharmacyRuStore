import { defaultSeed } from '@/constants/copy'
import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from './sqlExecutor'
import {
	Household,
	MedicineCabinet,
	Person,
} from './types'

const SEED_FLAG_KEY = 'first_run_seeded'

export interface FirstRunSeedResult {
	seeded: boolean
	household: Household
	person: Person
	cabinet: MedicineCabinet
}

/**
 * Creates default household / profile / cabinet exactly once.
 * Safe to call on every launch — does not duplicate rows.
 */
export async function ensureFirstRunDefaults (
	db: SqlExecutor,
): Promise<FirstRunSeedResult> {
	const existingFlag = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_meta WHERE key = ?`,
		[SEED_FLAG_KEY],
	)

	if (existingFlag?.value === '1') {
		const household = await requireOneHousehold(db)
		const person = await requireDefaultPerson(db, household.id)
		const cabinet = await requireDefaultCabinet(db, household.id)
		return { seeded: false, household, person, cabinet }
	}

	const timestamp = nowIso()
	const household: Household = {
		id: createId('hh'),
		name: defaultSeed.householdName,
		createdAt: timestamp,
		updatedAt: timestamp,
	}
	const person: Person = {
		id: createId('person'),
		householdId: household.id,
		name: defaultSeed.personName,
		createdAt: timestamp,
		updatedAt: timestamp,
	}
	const cabinet: MedicineCabinet = {
		id: createId('cab'),
		householdId: household.id,
		name: defaultSeed.cabinetName,
		createdAt: timestamp,
		updatedAt: timestamp,
	}

	const writeSeed = async () => {
		await db.runAsync(
			`INSERT INTO households (id, name, created_at, updated_at)
			 VALUES (?, ?, ?, ?)`,
			[household.id, household.name, household.createdAt, household.updatedAt],
		)
		await db.runAsync(
			`INSERT INTO people (id, household_id, name, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				person.id,
				person.householdId,
				person.name,
				person.createdAt,
				person.updatedAt,
			],
		)
		await db.runAsync(
			`INSERT INTO medicine_cabinets (id, household_id, name, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				cabinet.id,
				cabinet.householdId,
				cabinet.name,
				cabinet.createdAt,
				cabinet.updatedAt,
			],
		)
		await db.runAsync(
			`INSERT INTO app_meta (key, value) VALUES (?, ?)`,
			[SEED_FLAG_KEY, '1'],
		)
	}

	if (db.withTransactionAsync) {
		await db.withTransactionAsync(writeSeed)
	} else {
		await writeSeed()
	}

	return { seeded: true, household, person, cabinet }
}

async function requireOneHousehold (db: SqlExecutor): Promise<Household> {
	const row = await db.getFirstAsync<{
		id: string
		name: string
		created_at: string
		updated_at: string
	}>(`SELECT id, name, created_at, updated_at FROM households LIMIT 1`)

	if (!row) {
		throw new Error('Expected default household after first-run seed')
	}

	return mapHousehold(row)
}

async function requireDefaultPerson (
	db: SqlExecutor,
	householdId: string,
): Promise<Person> {
	const row = await db.getFirstAsync<{
		id: string
		household_id: string
		name: string
		created_at: string
		updated_at: string
	}>(
		`SELECT id, household_id, name, created_at, updated_at
		 FROM people WHERE household_id = ? ORDER BY created_at ASC LIMIT 1`,
		[householdId],
	)

	if (!row) {
		throw new Error('Expected default person after first-run seed')
	}

	return mapPerson(row)
}

async function requireDefaultCabinet (
	db: SqlExecutor,
	householdId: string,
): Promise<MedicineCabinet> {
	const row = await db.getFirstAsync<{
		id: string
		household_id: string
		name: string
		created_at: string
		updated_at: string
	}>(
		`SELECT id, household_id, name, created_at, updated_at
		 FROM medicine_cabinets WHERE household_id = ? ORDER BY created_at ASC LIMIT 1`,
		[householdId],
	)

	if (!row) {
		throw new Error('Expected default medicine cabinet after first-run seed')
	}

	return mapCabinet(row)
}

function mapHousehold (row: {
	id: string
	name: string
	created_at: string
	updated_at: string
}): Household {
	return {
		id: row.id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapPerson (row: {
	id: string
	household_id: string
	name: string
	created_at: string
	updated_at: string
}): Person {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapCabinet (row: {
	id: string
	household_id: string
	name: string
	created_at: string
	updated_at: string
}): MedicineCabinet {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}
