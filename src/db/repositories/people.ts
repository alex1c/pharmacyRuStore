import { SqlExecutor } from '../sqlExecutor'
import { Person } from '../types'

interface PersonRow {
	id: string
	household_id: string
	name: string
	created_at: string
	updated_at: string
}

function mapRow (row: PersonRow): Person {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export async function listPeopleByHousehold (
	db: SqlExecutor,
	householdId: string,
): Promise<Person[]> {
	const rows = await db.getAllAsync<PersonRow>(
		`SELECT id, household_id, name, created_at, updated_at
		 FROM people
		 WHERE household_id = ?
		 ORDER BY created_at ASC`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function countPeople (db: SqlExecutor): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM people`,
	)
	return row?.count ?? 0
}
