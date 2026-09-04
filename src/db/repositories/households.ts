import { SqlExecutor } from '../sqlExecutor'
import { Household } from '../types'

interface HouseholdRow {
	id: string
	name: string
	created_at: string
	updated_at: string
}

function mapRow (row: HouseholdRow): Household {
	return {
		id: row.id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export async function listHouseholds (db: SqlExecutor): Promise<Household[]> {
	const rows = await db.getAllAsync<HouseholdRow>(
		`SELECT id, name, created_at, updated_at
		 FROM households
		 ORDER BY created_at ASC`,
	)
	return rows.map(mapRow)
}

export async function getHouseholdById (
	db: SqlExecutor,
	id: string,
): Promise<Household | null> {
	const row = await db.getFirstAsync<HouseholdRow>(
		`SELECT id, name, created_at, updated_at FROM households WHERE id = ?`,
		[id],
	)
	return row ? mapRow(row) : null
}

export async function countHouseholds (db: SqlExecutor): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM households`,
	)
	return row?.count ?? 0
}
