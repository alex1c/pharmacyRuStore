import {
	getAfterOpeningExpiryDate,
	getBatchEffectiveExpiry,
	getBatchExpiryStatus,
} from '@/domain/batchExpiry'
import {
	buildMedicineAttentionState,
	getMedicineInventorySummary,
} from '@/domain/medicineSummary'
import { getMedicineStockStatus } from '@/domain/stockStatus'
import {
	lastDayOfMonth,
	expiryValueToEndDate,
	addAfterOpeningDuration,
} from '@/utils/calendarDates'
import { applyMigrations, getLatestSchemaVersion } from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import { archiveBatch, createBatch } from '@/db/repositories/medicineBatches'
import { createMedicine, getMedicineSummary } from '@/db/repositories/medicines'
import {
	ensureAppSettings,
	getAppSettings,
} from '@/db/repositories/settings'
import { Medicine, MedicineBatch } from '@/db/types'
import { createTestSqlExecutor } from './helpers/testDatabase'

function makeMedicine (overrides: Partial<Medicine> = {}): Medicine {
	return {
		id: 'med1',
		householdId: 'hh',
		name: 'Тест',
		form: 'tablet',
		strengthText: null,
		notes: null,
		photoUri: null,
		lowStockThreshold: null,
		createdAt: 'a',
		updatedAt: 'a',
		archivedAt: null,
		...overrides,
	}
}

function makeBatch (overrides: Partial<MedicineBatch> = {}): MedicineBatch {
	return {
		id: 'b1',
		medicineId: 'med1',
		cabinetId: 'c1',
		storageLocationId: null,
		quantity: 10,
		unit: 'tablet',
		expiryDate: null,
		openedAt: null,
		afterOpeningValue: null,
		afterOpeningUnit: null,
		purchaseDate: null,
		notes: null,
		lotNumber: null,
		serialNumber: null,
		scannedCodeRaw: null,
		createdAt: 'a',
		updatedAt: 'a',
		archivedAt: null,
		...overrides,
	}
}

describe('calendar expiry helpers', () => {
	it('maps YYYY-MM to last day of month including leap February', () => {
		expect(lastDayOfMonth(2028, 5)).toBe('2028-05-31')
		expect(lastDayOfMonth(2024, 2)).toBe('2024-02-29')
		expect(lastDayOfMonth(2025, 2)).toBe('2025-02-28')
		expect(expiryValueToEndDate('2028-05')).toBe('2028-05-31')
		expect(expiryValueToEndDate('2028-05-15')).toBe('2028-05-15')
	})

	it('adds after-opening durations', () => {
		expect(addAfterOpeningDuration('2026-09-01', 30, 'days')).toBe('2026-10-01')
		expect(addAfterOpeningDuration('2026-09-01', 6, 'months')).toBe('2027-03-01')
	})
})

describe('batch expiry status', () => {
	const today = '2026-09-15'

	it('classifies exact dates', () => {
		expect(
			getBatchExpiryStatus(makeBatch({ expiryDate: '2026-09-01' }), {
				warningDays: 30,
				today,
			}).status,
		).toBe('expired')

		expect(
			getBatchExpiryStatus(makeBatch({ expiryDate: '2026-09-20' }), {
				warningDays: 30,
				today,
			}).status,
		).toBe('expiring_soon')

		expect(
			getBatchExpiryStatus(makeBatch({ expiryDate: '2027-01-01' }), {
				warningDays: 30,
				today,
			}).status,
		).toBe('ok')

		expect(
			getBatchExpiryStatus(makeBatch({ expiryDate: null }), {
				warningDays: 30,
				today,
			}).status,
		).toBe('unknown')
	})

	it('treats YYYY-MM as valid through month end', () => {
		expect(expiryValueToEndDate('2026-09')).toBe('2026-09-30')
		// Last day is still not expired, but within the warning window.
		expect(
			getBatchExpiryStatus(makeBatch({ expiryDate: '2026-09' }), {
				warningDays: 30,
				today: '2026-09-30',
			}).status,
		).toBe('expiring_soon')
		expect(
			getBatchExpiryStatus(makeBatch({ expiryDate: '2026-09' }), {
				warningDays: 30,
				today: '2026-10-01',
			}).status,
		).toBe('expired')
	})

	it('uses earlier of package and after-opening expiry', () => {
		const batch = makeBatch({
			expiryDate: '2028-12',
			openedAt: '2026-09-01',
			afterOpeningValue: 30,
			afterOpeningUnit: 'days',
		})
		expect(getAfterOpeningExpiryDate(batch)).toBe('2026-10-01')
		const effective = getBatchEffectiveExpiry(batch)
		expect(effective?.date).toBe('2026-10-01')
		expect(effective?.source).toBe('after_opening')

		const packageEarlier = makeBatch({
			expiryDate: '2026-09-20',
			openedAt: '2026-09-01',
			afterOpeningValue: 60,
			afterOpeningUnit: 'days',
		})
		expect(getBatchEffectiveExpiry(packageEarlier)?.source).toBe('package')
		expect(getBatchEffectiveExpiry(packageEarlier)?.date).toBe('2026-09-20')
	})

	it('ignores after-opening without openedAt or value', () => {
		expect(
			getAfterOpeningExpiryDate(
				makeBatch({ afterOpeningValue: 30, afterOpeningUnit: 'days' }),
			),
		).toBeNull()
		expect(
			getAfterOpeningExpiryDate(
				makeBatch({ openedAt: '2026-09-01', afterOpeningUnit: 'days' }),
			),
		).toBeNull()
	})
})

