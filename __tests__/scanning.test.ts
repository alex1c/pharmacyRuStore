import { parseGs1DataMatrix, parseAi17Expiry } from '@/domain/gs1Parser'
import { createScanLock } from '@/domain/scanLock'
import {
	findLikelyDuplicateMedicines,
	findMedicineNameSuggestions,
} from '@/domain/duplicateMedicine'
import {
	attachScanCodesToMedicine,
	buildScanSession,
	resolveScannedCode,
} from '@/domain/scanService'
import { listRecentMedicinesByBatch } from '@/domain/recentMedicines'
import { applyMigrations, getLatestSchemaVersion } from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import { createBatch } from '@/db/repositories/medicineBatches'
import {
	attachMedicineCode,
	findMedicineCodeByValue,
} from '@/db/repositories/medicineCodes'
import {
	archiveMedicine,
	createMedicine,
	getMedicineById,
} from '@/db/repositories/medicines'
import { markPurchasedWithBatch } from '@/domain/purchaseService'
import { addMedicineToShopping } from '@/domain/purchaseService'
import { createTestSqlExecutor } from './helpers/testDatabase'
import { Medicine } from '@/db/types'
import { normalizeScannedCode } from '@/utils/normalizeScannedCode'

describe('normalizeScannedCode', () => {
	it('trims and preserves leading zeros as string', () => {
		expect(normalizeScannedCode('  04601234567890  ')).toBe('04601234567890')
		expect(normalizeScannedCode('4601234567890')).toBe('4601234567890')
	})
})

describe('GS1 DataMatrix parser', () => {
	it('parses bracketed AI fields', () => {
		const raw =
			'(01)04601234567890(17)280515(10)LOT42(21)SER999'
		const result = parseGs1DataMatrix(raw)
		expect(result.parsed).toBe(true)
		expect(result.gtin).toBe('04601234567890')
		expect(result.expiryDate).toBe('2028-05-15')
		expect(result.lot).toBe('LOT42')
		expect(result.serial).toBe('SER999')
		expect(result.raw).toBe(raw)
	})

	it('parses GS-separated element string', () => {
		const GS = String.fromCharCode(29)
		const raw = `010460123456789017280531${GS}10ABC${GS}21XYZ`
		const result = parseGs1DataMatrix(raw)
		expect(result.parsed).toBe(true)
		expect(result.gtin).toBe('04601234567890')
		expect(result.expiryDate).toBe('2028-05-31')
		expect(result.lot).toBe('ABC')
		expect(result.serial).toBe('XYZ')
	})

	it('maps AI17 day 00 to year-month', () => {
		expect(parseAi17Expiry('280500')).toBe('2028-05')
	})

	it('fails safely on malformed / unknown input', () => {
		expect(parseGs1DataMatrix('').parsed).toBe(false)
		expect(parseGs1DataMatrix('not-a-gs1').parsed).toBe(false)
		expect(parseGs1DataMatrix('(99)UNKNOWN').parsed).toBe(false)
		expect(parseAi17Expiry('999999')).toBeNull()
	})
})

describe('scan lock', () => {
	it('guards duplicate callbacks', () => {
		const lock = createScanLock(5000)
		expect(lock.tryAcquire('abc')).toBe(true)
		expect(lock.tryAcquire('abc')).toBe(false)
		expect(lock.tryAcquire('def')).toBe(false)
		lock.release()
		expect(lock.tryAcquire('def')).toBe(true)
	})
})

describe('duplicate medicine helpers', () => {
	const base: Medicine = {
		id: '1',
		householdId: 'h',
		name: 'Нурофен',
		form: 'tablet',
		strengthText: '200 мг',
		notes: null,
		photoUri: null,
		lowStockThreshold: null,
		createdAt: 'a',
		updatedAt: 'a',
		archivedAt: null,
	}

	it('detects case-insensitive name + strength match', () => {
		const matches = findLikelyDuplicateMedicines([base], {
			name: '  нурофен ',
			strengthText: '200 мг',
		})
		expect(matches).toHaveLength(1)
		expect(matches[0].reason).toBe('name_and_strength')
	})

	it('suggests by prefix while typing', () => {
		const list = findMedicineNameSuggestions([base], 'нур')
		expect(list).toHaveLength(1)
	})
})

