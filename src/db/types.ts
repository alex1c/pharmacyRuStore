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
}

export interface AppMeta {
	key: string
	value: string
}
