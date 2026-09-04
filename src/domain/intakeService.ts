import { planFefoConsumption } from '@/domain/fefoConsumption'
import { getOccurrencesForDate } from '@/domain/scheduleEngine'
import { listBatchesForMedicine } from '@/db/repositories/medicineBatches'
import {
	cancelIntakeRecord,
	findActiveOccurrenceIntake,
	getIntakeById,
	insertIntakeRecord,
	insertInventoryMovements,
	listMovementsForIntake,
	updateIntakeRecordFields,
} from '@/db/repositories/intakeRecords'
import {
	getCourseById,
	listActiveCourses,
} from '@/db/repositories/medicationCourses'
import { listActiveSchedulesForHousehold } from '@/db/repositories/medicationSchedules'
import { SqlExecutor } from '@/db/sqlExecutor'
import {
	IntakeRecord,
	MedicationCourse,
	ScheduledOccurrence,
} from '@/db/types'
import { nowIso } from '@/utils/dates'

export type OccurrenceUiStatus =
	| 'pending'
	| 'taken'
	| 'skipped'
	| 'snoozed'

export interface TodayOccurrenceView {
	occurrence: ScheduledOccurrence
	medicineName: string
	personName: string
	status: OccurrenceUiStatus
	intake: IntakeRecord | null
	/** Effective sort time HH:mm (snoozedUntil local clock when snoozed). */
	sortTime: string
}

export class InventoryShortfallError extends Error {
	readonly available: number
	readonly requested: number
	readonly unit: string

	constructor (available: number, requested: number, unit: string) {
		super('INVENTORY_SHORTFALL')
		this.name = 'INVENTORY_SHORTFALL'
		this.available = available
		this.requested = requested
		this.unit = unit
	}
}

export class AlreadyTakenError extends Error {
	readonly intake: IntakeRecord

	constructor (intake: IntakeRecord) {
		super('ALREADY_TAKEN')
		this.name = 'ALREADY_TAKEN'
		this.intake = intake
	}
}

async function runInTransaction<T> (
	db: SqlExecutor,
	task: () => Promise<T>,
): Promise<T> {
	if (db.withTransactionAsync) {
		return db.withTransactionAsync(task)
	}
	return task()
}

/**
 * Debits batch quantities according to FEFO allocations.
 * Never writes a negative quantity.
 */
async function applyConsumption (
	db: SqlExecutor,
	allocations: { batchId: string; quantity: number }[],
): Promise<void> {
	const timestamp = nowIso()
	for (const allocation of allocations) {
		const batch = await db.getFirstAsync<{ quantity: number }>(
			`SELECT quantity FROM medicine_batches WHERE id = ?`,
			[allocation.batchId],
		)
		if (!batch) {
			throw new Error('Batch not found')
		}
		const next = Math.max(0, batch.quantity - allocation.quantity)
		if (next > batch.quantity) {
			throw new Error('INVALID_CONSUMPTION')
		}
		// Guard: allocation must not exceed current qty.
		if (allocation.quantity > batch.quantity + 1e-9) {
			throw new Error('INSUFFICIENT_BATCH_QTY')
		}
		await db.runAsync(
			`UPDATE medicine_batches
			 SET quantity = ?, updated_at = ?
			 WHERE id = ?`,
			[next, timestamp, allocation.batchId],
		)
	}
}

async function restoreConsumption (
	db: SqlExecutor,
	allocations: { batchId: string; quantity: number }[],
): Promise<void> {
	const timestamp = nowIso()
	for (const allocation of allocations) {
		await db.runAsync(
			`UPDATE medicine_batches
			 SET quantity = quantity + ?, updated_at = ?
			 WHERE id = ?`,
			[allocation.quantity, timestamp, allocation.batchId],
		)
	}
}