describe('medicine codes + scan flows', () => {
	async function setup () {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		expect(getLatestSchemaVersion()).toBe(7)
		const seed = await ensureFirstRunDefaults(db)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Нурофен',
			form: 'tablet',
			strengthText: '200 мг',
		})
		return { db, seed, medicine }
	}

	it('attaches code, looks up, and stays idempotent', async () => {
		const { db, medicine } = await setup()
		const first = await attachMedicineCode(db, {
			medicineId: medicine.id,
			codeType: 'ean13',
			codeValue: '4601234567890',
		})
		expect(first.created).toBe(true)
		const second = await attachMedicineCode(db, {
			medicineId: medicine.id,
			codeType: 'ean13',
			codeValue: '4601234567890',
		})
		expect(second.created).toBe(false)
		expect(second.code.id).toBe(first.code.id)

		const found = await findMedicineCodeByValue(db, '4601234567890')
		expect(found?.medicineId).toBe(medicine.id)
	})

	it('rejects silent reassignment to another medicine', async () => {
		const { db, seed, medicine } = await setup()
		await attachMedicineCode(db, {
			medicineId: medicine.id,
			codeType: 'ean13',
			codeValue: '4601234567890',
		})
		const other = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Парацетамол',
		})
		await expect(
			attachMedicineCode(db, {
				medicineId: other.id,
				codeType: 'ean13',
				codeValue: '4601234567890',
			}),
		).rejects.toMatchObject({ name: 'CODE_CONFLICT' })
	})

	it('treats archived medicine codes as archived lookup', async () => {
		const { db, medicine } = await setup()
		await attachMedicineCode(db, {
			medicineId: medicine.id,
			codeType: 'ean13',
			codeValue: '4609999999999',
		})
		await archiveMedicine(db, medicine.id)
		const session = buildScanSession({
			rawData: '4609999999999',
			barcodeType: 'ean13',
		})
		expect(session).not.toBeNull()
		const result = await resolveScannedCode(db, session!)
		expect(result.status).toBe('archived')
	})

	it('unknown → attach → second scan finds medicine', async () => {
		const { db, medicine } = await setup()
		const session = buildScanSession({
			rawData: '4601111111111',
			barcodeType: 'ean13',
		})!
		let result = await resolveScannedCode(db, session)
		expect(result.status).toBe('unknown')

		await attachScanCodesToMedicine(db, session, medicine.id)
		result = await resolveScannedCode(db, session)
		expect(result.status).toBe('found')
		expect(result.medicine?.id).toBe(medicine.id)
	})

	it('shopping purchase with known target does not create another medicine', async () => {
		const { db, seed, medicine } = await setup()
		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 4,
			unit: 'tablet',
		})
		const added = await addMedicineToShopping(db, {
			householdId: seed.household.id,
			medicineId: medicine.id,
			unit: 'tablet',
		})
		const session = buildScanSession({
			rawData: '4602222222222',
			barcodeType: 'ean13',
			targetMedicineId: medicine.id,
			shoppingItemId: added.item.id,
		})!
		await attachScanCodesToMedicine(db, session, medicine.id)

		await markPurchasedWithBatch(db, {
			shoppingItemId: added.item.id,
			batch: {
				medicineId: medicine.id,
				cabinetId: seed.cabinet.id,
				quantity: 30,
				unit: 'tablet',
				expiryDate: session.parsed.expiryDate,
				lotNumber: session.parsed.lot,
				serialNumber: session.parsed.serial,
				scannedCodeRaw: session.scanned.rawData,
			},
		})

		await expect(
			markPurchasedWithBatch(db, {
				shoppingItemId: added.item.id,
				batch: {
					medicineId: medicine.id,
					cabinetId: seed.cabinet.id,
					quantity: 30,
					unit: 'tablet',
				},
			}),
		).rejects.toThrow('ALREADY_COMPLETED')

		const still = await getMedicineById(db, medicine.id)
		expect(still?.name).toBe('Нурофен')
		const recent = await listRecentMedicinesByBatch(db, seed.household.id)
		expect(recent.some((item) => item.id === medicine.id)).toBe(true)
	})

	it('GS1 scan session extracts expiry for batch prefill', () => {
		const session = buildScanSession({
			rawData: '(01)04601234567890(17)271201(10)L1(21)S1',
			barcodeType: 'datamatrix',
		})
		expect(session?.parsed.gtin).toBe('04601234567890')
		expect(session?.parsed.expiryDate).toBe('2027-12-01')
		expect(session?.parsed.lot).toBe('L1')
		expect(session?.codeType).toBe('gtin')
	})
})
