/**
 * Normalizes scanned / typed barcode strings for stable local lookup.
 * Always keeps values as strings — never Number() — to preserve leading zeros.
 */

export function normalizeScannedCode (raw: string): string {
	return raw
		.trim()
		.replace(/[\u0000-\u001f\u007f]/g, '')
		.replace(/\s+/g, '')
}
