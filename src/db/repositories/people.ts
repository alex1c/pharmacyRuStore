import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import { Person } from '../types'

interface PersonRow {
	id: string
	household_id: string
	name: string
	note: string | null
	created_at: string
	updated_at: string
	archived_at: string | null
}

function mapRow (row: PersonRow): Person {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		note: row.note ?? null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at ?? null,
	}
}

const SELECT_COLS = `
	id, household_id, name, note, created_at, updated_at, archived_at
`

export async function listPeopleByHousehold (
	db: SqlExecutor,
	householdId: string,
	options?: { includeArchived?: boolean },
): Promise<Person[]> {
	const includeArchived = options?.includeArchived ?? false
	const rows = await db.getAllAsync<PersonRow>(
		includeArchived
			? `SELECT ${SELECT_COLS}
				 FROM people
				 WHERE household_id = ?
				 ORDER BY created_at ASC`
			: `SELECT ${SELECT_COLS}
				 FROM people
				 WHERE household_id = ? AND archived_at IS NULL
				 ORDER BY created_at ASC`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function getPersonById (
	db: SqlExecutor,
	id: string,
): Promise<Person | null> {
	const row = await db.getFirstAsync<PersonRow>(
		`SELECT ${SELECT_COLS} FROM people WHERE id = ?`,
		[id],
	)
	return row ? mapRow(row) : null
}

export async function countPeople (db: SqlExecutor): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM people WHERE archived_at IS NULL`,
	)
	return row?.count ?? 0
}

export async function createPerson (
	db: SqlExecutor,
	input: { householdId: string; name: string; note?: string | null },
): Promise<Person> {
	const name = input.name.trim()
	if (!name) {
		throw new Error('INVALID_NAME')
	}
	const timestamp = nowIso()
	const person: Person = {
		id: createId('person'),
		householdId: input.householdId,
		name,
		note: emptyToNull(input.note),
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
	}
	await db.runAsync(
		`INSERT INTO people
			(id, household_id, name, note, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, ?, NULL)`,
		[
			person.id,
			person.householdId,
			person.name,
			person.note,
			person.createdAt,
			person.updatedAt,
		],
	)
	return person
}

export async function updatePerson (
	db: SqlExecutor,
	id: string,
	input: { name: string; note?: string | null },
): Promise<Person> {
	const existing = await getPersonById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Person not found')
	}
	const name = input.name.trim()
	if (!name) {
		throw new Error('INVALID_NAME')
	}
	const updatedAt = nowIso()
	await db.runAsync(
		`UPDATE people
		 SET name = ?, note = ?, updated_at = ?
		 WHERE id = ?`,
		[name, emptyToNull(input.note), updatedAt, id],
	)
	const updated = await getPersonById(db, id)
	if (!updated) {
		throw new Error('Person not found')
	}
	return updated
}

/**
 * Archives a person. Refuses default seed person.
 * Caller must finish active courses first (or we finish them here).
 */
export async function archivePerson (
	db: SqlExecutor,
	id: string,
	options: { defaultPersonId: string; finishActiveCourses?: boolean },
): Promise<void> {
	const existing = await getPersonById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Person not found')
	}
	if (existing.id === options.defaultPersonId) {
		const error = new Error('DEFAULT_PERSON')
		error.name = 'DEFAULT_PERSON'
		throw error
	}

	const timestamp = nowIso()
	const run = async () => {
		if (options.finishActiveCourses) {
			await db.runAsync(
				`UPDATE medication_courses
				 SET end_date = COALESCE(end_date, date('now', 'localtime')),
					 archived_at = ?, updated_at = ?
				 WHERE person_id = ? AND archived_at IS NULL`,
				[timestamp, timestamp, id],
			)
		} else {
			const active = await db.getFirstAsync<{ count: number }>(
				`SELECT COUNT(*) AS count FROM medication_courses
				 WHERE person_id = ? AND archived_at IS NULL`,
				[id],
			)
			if ((active?.count ?? 0) > 0) {
				const error = new Error('HAS_ACTIVE_COURSES')
				error.name = 'HAS_ACTIVE_COURSES'
				throw error
			}
		}

		await db.runAsync(
			`UPDATE people
			 SET archived_at = ?, updated_at = ?
			 WHERE id = ?`,
			[timestamp, timestamp, id],
		)
	}

	if (db.withTransactionAsync) {
		await db.withTransactionAsync(run)
	} else {
		await run()
	}
}

export async function countActiveCoursesForPeople (
	db: SqlExecutor,
	householdId: string,
): Promise<Map<string, number>> {
	const rows = await db.getAllAsync<{ person_id: string; count: number }>(
		`SELECT person_id, COUNT(*) AS count
		 FROM medication_courses
		 WHERE household_id = ? AND archived_at IS NULL
		 GROUP BY person_id`,
		[householdId],
	)
	const map = new Map<string, number>()
	for (const row of rows) {
		map.set(row.person_id, row.count)
	}
	return map
}

function emptyToNull (value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null
	}
	const trimmed = value.trim()
	return trimmed.length === 0 ? null : trimmed
}
