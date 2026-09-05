/**
 * Recent medicines ordered by latest pack createdAt — no extra table.
 */

import { SqlExecutor } from '@/db/sqlExecutor'
import { Medicine } from '@/db/types'
import { getMedicineById } from '@/db/repositories/medicines'

/**
 * Returns medicines that recently received a new (active or archived) pack.
 */
export async function listRecentMedicinesByBatch (
	db: SqlExecutor,
	householdId: string,
	limit = 8,
): Promise<Medicine[]> {
	const rows = await db.getAllAsync<{ medicine_id: string }>(
		`SELECT b.medicine_id AS medicine_id
		 FROM medicine_batches b
		 INNER JOIN medicines m ON m.id = b.medicine_id
		 WHERE m.household_id = ?
			 AND m.archived_at IS NULL
		 GROUP BY b.medicine_id
		 ORDER BY MAX(b.created_at) DESC
		 LIMIT ?`,
		[householdId, limit],
	)

	const medicines: Medicine[] = []
	for (const row of rows) {
		const medicine = await getMedicineById(db, row.medicine_id)
		if (medicine && !medicine.archivedAt) {
			medicines.push(medicine)
		}
	}
	return medicines
}
