import { parseQuantityInput } from '@/utils/quantity'

/**
 * Parses a dose quantity for a course / intake.
 * Dose must be finite and strictly greater than zero.
 */
export function parseDoseInput (raw: string): number | null {
	const value = parseQuantityInput(raw)
	if (value === null || value <= 0) {
		return null
	}
	return value
}