function resolveOccurrenceStatus (
	intake: IntakeRecord | null,
	now: Date,
): OccurrenceUiStatus {
	if (!intake || intake.cancelledAt) {
		return 'pending'
	}
	if (intake.status === 'taken') {
		return 'taken'
	}
	if (intake.status === 'skipped') {
		return 'skipped'
	}
	if (intake.status === 'snoozed' && intake.snoozedUntil) {
		const until = new Date(intake.snoozedUntil)
		if (until.getTime() > now.getTime()) {
			return 'snoozed'
		}
		// Snooze expired → treat as pending again.
		return 'pending'
	}
	return 'pending'
}

function localHmFromIso (iso: string): string {
	const date = new Date(iso)
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	return `${hours}:${minutes}`
}

/**
 * Builds Today occurrence views with intake status for a calendar date.
 */
export async function loadTodayOccurrences (
	db: SqlExecutor,
	householdId: string,
	dateOnly: string,
	now: Date = new Date(),
): Promise<TodayOccurrenceView[]> {
	const courses = await listActiveCourses(db, householdId)
	const schedules = await listActiveSchedulesForHousehold(db, householdId)
	const occurrences = getOccurrencesForDate({
		courses,
		schedules,
		dateOnly,
	})

	const medicineIds = [...new Set(occurrences.map((item) => item.medicineId))]
	const personIds = [...new Set(occurrences.map((item) => item.personId))]

	const medicines = new Map<string, string>()
	for (const medicineId of medicineIds) {
		const row = await db.getFirstAsync<{ name: string }>(
			`SELECT name FROM medicines WHERE id = ?`,
			[medicineId],
		)
		if (row) {
			medicines.set(medicineId, row.name)
		}
	}

	const people = new Map<string, string>()
	for (const personId of personIds) {
		const row = await db.getFirstAsync<{ name: string }>(
			`SELECT name FROM people WHERE id = ?`,
			[personId],
		)
		if (row) {
			people.set(personId, row.name)
		}
	}

	const views: TodayOccurrenceView[] = []
	for (const occurrence of occurrences) {
		const intake = await findActiveOccurrenceIntake(
			db,
			occurrence.scheduleId,
			occurrence.scheduledDate,
			occurrence.scheduledTime,
		)
		const status = resolveOccurrenceStatus(intake, now)
		let sortTime = occurrence.scheduledTime
		if (status === 'snoozed' && intake?.snoozedUntil) {
			sortTime = localHmFromIso(intake.snoozedUntil)
		}
		views.push({
			occurrence,
			medicineName: medicines.get(occurrence.medicineId) ?? 'Лекарство',
			personName: people.get(occurrence.personId) ?? 'Я',
			status,
			intake,
			sortTime,
		})
	}

	views.sort((a, b) => {
		const aDone = a.status === 'taken' || a.status === 'skipped' ? 1 : 0
		const bDone = b.status === 'taken' || b.status === 'skipped' ? 1 : 0
		if (aDone !== bDone) {
			return aDone - bDone
		}
		if (a.sortTime !== b.sortTime) {
			return a.sortTime < b.sortTime ? -1 : 1
		}
		return a.occurrence.courseId.localeCompare(b.occurrence.courseId)
	})

	return views
}

export interface MarkTakenOptions {
	/** When true, allow shortfall and consume available stock only. */
	allowShortfall?: boolean
	doseQuantity?: number
	note?: string | null
	now?: Date
}

/**
 * Marks a scheduled occurrence as taken with FEFO inventory debit.
 * Idempotent: second call returns existing taken record without re-debit.
 */
