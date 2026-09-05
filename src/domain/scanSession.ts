/**
 * In-memory pending scan payload so raw codes are not put in URL params / analytics.
 */

import { MedicineCodeType } from '@/db/types'
import { Gs1ParseResult } from '@/domain/gs1Parser'

export interface ScannedCode {
	rawData: string
	barcodeType: string
	scannedAt: string
}

export interface PendingScanSession {
	scanned: ScannedCode
	parsed: Gs1ParseResult
	lookupCode: string
	codeType: MedicineCodeType
	/** When purchase/scan targets a known Medicine already. */
	targetMedicineId?: string | null
	shoppingItemId?: string | null
}

let pending: PendingScanSession | null = null

export function setPendingScan (session: PendingScanSession): void {
	pending = session
}

export function peekPendingScan (): PendingScanSession | null {
	return pending
}

export function takePendingScan (): PendingScanSession | null {
	const current = pending
	pending = null
	return current
}

export function clearPendingScan (): void {
	pending = null
}
