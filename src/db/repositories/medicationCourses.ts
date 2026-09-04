import { nowIso, isDateOnly } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import {
	MedicationCourse,
	MedicineUnit,
} from '../types'

interface CourseRow {
	id: string
	household_id: string
	person_id: string
	medicine_id: string
	dose_quantity: number
	dose_unit: string
	start_date: string
	end_date: string | null
	instructions: string | null
	is_prn: number
	created_at: string
	updated_at: string
	archived_at: string | null
}

function mapRow (row: CourseRow): MedicationCourse {
	return {
		id: row.id,
		householdId: row.household_id,
		personId: row.person_id,
		medicineId: row.medicine_id,
		doseQuantity: row.dose_quantity,
		doseUnit: row.dose_unit as MedicineUnit,
		startDate: row.start_date,
		endDate: row.end_date,
		instructions: row.instructions,
		isPrn: row.is_prn === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at,
	}
}

const SELECT_COLS = `
	id, household_id, person_id, medicine_id, dose_quantity, dose_unit,
	start_date, end_date, instructions, is_prn, created_at, updated_at, archived_at
`

export interface CourseInput {
	householdId: string
	personId: string
	medicineId: string
	doseQuantity: number
	doseUnit: MedicineUnit
	startDate: string
	endDate?: string | null
	instructions?: string | null
	isPrn: boolean
}

/**
 * Creates a medication course (assignment of a medicine to a person).
 */
