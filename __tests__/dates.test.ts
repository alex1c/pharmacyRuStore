import {
	isDateOnly,
	isLocalTimeHm,
	isYearMonth,
	toDateOnlyLocal,
} from '@/utils/dates'

describe('date helpers', () => {
	it('accepts valid date-only values', () => {
		expect(isDateOnly('2028-05-12')).toBe(true)
		expect(isDateOnly('2028-02-30')).toBe(false)
		expect(isDateOnly('2028/05/12')).toBe(false)
	})

	it('accepts year-month expiry without timezone conversion', () => {
		expect(isYearMonth('2028-05')).toBe(true)
		expect(isYearMonth('2028-13')).toBe(false)
	})

	it('accepts local HH:mm schedule times', () => {
		expect(isLocalTimeHm('08:00')).toBe(true)
		expect(isLocalTimeHm('21:30')).toBe(true)
		expect(isLocalTimeHm('24:00')).toBe(false)
	})

	it('formats local calendar dates without UTC shift', () => {
		const local = new Date(2028, 4, 12, 23, 30, 0)
		expect(toDateOnlyLocal(local)).toBe('2028-05-12')
	})
})
