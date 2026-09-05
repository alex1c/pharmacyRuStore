/**
 * Domain / persistence types.
 * Critical rule: Medicine ≠ MedicineBatch — quantity and expiry belong to batches.
 */

export interface Household {
	id: string
	name: string
	createdAt: string
	updatedAt: string
}

export interface Person {
	id: string
	householdId: string
	name: string
	note: string | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface MedicineCabinet {
	id: string
	householdId: string
	name: string
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface StorageLocation {
	id: string
	cabinetId: string
	name: string
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

/** Stable form codes — Russian labels live in UI constants. */
export type MedicineForm =
	| 'tablet'
	| 'capsule'
	| 'drops'
	| 'syrup'
	| 'solution'
	| 'ointment'
	| 'cream'
	| 'gel'
	| 'spray'
	| 'powder'
	| 'ampoule'
	| 'suppository'
	| 'patch'
	| 'other'

/** Stable unit codes for batch remaining quantity. */
export type MedicineUnit =
	| 'tablet'
	| 'capsule'
	| 'ml'
	| 'g'
	| 'dose'
	| 'ampoule'
	| 'sachet'
	| 'suppository'
	| 'drop'
	| 'pcs'
	| 'other'

export type AfterOpeningUnit = 'days' | 'weeks' | 'months'

/**
 * Expiry stored as TEXT:
 * - YYYY-MM (month precision)
 * - YYYY-MM-DD (exact day)
 * Never as a UTC timestamp.
 */
export type ExpiryDateValue = string

export type ExpiryStatus = 'unknown' | 'ok' | 'expiring_soon' | 'expired'
export type StockStatus = 'in_stock' | 'low' | 'empty'
export type EffectiveExpirySource = 'package' | 'after_opening'

export type AttentionKind =
	| 'expired'
	| 'empty'
	| 'expiring_soon'
	| 'low_stock'

export interface Medicine {
	id: string
	householdId: string
	name: string
	form: MedicineForm
	strengthText: string | null
	notes: string | null
	photoUri: string | null
	/** When null, global default low-stock threshold is used. */
	lowStockThreshold: number | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface MedicineBatch {
	id: string
	medicineId: string
	cabinetId: string
	storageLocationId: string | null
	quantity: number
	unit: MedicineUnit
	expiryDate: ExpiryDateValue | null
	openedAt: string | null
	afterOpeningValue: number | null
	afterOpeningUnit: AfterOpeningUnit | null
	purchaseDate: string | null
	notes: string | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface EffectiveExpiry {
	/** Always YYYY-MM-DD when present. */
	date: string
	source: EffectiveExpirySource
	/** Original package expiry text (YYYY-MM or YYYY-MM-DD), if any. */
	packageExpiry: string | null
	afterOpeningExpiry: string | null
}

export interface MedicineSummary {
	medicine: Medicine
	totalQuantity: number
	unit: MedicineUnit | null
	stockStatus: StockStatus
	lowStockThreshold: number
	nearestExpiry: ExpiryDateValue | null
	nearestEffectiveExpiry: string | null
	nearestEffectiveSource: EffectiveExpirySource | null
	expiryStatus: ExpiryStatus
	expiredBatchCount: number
	expiringSoonBatchCount: number
	emptyBatchCount: number
	activeBatchCount: number
	primaryCabinetName: string | null
	attentionKind: AttentionKind | null
}

export interface AppSettings {
	expiryWarningDays: number
	defaultLowStockThreshold: number
	/** Global ON/OFF for medication native reminders. */
	medicationRemindersEnabled: boolean
}

export interface AppMeta {
	key: string
	value: string
}

/** Schedule rule types supported in Phase 3. */
export type ScheduleType =
	| 'daily'
	| 'weekdays'
	| 'every_n_days'
	| 'one_time'

export type IntakeStatus = 'taken' | 'skipped' | 'snoozed'

/**
 * Weekday bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64.
 * Independent of locale weekday names.
 */
export type WeekdaysMask = number

export interface MedicationCourse {
	id: string
	householdId: string
	personId: string
	medicineId: string
	doseQuantity: number
	doseUnit: MedicineUnit
	startDate: string
	endDate: string | null
	instructions: string | null
	isPrn: boolean
	/** User intent to receive native reminders (ignored for PRN). */
	remindersEnabled: boolean
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface MedicationSchedule {
	id: string
	courseId: string
	type: ScheduleType
	timeOfDay: string | null
	weekdaysMask: WeekdaysMask | null
	intervalDays: number | null
	oneTimeDate: string | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface IntakeRecord {
	id: string
	courseId: string
	scheduleId: string | null
	medicineId: string
	personId: string
	scheduledDate: string | null
	scheduledTime: string | null
	status: IntakeStatus
	actualTakenAt: string | null
	skippedAt: string | null
	snoozedUntil: string | null
	doseQuantity: number
	doseUnit: MedicineUnit
	note: string | null
	inventoryShortfall: boolean
	createdAt: string
	updatedAt: string
	cancelledAt: string | null
}

export interface IntakeInventoryMovement {
	id: string
	intakeRecordId: string
	batchId: string
	quantity: number
	createdAt: string
}

export interface ScheduledOccurrence {
	courseId: string
	scheduleId: string
	medicineId: string
	personId: string
	scheduledDate: string
	scheduledTime: string
	doseQuantity: number
	doseUnit: MedicineUnit
}

/**
 * Ledger row mapping a scheduled occurrence to a native notification ID.
 */
export interface ScheduledNotification {
	id: string
	occurrenceKey: string
	courseId: string
	scheduleId: string
	scheduledDate: string
	scheduledTime: string
	nativeNotificationId: string
	triggerAt: string
	createdAt: string
	updatedAt: string
}

export type ShoppingSource = 'automatic' | 'manual'
export type ShoppingReason = 'low_stock' | 'empty' | 'manual'
export type ShoppingStatus = 'active' | 'completed'

export interface ShoppingItem {
	id: string
	householdId: string
	medicineId: string | null
	customName: string | null
	desiredQuantity: number | null
	unit: MedicineUnit | null
	reason: ShoppingReason
	source: ShoppingSource
	status: ShoppingStatus
	note: string | null
	createdAt: string
	updatedAt: string
	completedAt: string | null
	archivedAt: string | null
}
