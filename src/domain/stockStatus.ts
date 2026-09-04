import { StockStatus } from '@/db/types'

/**
 * Stock status for aggregate medicine quantity.
 * Policy: quantity == 0 → empty; quantity < threshold → low; else in_stock.
 * Equal to threshold counts as in_stock (not low).
 */
export function getMedicineStockStatus (
	totalQuantity: number,
	threshold: number,
): StockStatus {
	if (!Number.isFinite(totalQuantity) || totalQuantity < 0) {
		return 'empty'
	}
	if (totalQuantity === 0) {
		return 'empty'
	}
	if (totalQuantity < threshold) {
		return 'low'
	}
	return 'in_stock'
}

export function resolveLowStockThreshold (
	medicineThreshold: number | null | undefined,
	globalDefault: number,
): number {
	if (
		medicineThreshold !== null &&
		medicineThreshold !== undefined &&
		Number.isFinite(medicineThreshold) &&
		medicineThreshold >= 0
	) {
		return medicineThreshold
	}
	return globalDefault
}
