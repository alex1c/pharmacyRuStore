import { parseLocalizedDecimal } from '@/utils/parseLocalizedDecimal'

describe('parseLocalizedDecimal', () => {
	it('parses comma decimals', () => {
		expect(parseLocalizedDecimal('1,5')).toBe(1.5)
	})

	it('parses dot decimals', () => {
		expect(parseLocalizedDecimal('1.5')).toBe(1.5)
	})

	it('trims whitespace', () => {
		expect(parseLocalizedDecimal('  2,25  ')).toBe(2.25)
	})

	it('returns null for invalid input', () => {
		expect(parseLocalizedDecimal('')).toBeNull()
		expect(parseLocalizedDecimal('abc')).toBeNull()
		expect(parseLocalizedDecimal('1,2,3')).toBeNull()
	})
})
