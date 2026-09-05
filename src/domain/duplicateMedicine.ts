/**
 * Lightweight duplicate medicine name detection for create flows.
 * Case-insensitive + whitespace-normalized; not fuzzy search.
 */

import { Medicine } from '@/db/types'

export interface DuplicateMedicineMatch {
	medicine: Medicine
	reason: 'exact_name' | 'name_and_strength'
}

function normalizeName (value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeStrength (value: string | null | undefined): string {
	return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Finds likely duplicate medicines among active rows.
 */
export function findLikelyDuplicateMedicines (
	candidates: Medicine[],
	input: { name: string; strengthText?: string | null },
): DuplicateMedicineMatch[] {
	const name = normalizeName(input.name)
	if (!name) {
		return []
	}
	const strength = normalizeStrength(input.strengthText)
	const matches: DuplicateMedicineMatch[] = []

	for (const medicine of candidates) {
		if (medicine.archivedAt) {
			continue
		}
		const existingName = normalizeName(medicine.name)
		if (existingName !== name) {
			continue
		}
		const existingStrength = normalizeStrength(medicine.strengthText)
		if (strength && existingStrength && strength === existingStrength) {
			matches.push({ medicine, reason: 'name_and_strength' })
		} else if (!strength && !existingStrength) {
			matches.push({ medicine, reason: 'exact_name' })
		} else if (strength === existingStrength) {
			matches.push({ medicine, reason: 'name_and_strength' })
		} else if (!strength || !existingStrength) {
			// Same name, one side missing strength — still warn.
			matches.push({ medicine, reason: 'exact_name' })
		}
	}

	return matches
}

/**
 * Prefix matches while typing a new name (min 2 chars).
 */
export function findMedicineNameSuggestions (
	candidates: Medicine[],
	query: string,
	limit = 5,
): Medicine[] {
	const q = normalizeName(query)
	if (q.length < 2) {
		return []
	}
	return candidates
		.filter((medicine) => {
			if (medicine.archivedAt) {
				return false
			}
			return normalizeName(medicine.name).includes(q)
		})
		.slice(0, limit)
}
