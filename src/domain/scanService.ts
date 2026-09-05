/**
 * Scan resolution: parse → local code lookup → attach helpers.
 * Raw codes must never be sent to analytics.
 */

import {
	attachMedicineCode,
	findMedicineCodeByValue,
} from '@/db/repositories/medicineCodes'
import { getMedicineById } from '@/db/repositories/medicines'
import { SqlExecutor } from '@/db/sqlExecutor'
import { Medicine, MedicineCodeType } from '@/db/types'
import { parseGs1DataMatrix } from '@/domain/gs1Parser'
import { medicineLookupProvider } from '@/domain/medicineLookupProvider'
import {
	PendingScanSession,
	ScannedCode,
	setPendingScan,
} from '@/domain/scanSession'
import { nowIso } from '@/utils/dates'
import { normalizeScannedCode } from '@/utils/normalizeScannedCode'

export type ScanLookupStatus =
	| 'found'
	| 'unknown'
	| 'archived'
	| 'invalid'

export interface ScanLookupResult {
	status: ScanLookupStatus
	session: PendingScanSession
	medicine: Medicine | null
}

/**
 * Maps expo-camera barcode type strings to persisted code types.
 */
export function mapBarcodeTypeToCodeType (barcodeType: string): MedicineCodeType {
	const key = barcodeType.toLowerCase().replace(/[^a-z0-9]/g, '_')
	switch (key) {
		case 'ean13':
		case 'ean_13':
			return 'ean13'
		case 'ean8':
		case 'ean_8':
			return 'ean8'
		case 'upc_a':
		case 'upca':
			return 'upc_a'
		case 'upc_e':
		case 'upce':
			return 'upc_e'
		case 'code128':
		case 'code_128':
			return 'code128'
		case 'qr':
		case 'qrcode':
			return 'qr'
		case 'datamatrix':
		case 'data_matrix':
			return 'datamatrix'
		default:
			return 'unknown'
	}
}

/**
 * Builds a pending scan session from camera or manual entry.
 */
export function buildScanSession (input: {
	rawData: string
	barcodeType: string
	targetMedicineId?: string | null
	shoppingItemId?: string | null
}): PendingScanSession | null {
	const normalized = normalizeScannedCode(input.rawData)
	if (!normalized) {
		return null
	}

	const scanned: ScannedCode = {
		rawData: input.rawData.trim(),
		barcodeType: input.barcodeType,
		scannedAt: nowIso(),
	}
	const parsed = parseGs1DataMatrix(scanned.rawData)
	const codeType = mapBarcodeTypeToCodeType(input.barcodeType)
	const lookupCode =
		parsed.gtin ??
		(codeType === 'datamatrix' || codeType === 'qr'
			? normalizeScannedCode(scanned.rawData)
			: normalized)

	return {
		scanned,
		parsed,
		lookupCode,
		codeType: parsed.gtin ? 'gtin' : codeType,
		targetMedicineId: input.targetMedicineId ?? null,
		shoppingItemId: input.shoppingItemId ?? null,
	}
}

/**
 * Resolves a scanned/typed code against local medicine_codes.
 * Optional external lookup runs but Phase 6 default returns null.
 */
export async function resolveScannedCode (
	db: SqlExecutor,
	session: PendingScanSession,
): Promise<ScanLookupResult> {
	setPendingScan(session)

	const candidates = uniqueNonEmpty([
		session.lookupCode,
		session.parsed.gtin,
		normalizeScannedCode(session.scanned.rawData),
	])

	for (const candidate of candidates) {
		const link = await findMedicineCodeByValue(db, candidate)
		if (!link) {
			continue
		}
		const medicine = await getMedicineById(db, link.medicineId)
		if (!medicine) {
			continue
		}
		if (medicine.archivedAt) {
			return { status: 'archived', session, medicine }
		}
		return { status: 'found', session, medicine }
	}

	// Future enrichment hook — must stay offline by default.
	if (session.parsed.gtin) {
		await medicineLookupProvider.lookupByGtin(session.parsed.gtin)
	}

	return { status: 'unknown', session, medicine: null }
}

/**
 * Links the pending scan code(s) to a medicine (GTIN and/or raw).
 */
export async function attachScanCodesToMedicine (
	db: SqlExecutor,
	session: PendingScanSession,
	medicineId: string,
): Promise<void> {
	const values = uniqueNonEmpty([
		session.parsed.gtin,
		session.lookupCode,
		normalizeScannedCode(session.scanned.rawData),
	])

	for (const value of values) {
		const type: MedicineCodeType =
			session.parsed.gtin && value === session.parsed.gtin
				? 'gtin'
				: session.codeType
		await attachMedicineCode(db, {
			medicineId,
			codeType: type,
			codeValue: value,
		})
	}
}

function uniqueNonEmpty (values: (string | null | undefined)[]): string[] {
	const seen = new Set<string>()
	const out: string[] = []
	for (const value of values) {
		if (!value) {
			continue
		}
		const normalized = normalizeScannedCode(value)
		if (!normalized || seen.has(normalized)) {
			continue
		}
		seen.add(normalized)
		out.push(normalized)
	}
	return out
}
