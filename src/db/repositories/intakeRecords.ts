import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'
import { SqlExecutor } from '../sqlExecutor'
import {
	IntakeInventoryMovement,
	IntakeRecord,
	IntakeStatus,
	MedicineUnit,
} from '../types'

interface IntakeRow {
	id: string
	course_id: string
	schedule_id: string | null
	medicine_id: string
	person_id: string
	scheduled_date: string | null
	scheduled_time: string | null
	status: string
	actual_taken_at: string | null
	skipped_at: string | null
	snoozed_until: string | null
	dose_quantity: number
	dose_unit: string
	note: string | null
	inventory_shortfall: number
	created_at: string
	updated_at: string
	cancelled_at: string | null
}

interface MovementRow {
	id: string
	intake_record_id: string
	batch_id: string
	quantity: number
	created_at: string
}

function mapIntake (row: IntakeRow): IntakeRecord {
	return {
		id: row.id,
		courseId: row.course_id,
		scheduleId: row.schedule_id,
		medicineId: row.medicine_id,
		personId: row.person_id,
		scheduledDate: row.scheduled_date,
		scheduledTime: row.scheduled_time,
		status: row.status as IntakeStatus,
		actualTakenAt: row.actual_taken_at,
		skippedAt: row.skipped_at,
		snoozedUntil: row.snoozed_until,
		doseQuantity: row.dose_quantity,
		doseUnit: row.dose_unit as MedicineUnit,
		note: row.note,
		inventoryShortfall: row.inventory_shortfall === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		cancelledAt: row.cancelled_at,
	}
}

function mapMovement (row: MovementRow): IntakeInventoryMovement {
	return {
		id: row.id,
		intakeRecordId: row.intake_record_id,
		batchId: row.batch_id,
		quantity: row.quantity,
		createdAt: row.created_at,
	}
}

const INTAKE_COLS = `
	id, course_id, schedule_id, medicine_id, person_id,
	scheduled_date, scheduled_time, status, actual_taken_at, skipped_at,
	snoozed_until, dose_quantity, dose_unit, note, inventory_shortfall,
	created_at, updated_at, cancelled_at
`

export interface IntakeInsertInput {
	courseId: string
	scheduleId: string | null
	medicineId: string
	personId: string
	scheduledDate: string | null
	scheduledTime: string | null
	status: IntakeStatus
	actualTakenAt?: string | null
	skippedAt?: string | null
	snoozedUntil?: string | null
	doseQuantity: number
	doseUnit: MedicineUnit
	note?: string | null
	inventoryShortfall?: boolean
}

export async function getIntakeById (
	db: SqlExecutor,
	id: string,
): Promise<IntakeRecord | null> {
	const row = await db.getFirstAsync<IntakeRow>(
		`SELECT ${INTAKE_COLS} FROM intake_records WHERE id = ?`,
		[id],
	)
	return row ? mapIntake(row) : null
}

/**
 * Active (non-cancelled) record for a scheduled occurrence identity.
 */
export async function findActiveOccurrenceIntake (
	db: SqlExecutor,
	scheduleId: string,
	scheduledDate: string,
	scheduledTime: string,
): Promise<IntakeRecord | null> {
	const row = await db.getFirstAsync<IntakeRow>(
		`SELECT ${INTAKE_COLS}
		 FROM intake_records
		 WHERE schedule_id = ?
			 AND scheduled_date = ?
			 AND scheduled_time = ?
			 AND cancelled_at IS NULL
		 ORDER BY created_at DESC
		 LIMIT 1`,
		[scheduleId, scheduledDate, scheduledTime],
	)
	return row ? mapIntake(row) : null
}