export async function createCourse (
	db: SqlExecutor,
	input: CourseInput,
): Promise<MedicationCourse> {
	await assertCourseInput(db, input)

	const timestamp = nowIso()
	const course: MedicationCourse = {
		id: createId('course'),
		householdId: input.householdId,
		personId: input.personId,
		medicineId: input.medicineId,
		doseQuantity: input.doseQuantity,
		doseUnit: input.doseUnit,
		startDate: input.startDate,
		endDate: input.endDate ?? null,
		instructions: emptyToNull(input.instructions),
		isPrn: input.isPrn,
		createdAt: timestamp,
		updatedAt: timestamp,
		archivedAt: null,
	}

	await db.runAsync(
		`INSERT INTO medication_courses
			(id, household_id, person_id, medicine_id, dose_quantity, dose_unit,
			 start_date, end_date, instructions, is_prn, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			course.id,
			course.householdId,
			course.personId,
			course.medicineId,
			course.doseQuantity,
			course.doseUnit,
			course.startDate,
			course.endDate,
			course.instructions,
			course.isPrn ? 1 : 0,
			course.createdAt,
			course.updatedAt,
		],
	)

	return course
}

export async function getCourseById (
	db: SqlExecutor,
	id: string,
): Promise<MedicationCourse | null> {
	const row = await db.getFirstAsync<CourseRow>(
		`SELECT ${SELECT_COLS} FROM medication_courses WHERE id = ?`,
		[id],
	)
	return row ? mapRow(row) : null
}

export async function listActiveCourses (
	db: SqlExecutor,
	householdId: string,
): Promise<MedicationCourse[]> {
	const rows = await db.getAllAsync<CourseRow>(
		`SELECT ${SELECT_COLS}
		 FROM medication_courses
		 WHERE household_id = ? AND archived_at IS NULL
		 ORDER BY created_at DESC`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function listActiveCoursesForMedicine (
	db: SqlExecutor,
	medicineId: string,
): Promise<MedicationCourse[]> {
	const rows = await db.getAllAsync<CourseRow>(
		`SELECT ${SELECT_COLS}
		 FROM medication_courses
		 WHERE medicine_id = ? AND archived_at IS NULL
		 ORDER BY created_at DESC`,
		[medicineId],
	)
	return rows.map(mapRow)
}

export async function listActivePrnCourses (
	db: SqlExecutor,
	householdId: string,
): Promise<MedicationCourse[]> {
	const rows = await db.getAllAsync<CourseRow>(
		`SELECT ${SELECT_COLS}
		 FROM medication_courses
		 WHERE household_id = ?
			 AND archived_at IS NULL
			 AND is_prn = 1
		 ORDER BY created_at DESC`,
		[householdId],
	)
	return rows.map(mapRow)
}

export async function updateCourse (
	db: SqlExecutor,
	id: string,
	input: Omit<CourseInput, 'householdId' | 'medicineId'>,
): Promise<MedicationCourse> {
	const existing = await getCourseById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Course not found')
	}

	const nextInput: CourseInput = {
		householdId: existing.householdId,
		medicineId: existing.medicineId,
		personId: input.personId,
		doseQuantity: input.doseQuantity,
		doseUnit: input.doseUnit,
		startDate: input.startDate,
		endDate: input.endDate,
		instructions: input.instructions,
		isPrn: input.isPrn,
	}
	await assertCourseInput(db, nextInput)

	const updatedAt = nowIso()
	await db.runAsync(
		`UPDATE medication_courses
		 SET person_id = ?, dose_quantity = ?, dose_unit = ?,
			 start_date = ?, end_date = ?, instructions = ?, is_prn = ?, updated_at = ?
		 WHERE id = ?`,
		[
			nextInput.personId,
			nextInput.doseQuantity,
			nextInput.doseUnit,
			nextInput.startDate,
			nextInput.endDate ?? null,
			emptyToNull(nextInput.instructions),
			nextInput.isPrn ? 1 : 0,
			updatedAt,
			id,
		],
	)

	const updated = await getCourseById(db, id)
	if (!updated) {
		throw new Error('Course not found')
	}
	return updated
}

/**
 * Ends a course so future occurrences stop; history remains.
 * Sets endDate to today (if later than today or null) and archives.
 */
export async function finishCourse (
	db: SqlExecutor,
	id: string,
	endDate: string,
): Promise<void> {
	const existing = await getCourseById(db, id)
	if (!existing || existing.archivedAt) {
		throw new Error('Course not found')
	}
	if (!isDateOnly(endDate)) {
		throw new Error('INVALID_END_DATE')
	}

	const timestamp = nowIso()
	const nextEnd =
		existing.endDate && existing.endDate < endDate
			? existing.endDate
			: endDate

	await db.runAsync(
		`UPDATE medication_courses
		 SET end_date = ?, archived_at = ?, updated_at = ?
		 WHERE id = ?`,
		[nextEnd, timestamp, timestamp, id],
	)
}

async function assertCourseInput (
	db: SqlExecutor,
	input: CourseInput,
): Promise<void> {
	if (!Number.isFinite(input.doseQuantity) || input.doseQuantity <= 0) {
		throw new Error('INVALID_DOSE')
	}
	if (!isDateOnly(input.startDate)) {
		throw new Error('INVALID_START_DATE')
	}
	if (input.endDate && !isDateOnly(input.endDate)) {
		throw new Error('INVALID_END_DATE')
	}
	if (input.endDate && input.endDate < input.startDate) {
		throw new Error('INVALID_DATE_RANGE')
	}

	const person = await db.getFirstAsync<{ id: string }>(
		`SELECT id FROM people WHERE id = ? AND household_id = ?`,
		[input.personId, input.householdId],
	)
	if (!person) {
		throw new Error('Person not found')
	}

	const medicine = await db.getFirstAsync<{
		id: string
		archived_at: string | null
	}>(
		`SELECT id, archived_at FROM medicines
		 WHERE id = ? AND household_id = ?`,
		[input.medicineId, input.householdId],
	)
	if (!medicine || medicine.archived_at) {
		throw new Error('Medicine not found')
	}

	// Dose unit must match active inventory unit when packs exist.
	const unitRow = await db.getFirstAsync<{ unit: string }>(
		`SELECT unit FROM medicine_batches
		 WHERE medicine_id = ? AND archived_at IS NULL
		 ORDER BY created_at ASC
		 LIMIT 1`,
		[input.medicineId],
	)
	if (unitRow && unitRow.unit !== input.doseUnit) {
		const error = new Error('INCOMPATIBLE_UNIT')
		error.name = 'INCOMPATIBLE_UNIT'
		throw error
	}
}

function emptyToNull (value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null
	}
	const trimmed = value.trim()
	return trimmed.length === 0 ? null : trimmed
}
