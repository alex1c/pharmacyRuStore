/**
 * Locale-aware decimal parsing for Russian numeric input.
 * Never rely on parseFloat("1,5") — it returns 1.
 */

/**
 * Parses a user-entered decimal that may use comma or dot as separator.
 * Returns null for empty / invalid values.
 */
export function parseLocalizedDecimal (raw: string): number | null {
	const trimmed = raw.trim().replace(/\s/g, '')
	if (!trimmed) {
		return null
	}

	// Allow one decimal separator (comma or dot), optional leading minus.
	const normalized = trimmed.replace(',', '.')
	if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
		return null
	}

	const value = Number(normalized)
	return Number.isFinite(value) ? value : null
}
