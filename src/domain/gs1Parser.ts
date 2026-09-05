/**
 * Best-effort GS1 DataMatrix / barcode parser.
 * Never throws on malformed input — returns partial/unknown results.
 */

import { normalizeScannedCode } from '@/utils/normalizeScannedCode'

/** ASCII Group Separator used in GS1 element strings. */
const GS = String.fromCharCode(29)

export interface Gs1ParseResult {
	/** True when at least one known AI was extracted. */
	parsed: boolean
	gtin: string | null
	/** Date-only YYYY-MM-DD when AI (17) YYMMDD is valid. */
	expiryDate: string | null
	lot: string | null
	serial: string | null
	raw: string
}

/**
 * Parses bracketed or GS-separated GS1 payloads.
 * Unknown AIs and junk data are ignored safely.
 */
export function parseGs1DataMatrix (rawInput: string): Gs1ParseResult {
	const raw = rawInput ?? ''
	const empty: Gs1ParseResult = {
		parsed: false,
		gtin: null,
		expiryDate: null,
		lot: null,
		serial: null,
		raw,
	}

	try {
		const trimmed = raw.trim()
		if (!trimmed) {
			return empty
		}

		const fields = extractAiFields(trimmed)
		const gtin = normalizeGtin(fields['01'] ?? null)
		const expiryDate = parseAi17Expiry(fields['17'] ?? null)
		const lot = emptyToNull(fields['10'])
		const serial = emptyToNull(fields['21'])
		const parsed = Boolean(gtin || expiryDate || lot || serial)

		return {
			parsed,
			gtin,
			expiryDate,
			lot,
			serial,
			raw,
		}
	} catch {
		return empty
	}
}

function extractAiFields (payload: string): Record<string, string> {
	const fields: Record<string, string> = {}

	// Bracketed human-readable form: (01)....(17)....
	if (/\(\d{2,4}\)/.test(payload)) {
		const re = /\((\d{2,4})\)([^\(]*)/g
		let match: RegExpExecArray | null
		while ((match = re.exec(payload)) !== null) {
			const ai = match[1]
			const value = match[2]?.trim() ?? ''
			if (ai && value) {
				fields[ai] = value.replace(new RegExp(GS, 'g'), '').trim()
			}
		}
		return fields
	}

	// Element string: optional ]d2 / ]C1 header, then AI+value with GS separators.
	let rest = payload
		.replace(/^\][A-Za-z0-9]{2}/, '')
		.replace(/^\u001d/, '')

	const knownFixed: Record<string, number> = {
		'01': 14,
		'17': 6,
	}

	while (rest.length > 0) {
		if (rest.startsWith(GS)) {
			rest = rest.slice(1)
			continue
		}

		let matched = false
		for (const ai of Object.keys(knownFixed)) {
			if (rest.startsWith(ai)) {
				const len = knownFixed[ai]
				const value = rest.slice(ai.length, ai.length + len)
				if (value.length === len) {
					fields[ai] = value
					rest = rest.slice(ai.length + len)
					matched = true
					break
				}
			}
		}
		if (matched) {
			continue
		}

		// Variable-length AIs ending at GS or end of string.
		for (const ai of ['10', '21']) {
			if (rest.startsWith(ai)) {
				const after = rest.slice(ai.length)
				const gsIndex = after.indexOf(GS)
				const value = gsIndex >= 0 ? after.slice(0, gsIndex) : after
				if (value) {
					fields[ai] = value
				}
				rest = gsIndex >= 0 ? after.slice(gsIndex + 1) : ''
				matched = true
				break
			}
		}
		if (matched) {
			continue
		}

		// Unknown AI — stop rather than mis-parse the rest.
		break
	}

	return fields
}

function normalizeGtin (value: string | null): string | null {
	if (!value) {
		return null
	}
	const digits = normalizeScannedCode(value).replace(/\D/g, '')
	if (digits.length < 8 || digits.length > 14) {
		return null
	}
	return digits
}

/**
 * AI (17) is YYMMDD. Day 00 means end of month → store as YYYY-MM.
 */
export function parseAi17Expiry (value: string | null): string | null {
	if (!value) {
		return null
	}
	const digits = value.replace(/\D/g, '')
	if (digits.length !== 6) {
		return null
	}
	const yy = Number(digits.slice(0, 2))
	const mm = Number(digits.slice(2, 4))
	const dd = Number(digits.slice(4, 6))
	if (!Number.isFinite(yy) || mm < 1 || mm > 12) {
		return null
	}
	const year = 2000 + yy
	const month = String(mm).padStart(2, '0')
	if (dd === 0) {
		return `${year}-${month}`
	}
	if (dd < 1 || dd > 31) {
		return null
	}
	const day = String(dd).padStart(2, '0')
	const iso = `${year}-${month}-${day}`
	const check = new Date(`${iso}T00:00:00`)
	if (
		Number.isNaN(check.getTime()) ||
		check.getFullYear() !== year ||
		check.getMonth() + 1 !== mm ||
		check.getDate() !== dd
	) {
		return null
	}
	return iso
}

function emptyToNull (value: string | undefined): string | null {
	if (!value) {
		return null
	}
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}