export async function insertIntakeRecord (
	db: SqlExecutor,
	input: IntakeInsertInput,
): Promise<IntakeRecord> {
	const timestamp = nowIso()
	const record: IntakeRecord = {
		id: createId('intake'),
		courseId: input.courseId,
		scheduleId: input.scheduleId,
		medicineId: input.medicineId,
		personId: input.personId,
		scheduledDate: input.scheduledDate,
		scheduledTime: input.scheduledTime,
		status: input.status,
		actualTakenAt: input.actualTakenAt ?? null,
		skippedAt: input.skippedAt ?? null,
		snoozedUntil: input.snoozedUntil ?? null,
		doseQuantity: input.doseQuantity,
		doseUnit: input.doseUnit,
		note: input.note ?? null,
		inventoryShortfall: input.inventoryShortfall ?? false,
		createdAt: timestamp,
		updatedAt: timestamp,
		cancelledAt: null,
	}

	await db.runAsync(
		`INSERT INTO intake_records
			(id, course_id, schedule_id, medicine_id, person_id,
			 scheduled_date, scheduled_time, status, actual_taken_at, skipped_at,
			 snoozed_until, dose_quantity, dose_unit, note, inventory_shortfall,
			 created_at, updated_at, cancelled_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			record.id,
			record.courseId,
			record.scheduleId,
			record.medicineId,
			record.personId,
			record.scheduledDate,
			record.scheduledTime,
			record.status,
			record.actualTakenAt,
			record.skippedAt,
			record.snoozedUntil,
			record.doseQuantity,
			record.doseUnit,
			record.note,
			record.inventoryShortfall ? 1 : 0,
			record.createdAt,
			record.updatedAt,
		],
	)

	return record
}

export async function updateIntakeRecordFields (
	db: SqlExecutor,
	id: string,
	fields: {
		status?: IntakeStatus
		actualTakenAt?: string | null
		skippedAt?: string | null
		snoozedUntil?: string | null
		note?: string | null
		inventoryShortfall?: boolean
		cancelledAt?: string | null
		doseQuantity?: number
	},
): Promise<IntakeRecord> {
	const existing = await getIntakeById(db, id)
	if (!existing) {
		throw new Error('Intake not found')
	}

	const updatedAt = nowIso()
	const next: IntakeRecord = {
		...existing,
		status: fields.status ?? existing.status,
		actualTakenAt:
			fields.actualTakenAt !== undefined
				? fields.actualTakenAt
				: existing.actualTakenAt,
		skippedAt:
			fields.skippedAt !== undefined ? fields.skippedAt : existing.skippedAt,
		snoozedUntil:
			fields.snoozedUntil !== undefined
				? fields.snoozedUntil
				: existing.snoozedUntil,
		note: fields.note !== undefined ? fields.note : existing.note,
		inventoryShortfall:
			fields.inventoryShortfall !== undefined
				? fields.inventoryShortfall
				: existing.inventoryShortfall,
		cancelledAt:
			fields.cancelledAt !== undefined
				? fields.cancelledAt
				: existing.cancelledAt,
		doseQuantity:
			fields.doseQuantity !== undefined
				? fields.doseQuantity
				: existing.doseQuantity,
		updatedAt,
	}

	await db.runAsync(
		`UPDATE intake_records
		 SET status = ?, actual_taken_at = ?, skipped_at = ?, snoozed_until = ?,
			 note = ?, inventory_shortfall = ?, cancelled_at = ?, dose_quantity = ?,
			 updated_at = ?
		 WHERE id = ?`,
		[
			next.status,
			next.actualTakenAt,
			next.skippedAt,
			next.snoozedUntil,
			next.note,
			next.inventoryShortfall ? 1 : 0,
			next.cancelledAt,
			next.doseQuantity,
			next.updatedAt,
			id,
		],
	)

	return next
}

export async function cancelIntakeRecord (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const timestamp = nowIso()
	await db.runAsync(
		`UPDATE intake_records
		 SET cancelled_at = ?, updated_at = ?
		 WHERE id = ? AND cancelled_at IS NULL`,
		[timestamp, timestamp, id],
	)
}

export async function insertInventoryMovements (
	db: SqlExecutor,
	intakeRecordId: string,
	allocations: { batchId: string; quantity: number }[],
): Promise<IntakeInventoryMovement[]> {
	const timestamp = nowIso()
	const movements: IntakeInventoryMovement[] = []

	for (const allocation of allocations) {
		if (allocation.quantity <= 0) {
			continue
		}
		const movement: IntakeInventoryMovement = {
			id: createId('imov'),
			intakeRecordId,
			batchId: allocation.batchId,
			quantity: allocation.quantity,
			createdAt: timestamp,
		}
		await db.runAsync(
			`INSERT INTO intake_inventory_movements
				(id, intake_record_id, batch_id, quantity, created_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				movement.id,
				movement.intakeRecordId,
				movement.batchId,
				movement.quantity,
				movement.createdAt,
			],
		)
		movements.push(movement)
	}

	return movements
}

