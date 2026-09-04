import { parseLocalizedDecimal } from './parseLocalizedDecimal'

/**
 * Parses and validates a batch quantity for persistence.
 * Rejects NaN, Infinity, negatives; allows 0.
 */
export function parseQuantityInput (raw: string): number | null {
	const value = parseLocalizedDecimal(raw)
	if (value === null) {
		return null
	}
	if (!Number.isFinite(value) || value < 0) {
		return null
	}
	return value
}

/**
 * Formats a quantity for Russian UI:
 * 20 → "20", 12.5 → "12,5"
 */
export function formatQuantity (value: number): string {
	if (!Number.isFinite(value)) {
		return '0'
	}

	const rounded = Math.round(value * 1000) / 1000
	if (Number.isInteger(rounded)) {
		return String(rounded)
	}

	return String(rounded).replace('.', ',')
}

/**
 * Formats quantity with optional unit short label.
 */
export function formatQuantityWithUnit (
	value: number,
	unitShortLabel: string,
): string {
	const amount = formatQuantity(value)
	return unitShortLabel ? `${amount} ${unitShortLabel}` : amount
}
