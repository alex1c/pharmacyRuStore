import { ExpiryStatus, StockStatus } from '@/db/types'
import { formatExpiryDisplay } from '@/utils/expiry'
import { formatQuantityWithUnit } from '@/utils/quantity'
import { getMedicineUnitShortLabel } from '@/constants/medicineUnits'

/** Russian labels for inventory statuses — never show raw enum codes. */
export function stockStatusLabel (status: StockStatus): string | null {
	if (status === 'empty') {
		return 'Упаковка закончилась'
	}
	if (status === 'low') {
		return 'Мало осталось'
	}
	return null
}

export function expiryStatusLabel (status: ExpiryStatus): string | null {
	if (status === 'expired') {
		return 'Просрочено'
	}
	if (status === 'expiring_soon') {
		return 'Скоро истечёт срок'
	}
	return null
}

export function medicineListStatusLine (input: {
	stockStatus: StockStatus
	expiryStatus: ExpiryStatus
	expiredBatchCount: number
	expiringSoonBatchCount: number
}): string | null {
	if (input.expiryStatus === 'expired' || input.expiredBatchCount > 0) {
		return input.expiredBatchCount > 1
			? 'Есть просроченные упаковки'
			: 'Есть просроченная упаковка'
	}
	if (input.stockStatus === 'empty') {
		return 'Закончилось'
	}
	if (
		input.expiryStatus === 'expiring_soon' ||
		input.expiringSoonBatchCount > 0
	) {
		return input.expiringSoonBatchCount > 1
			? 'Срок нескольких упаковок скоро истечёт'
			: 'Срок одной упаковки скоро истекает'
	}
	if (input.stockStatus === 'low') {
		return 'Мало осталось'
	}
	return null
}

export function formatEffectiveExpiryLine (input: {
	date: string | null
	source: 'package' | 'after_opening' | null
}): string | null {
	if (!input.date) {
		return null
	}
	const display = formatExpiryDisplay(input.date)
	if (!display) {
		return null
	}
	if (input.source === 'after_opening') {
		return `После вскрытия до ${display}`
	}
	return `Годен до ${display}`
}

export function formatRemainingLine (
	totalQuantity: number,
	unit: Parameters<typeof getMedicineUnitShortLabel>[0] | null,
): string {
	const short = unit ? getMedicineUnitShortLabel(unit) : ''
	return formatQuantityWithUnit(totalQuantity, short)
}
