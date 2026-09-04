import { formatQuantity, parseQuantityInput } from '@/utils/quantity'
import {
	formatExpiryDisplay,
	formatExpiryUntilLabel,
	getExpiryPrecision,
	normalizeExpiryInput,
} from '@/utils/expiry'
import { aggregateMedicineBatches } from '@/domain/medicineSummary'
import { MedicineBatch } from '@/db/types'

describe('quantity helpers', () => {
	it('parses valid quantities', () => {
		expect(parseQuantityInput('10')).toBe(10)
		expect(parseQuantityInput('12,5')).toBe(12.5)
		expect(parseQuantityInput('12.5')).toBe(12.5)
	})

	it('rejects invalid quantities', () => {
		expect(parseQuantityInput('-1')).toBeNull()
		expect(parseQuantityInput('abc')).toBeNull()
		expect(parseQuantityInput('')).toBeNull()
	})

	it('formats quantities for Russian UI', () => {
		expect(formatQuantity(20)).toBe('20')
		expect(formatQuantity(12.5)).toBe('12,5')
	})
})

describe('expiry helpers', () => {
	it('detects and formats year-month and exact dates', () => {
		expect(getExpiryPrecision('2028-05')).toBe('year-month')
		expect(getExpiryPrecision('2028-05-15')).toBe('date')
		expect(normalizeExpiryInput('year-month', '2028-05')).toBe('2028-05')
		expect(normalizeExpiryInput('date', undefined, '2028-05-15')).toBe(
			'2028-05-15',
		)
		expect(formatExpiryDisplay('2028-05')).toBe('май 2028')
		expect(formatExpiryDisplay('2028-05-15')).toBe('15 мая 2028')
		expect(formatExpiryUntilLabel('2026-11')).toBe('до ноября 2026')
	})
})

describe('aggregateMedicineBatches', () => {
	it('aggregates only active batches', () => {
		const batches: MedicineBatch[] = [
			{
				id: '1',
				medicineId: 'm',
				cabinetId: 'c',
				storageLocationId: null,
				quantity: 6,
				unit: 'tablet',
				expiryDate: '2026-11',
				openedAt: null,
				afterOpeningValue: null,
				afterOpeningUnit: null,
				purchaseDate: null,
				notes: null,
				createdAt: 'a',
				updatedAt: 'a',
				archivedAt: null,
			},
			{
				id: '2',
				medicineId: 'm',
				cabinetId: 'c',
				storageLocationId: null,
				quantity: 20,
				unit: 'tablet',
				expiryDate: '2028-05',
				openedAt: null,
				afterOpeningValue: null,
				afterOpeningUnit: null,
				purchaseDate: null,
				notes: null,
				createdAt: 'b',
				updatedAt: 'b',
				archivedAt: 'archived',
			},
		]

		const stock = aggregateMedicineBatches(batches)
		expect(stock.totalQuantity).toBe(6)
		expect(stock.nearestExpiry).toBe('2026-11')
		expect(stock.activeBatchCount).toBe(1)
	})
})
