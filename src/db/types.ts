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
	createdAt: string
	updatedAt: string
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

export interface Medicine {
	id: string
	householdId: string
	name: string
	form: MedicineForm
	strengthText: string | null
	notes: string | null
	photoUri: string | null
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

export interface MedicineSummary {
	medicine: Medicine
	totalQuantity: number
	unit: MedicineUnit | null
	nearestExpiry: ExpiryDateValue | null
	activeBatchCount: number
	primaryCabinetName: string | null
}

export interface AppMeta {
	key: string
	value: string
}