export async function markOccurrenceTaken (
	db: SqlExecutor,
	occurrence: ScheduledOccurrence,
	options: MarkTakenOptions = {},
): Promise<IntakeRecord> {
	const now = options.now ?? new Date()
	const actualTakenAt = now.toISOString()

	return runInTransaction(db, async () => {
		const existing = await findActiveOccurrenceIntake(
			db,
			occurrence.scheduleId,
			occurrence.scheduledDate,
			occurrence.scheduledTime,
		)

		if (existing && !existing.cancelledAt) {
			// Idempotent: already taken — do not debit inventory again.
			if (existing.status === 'taken') {
				return existing
			}
			// Cancel snoozed/skipped so unique index allows a new taken row.
			if (existing.status === 'snoozed' || existing.status === 'skipped') {
				await cancelIntakeRecord(db, existing.id)
			}
		}

		const course = await getCourseById(db, occurrence.courseId)
		if (!course || course.archivedAt) {
			throw new Error('Course not found')
		}

		const doseQuantity = options.doseQuantity ?? occurrence.doseQuantity
		if (!Number.isFinite(doseQuantity) || doseQuantity <= 0) {
			throw new Error('INVALID_DOSE')
		}

		const batches = await listBatchesForMedicine(db, occurrence.medicineId)
		const plan = planFefoConsumption(batches, doseQuantity, occurrence.doseUnit)

		if (plan.shortfall > 0 && !options.allowShortfall) {
			throw new InventoryShortfallError(
				plan.consumed,
				doseQuantity,
				occurrence.doseUnit,
			)
		}

		const record = await insertIntakeRecord(db, {
			courseId: occurrence.courseId,
			scheduleId: occurrence.scheduleId,
			medicineId: occurrence.medicineId,
			personId: occurrence.personId,
			scheduledDate: occurrence.scheduledDate,
			scheduledTime: occurrence.scheduledTime,
			status: 'taken',
			actualTakenAt,
			doseQuantity,
			doseUnit: occurrence.doseUnit,
			note: options.note ?? null,
			inventoryShortfall: plan.shortfall > 0,
		})

		await applyConsumption(db, plan.allocations)
		await insertInventoryMovements(db, record.id, plan.allocations)

		return record
	})
}

/**
 * Marks occurrence skipped — no inventory change.
 */
export async function markOccurrenceSkipped (
	db: SqlExecutor,
	occurrence: ScheduledOccurrence,
	options: { now?: Date; note?: string | null } = {},
): Promise<IntakeRecord> {
	const now = options.now ?? new Date()

	return runInTransaction(db, async () => {
		const existing = await findActiveOccurrenceIntake(
			db,
			occurrence.scheduleId,
			occurrence.scheduledDate,
			occurrence.scheduledTime,
		)

		if (existing && !existing.cancelledAt) {
			if (existing.status === 'skipped') {
				return existing
			}
			if (existing.status === 'taken') {
				throw new AlreadyTakenError(existing)
			}
			await cancelIntakeRecord(db, existing.id)
		}

		return insertIntakeRecord(db, {
			courseId: occurrence.courseId,
			scheduleId: occurrence.scheduleId,
			medicineId: occurrence.medicineId,
			personId: occurrence.personId,
			scheduledDate: occurrence.scheduledDate,
			scheduledTime: occurrence.scheduledTime,
			status: 'skipped',
			skippedAt: now.toISOString(),
			doseQuantity: occurrence.doseQuantity,
			doseUnit: occurrence.doseUnit,
			note: options.note ?? null,
		})
	})
}

/**
 * Snoozes an occurrence by +minutes from now.
 */
export async function snoozeOccurrence (
	db: SqlExecutor,
	occurrence: ScheduledOccurrence,
	minutes: 10 | 30 | 60,
	options: { now?: Date } = {},
): Promise<IntakeRecord> {
	const now = options.now ?? new Date()
	const until = new Date(now.getTime() + minutes * 60_000)

	return runInTransaction(db, async () => {
		const existing = await findActiveOccurrenceIntake(
			db,
			occurrence.scheduleId,
			occurrence.scheduledDate,
			occurrence.scheduledTime,
		)

		if (existing && !existing.cancelledAt) {
			if (existing.status === 'taken') {
				throw new AlreadyTakenError(existing)
			}
			if (existing.status === 'snoozed') {
				return updateIntakeRecordFields(db, existing.id, {
					status: 'snoozed',
					snoozedUntil: until.toISOString(),
					skippedAt: null,
				})
			}
			await cancelIntakeRecord(db, existing.id)
		}

		return insertIntakeRecord(db, {
			courseId: occurrence.courseId,
			scheduleId: occurrence.scheduleId,
			medicineId: occurrence.medicineId,
			personId: occurrence.personId,
			scheduledDate: occurrence.scheduledDate,
			scheduledTime: occurrence.scheduledTime,
			status: 'snoozed',
			snoozedUntil: until.toISOString(),
			doseQuantity: occurrence.doseQuantity,
			doseUnit: occurrence.doseUnit,
		})
	})
}