export async function listMovementsForIntake (
	db: SqlExecutor,
	intakeRecordId: string,
): Promise<IntakeInventoryMovement[]> {
	const rows = await db.getAllAsync<MovementRow>(
		`SELECT id, intake_record_id, batch_id, quantity, created_at
		 FROM intake_inventory_movements
		 WHERE intake_record_id = ?
		 ORDER BY created_at ASC`,
		[intakeRecordId],
	)
	return rows.map(mapMovement)
}

export async function listHistoryIntakes (
	db: SqlExecutor,
	householdId: string,
	options: {
		statusFilter?: 'all' | 'taken' | 'skipped'
		beforeCreatedAt?: string | null
		limit: number
	},
): Promise<IntakeRecord[]> {
	const params: (string | number | null)[] = [householdId]
	let statusClause = ''
	if (options.statusFilter === 'taken') {
		statusClause = ` AND i.status = 'taken'`
	} else if (options.statusFilter === 'skipped') {
		statusClause = ` AND i.status = 'skipped'`
	} else {
		statusClause = ` AND i.status IN ('taken', 'skipped')`
	}

	let beforeClause = ''
	if (options.beforeCreatedAt) {
		beforeClause = ' AND i.created_at < ?'
		params.push(options.beforeCreatedAt)
	}

	params.push(options.limit)

	const rows = await db.getAllAsync<IntakeRow>(
		`SELECT i.id, i.course_id, i.schedule_id, i.medicine_id, i.person_id,
			i.scheduled_date, i.scheduled_time, i.status, i.actual_taken_at,
			i.skipped_at, i.snoozed_until, i.dose_quantity, i.dose_unit, i.note,
			i.inventory_shortfall, i.created_at, i.updated_at, i.cancelled_at
		 FROM intake_records i
		 INNER JOIN medication_courses c ON c.id = i.course_id
		 WHERE c.household_id = ?
			 AND i.cancelled_at IS NULL
			 ${statusClause}
			 ${beforeClause}
		 ORDER BY COALESCE(i.actual_taken_at, i.skipped_at, i.created_at) DESC,
			i.id DESC
		 LIMIT ?`,
		params,
	)
	return rows.map(mapIntake)
}

export async function listActiveIntakesForDate (
	db: SqlExecutor,
	householdId: string,
	dateOnly: string,
): Promise<IntakeRecord[]> {
	const rows = await db.getAllAsync<IntakeRow>(
		`SELECT i.id, i.course_id, i.schedule_id, i.medicine_id, i.person_id,
			i.scheduled_date, i.scheduled_time, i.status, i.actual_taken_at,
			i.skipped_at, i.snoozed_until, i.dose_quantity, i.dose_unit, i.note,
			i.inventory_shortfall, i.created_at, i.updated_at, i.cancelled_at
		 FROM intake_records i
		 INNER JOIN medication_courses c ON c.id = i.course_id
		 WHERE c.household_id = ?
			 AND i.cancelled_at IS NULL
			 AND (
				 i.scheduled_date = ?
				 OR (
					 i.schedule_id IS NULL
					 AND date(i.actual_taken_at, 'localtime') = ?
				 )
			 )`,
		[householdId, dateOnly, dateOnly],
	)
	return rows.map(mapIntake)
}
