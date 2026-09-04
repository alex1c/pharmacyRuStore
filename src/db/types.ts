/**
 * Domain / persistence types for Phase 0 entities.
 * Medicine and MedicineBatch arrive in Phase 1 — keep medicine ≠ batch in mind.
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
}

/** Future units — do not hardcode architecture to tablets only. */
export type MedicineUnit =
	| 'tablet'
	| 'capsule'
	| 'ml'
	| 'dose'
	| 'sachet'
	| 'ampoule'
	| 'suppository'
	| 'drop'
	| 'g'
	| 'pcs'
	| 'other'

export interface AppMeta {
	key: string
	value: string
}