/**
 * PRN / as-needed intake: no schedule identity, always creates a new taken row.
 */
export async function takePrnDose (
	db: SqlExecutor,
	course: MedicationCourse,
	options: MarkTakenOptions = {},
): Promise<IntakeRecord> {
	if (!course.isPrn) {
		throw new Error('NOT_PRN_COURSE')
	}
	const now = options.now ?? new Date()
	const actualTakenAt = now.toISOString()
	const doseQuantity = options.doseQuantity ?? course.doseQuantity

	return runInTransaction(db, async () => {
		if (!Number.isFinite(doseQuantity) || doseQuantity <= 0) {
			throw new Error('INVALID_DOSE')
		}

		const batches = await listBatchesForMedicine(db, course.medicineId)
		const plan = planFefoConsumption(batches, doseQuantity, course.doseUnit)

		if (plan.shortfall > 0 && !options.allowShortfall) {
			throw new InventoryShortfallError(
				plan.consumed,
				doseQuantity,
				course.doseUnit,
			)
		}

		const record = await insertIntakeRecord(db, {
			courseId: course.id,
			scheduleId: null,
			medicineId: course.medicineId,
			personId: course.personId,
			scheduledDate: null,
			scheduledTime: null,
			status: 'taken',
			actualTakenAt,
			doseQuantity,
			doseUnit: course.doseUnit,
			note: options.note ?? null,
			inventoryShortfall: plan.shortfall > 0,
		})

		await applyConsumption(db, plan.allocations)
		await insertInventoryMovements(db, record.id, plan.allocations)

		return record
	})
}

/**
 * Undoes an intake: cancels record and restores inventory from movement ledger.
 */
export async function undoIntake (
	db: SqlExecutor,
	intakeId: string,
): Promise<void> {
	await runInTransaction(db, async () => {
		const intake = await getIntakeById(db, intakeId)
		if (!intake || intake.cancelledAt) {
			return
		}

		if (intake.status === 'taken') {
			const movements = await listMovementsForIntake(db, intakeId)
			await restoreConsumption(
				db,
				movements.map((item) => ({
					batchId: item.batchId,
					quantity: item.quantity,
				})),
			)
		}

		await cancelIntakeRecord(db, intakeId)
	})
}

/**
 * Updates factual taken time and/or note without touching inventory.
 */
export async function editIntakeMeta (
	db: SqlExecutor,
	intakeId: string,
	fields: { actualTakenAt?: string | null; note?: string | null },
): Promise<IntakeRecord> {
	return updateIntakeRecordFields(db, intakeId, fields)
}

/**
 * Takes all pending occurrences in a time group sequentially.
 * Each intake is its own transaction; shortfall items are reported separately.
 */
export async function takeAllOccurrences (
	db: SqlExecutor,
	occurrences: ScheduledOccurrence[],
	options: MarkTakenOptions = {},
): Promise<{
	taken: IntakeRecord[]
	shortfalls: { occurrence: ScheduledOccurrence; error: InventoryShortfallError }[]
	errors: { occurrence: ScheduledOccurrence; error: unknown }[]
}> {
	const taken: IntakeRecord[] = []
	const shortfalls: {
		occurrence: ScheduledOccurrence
		error: InventoryShortfallError
	}[] = []
	const errors: { occurrence: ScheduledOccurrence; error: unknown }[] = []

	for (const occurrence of occurrences) {
		try {
			const record = await markOccurrenceTaken(db, occurrence, options)
			taken.push(record)
		} catch (error) {
			if (error instanceof InventoryShortfallError) {
				shortfalls.push({ occurrence, error })
			} else {
				errors.push({ occurrence, error })
			}
		}
	}

	return { taken, shortfalls, errors }
}
