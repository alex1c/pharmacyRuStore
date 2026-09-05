/**
 * Local medicine barcode identifiers for offline scan matching.
 */

import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { normalizeScannedCode } from '@/utils/normalizeScannedCode'
import { SqlExecutor } from '../sqlExecutor'
import { MedicineCode, MedicineCodeType } from '../types'

interface CodeRow {
	id: string
	medicine_id: string
	code_type: string
	code_value: string
	created_at: string
}

function mapRow (row: CodeRow): MedicineCode {
	return {
		id: row.id,
		medicineId: row.medicine_id,
		codeType: row.code_type as MedicineCodeType,
		codeValue: row.code_value,
		createdAt: row.created_at,
	}
}

export async function findMedicineCodeByValue (
	db: SqlExecutor,
	codeValue: string,
): Promise<MedicineCode | null> {
	const normalized = normalizeScannedCode(codeValue)
	if (!normalized) {
		return null
	}
	const row = await db.getFirstAsync<CodeRow>(
		`SELECT id, medicine_id, code_type, code_value, created_at
		 FROM medicine_codes
		 WHERE code_value = ?`,
		[normalized],
	)
	return row ? mapRow(row) : null
}

export async function listCodesForMedicine (
	db: SqlExecutor,
	medicineId: string,
): Promise<MedicineCode[]> {
	const rows = await db.getAllAsync<CodeRow>(
		`SELECT id, medicine_id, code_type, code_value, created_at
		 FROM medicine_codes
		 WHERE medicine_id = ?
		 ORDER BY created_at ASC`,
		[medicineId],
	)
	return rows.map(mapRow)
}

/**
 * Attaches a code to a medicine. Idempotent when already linked to the same medicine.
 * Throws CODE_CONFLICT when the code is already linked to a different medicine.
 */
export async function attachMedicineCode (
	db: SqlExecutor,
	input: {
		medicineId: string
		codeType: MedicineCodeType
		codeValue: string
	},
): Promise<{ code: MedicineCode; created: boolean }> {
	const normalized = normalizeScannedCode(input.codeValue)
	if (!normalized) {
		const error = new Error('INVALID_CODE')
		error.name = 'INVALID_CODE'
		throw error
	}

	const existing = await findMedicineCodeByValue(db, normalized)
	if (existing) {
		if (existing.medicineId !== input.medicineId) {
			const error = new Error('CODE_CONFLICT')
			error.name = 'CODE_CONFLICT'
			throw error
		}
		return { code: existing, created: false }
	}

	const code: MedicineCode = {
		id: createId('mcode'),
		medicineId: input.medicineId,
		codeType: input.codeType,
		codeValue: normalized,
		createdAt: nowIso(),
	}

	await db.runAsync(
		`INSERT INTO medicine_codes
			(id, medicine_id, code_type, code_value, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		[code.id, code.medicineId, code.codeType, code.codeValue, code.createdAt],
	)

	return { code, created: true }
}
