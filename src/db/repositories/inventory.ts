import { SqlExecutor } from '../sqlExecutor'
import { Medicine, MedicineForm } from '../types'
import { BatchInput, createBatch } from './medicineBatches'
import { createMedicine } from './medicines'

/**
 * Creates a medicine and its first pack atomically.
 * Avoids half-created medicines when the pack insert fails.
 */
export async function createMedicineWithFirstBatch (
	db: SqlExecutor,
	medicineInput: {
		householdId: string
		name: string
		form?: MedicineForm
		strengthText?: string | null
		notes?: string | null
		photoUri?: string | null
	},
	batchInput: Omit<BatchInput, 'medicineId'>,
): Promise<{ medicine: Medicine; batchId: string }> {
	const run = async () => {
		const medicine = await createMedicine(db, medicineInput)
		const batch = await createBatch(db, {
			...batchInput,
			medicineId: medicine.id,
		})
		return { medicine, batchId: batch.id }
	}

	if (db.withTransactionAsync) {
		return db.withTransactionAsync(run)
	}
	return run()
}
