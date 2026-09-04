import { SqlExecutor } from '../sqlExecutor'
import { MedicineCabinet } from '../types'

interface CabinetRow {
	id: string
	household_id: string
	name: string
	created_at: string
	updated_at: string
}

function mapRow (row: CabinetRow): MedicineCabinet {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export async function listCabinetsByHousehold (
	db: SqlExecutor,
	householdId: string,
): Promise<MedicineCabinet[]> {
	const rows = await db.getAllAsync<CabinetRow>(
		`SELECT id, household_id, name, created_at, updated_at
		 FROM medicine_cabinets
		 WHERE household_id = ?
		 ORDER BY created_at ASC`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function countCabinets (db: SqlExecutor): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM medicine_cabinets`,
	)
	return row?.count ?? 0
}