describe('stock status', () => {
	it('applies empty / low / in_stock with equal-threshold policy', () => {
		expect(getMedicineStockStatus(0, 5)).toBe('empty')
		expect(getMedicineStockStatus(4, 5)).toBe('low')
		expect(getMedicineStockStatus(5, 5)).toBe('in_stock')
		expect(getMedicineStockStatus(6, 5)).toBe('in_stock')
	})
})

describe('medicine inventory summary and attention', () => {
	it('builds summary and suppresses duplicate attention', () => {
		const medicine = makeMedicine({ name: 'Нурофен', lowStockThreshold: 5 })
		const batches = [
			makeBatch({
				id: '1',
				quantity: 4,
				expiryDate: '2026-09',
			}),
			makeBatch({
				id: '2',
				quantity: 20,
				expiryDate: '2028-05',
			}),
		]

		const summary = getMedicineInventorySummary({
			medicine,
			batches,
			settings: { expiryWarningDays: 30, defaultLowStockThreshold: 5 },
			today: '2026-09-15',
		})

		expect(summary.totalQuantity).toBe(24)
		expect(summary.expiryStatus).toBe('expiring_soon')
		expect(summary.attentionKind).toBe('expiring_soon')
		expect(buildMedicineAttentionState(summary)?.kind).toBe('expiring_soon')
	})

	it('lets expired outrank low stock', () => {
		const summary = getMedicineInventorySummary({
			medicine: makeMedicine({ lowStockThreshold: 10 }),
			batches: [
				makeBatch({ quantity: 2, expiryDate: '2026-08' }),
			],
			settings: { expiryWarningDays: 30, defaultLowStockThreshold: 5 },
			today: '2026-09-15',
		})
		expect(summary.stockStatus).toBe('low')
		expect(summary.attentionKind).toBe('expired')
	})

	it('lets empty outrank expiring soon', () => {
		const summary = getMedicineInventorySummary({
			medicine: makeMedicine(),
			batches: [makeBatch({ quantity: 0, expiryDate: '2026-09-20' })],
			settings: { expiryWarningDays: 30, defaultLowStockThreshold: 5 },
			today: '2026-09-15',
		})
		expect(summary.attentionKind).toBe('empty')
	})

	it('ignores archived batches', () => {
		const summary = getMedicineInventorySummary({
			medicine: makeMedicine(),
			batches: [
				makeBatch({
					id: '1',
					quantity: 4,
					expiryDate: '2026-08',
					archivedAt: 'x',
				}),
				makeBatch({
					id: '2',
					quantity: 20,
					expiryDate: '2028-05',
				}),
			],
			settings: { expiryWarningDays: 30, defaultLowStockThreshold: 5 },
			today: '2026-09-15',
		})
		expect(summary.totalQuantity).toBe(20)
		expect(summary.attentionKind).toBeNull()
	})

	it('uses custom medicine threshold over global', () => {
		const summary = getMedicineInventorySummary({
			medicine: makeMedicine({ lowStockThreshold: 3 }),
			batches: [makeBatch({ quantity: 4, expiryDate: '2028-05' })],
			settings: { expiryWarningDays: 30, defaultLowStockThreshold: 5 },
			today: '2026-09-15',
		})
		expect(summary.stockStatus).toBe('in_stock')
		expect(summary.lowStockThreshold).toBe(3)
	})
})

describe('schema v3 and unit policy', () => {
	it('migrates to v3 and seeds settings', async () => {
		const db = createTestSqlExecutor()
		const version = await applyMigrations(db)
		expect(version).toBe(7)
		expect(getLatestSchemaVersion()).toBe(7)
		await ensureFirstRunDefaults(db)
		await ensureAppSettings(db)
		const settings = await getAppSettings(db)
		expect(settings.expiryWarningDays).toBe(30)
		expect(settings.defaultLowStockThreshold).toBe(5)
	})

	it('rejects incompatible active units', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Нурофен',
			form: 'tablet',
		})
		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 10,
			unit: 'tablet',
		})
		await expect(
			createBatch(db, {
				medicineId: medicine.id,
				cabinetId: seed.cabinet.id,
				quantity: 20,
				unit: 'ml',
			}),
		).rejects.toMatchObject({ name: 'INCOMPATIBLE_UNIT' })
	})

	it('recalculates summary after archive', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		await ensureAppSettings(db)
		const seed = await ensureFirstRunDefaults(db)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Нурофен',
			form: 'tablet',
		})
		const first = await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 4,
			unit: 'tablet',
			expiryDate: '2026-09',
		})
		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 20,
			unit: 'tablet',
			expiryDate: '2028-05',
		})

		await archiveBatch(db, first.id)
		const summary = await getMedicineSummary(db, medicine.id)
		expect(summary?.totalQuantity).toBe(20)
		expect(summary?.nearestExpiry).toBe('2028-05')
	})
})
