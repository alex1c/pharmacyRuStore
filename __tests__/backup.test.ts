import { TextEncoder } from 'util'
import JSZip from 'jszip'

import { applyMigrations, getLatestSchemaVersion } from '@/db/migrations/applyMigrations'
import { ensureFirstRunDefaults } from '@/db/seed'
import { createBatch } from '@/db/repositories/medicineBatches'
import { attachMedicineCode, findMedicineCodeByValue } from '@/db/repositories/medicineCodes'
import { createMedicine, getMedicineById } from '@/db/repositories/medicines'
import { createPerson, listPeopleByHousehold } from '@/db/repositories/people'
import {
	setDefaultLowStockThreshold,
	setExpiryWarningDays,
} from '@/db/repositories/settings'
import { createCourseWithSchedules } from '@/domain/courseService'
import {
	markOccurrenceSkipped,
	markOccurrenceTaken,
} from '@/domain/intakeService'
import {
	addCustomShoppingItem,
	markPurchasedSimple,
} from '@/domain/purchaseService'
import { syncAutomaticShoppingItems } from '@/domain/shoppingService'
import {
	createLogicalBackup,
	decodeBackupZip,
	encodeBackupZip,
	escapeCsvField,
	buildInventoryCsv,
	resetBackupOperationLockForTests,
	restoreFromBackupPackage,
	restoreFromBackupZipBytes,
	BackupValidationError,
} from '@/services/backup'
import { createBackupPackage } from '@/services/backup/snapshot'
import { createTestSqlExecutor } from './helpers/testDatabase'

function utf8 (text: string): Uint8Array {
	return new TextEncoder().encode(text)
}

describe('backup / restore / export', () => {
	beforeEach(() => {
		resetBackupOperationLockForTests()
	})

	async function buildRichDb () {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		expect(getLatestSchemaVersion()).toBe(7)
		const seed = await ensureFirstRunDefaults(db)
		await setExpiryWarningDays(db, 60)
		await setDefaultLowStockThreshold(db, 8)

		const anna = await createPerson(db, {
			householdId: seed.household.id,
			name: 'Анна',
			note: 'семья',
		})

		const nurofen = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Нурофен',
			form: 'tablet',
			strengthText: '200 мг',
			photoUri: 'file:///old/path/nurofen.jpg',
		})
		await createBatch(db, {
			medicineId: nurofen.id,
			cabinetId: seed.cabinet.id,
			quantity: 10,
			unit: 'tablet',
			expiryDate: '2028-05',
		})
		await createBatch(db, {
			medicineId: nurofen.id,
			cabinetId: seed.cabinet.id,
			quantity: 7,
			unit: 'tablet',
			expiryDate: '2027-12',
			lotNumber: 'LOT-A',
			serialNumber: 'SER-1',
			scannedCodeRaw: '(01)0460',
		})
		await attachMedicineCode(db, {
			medicineId: nurofen.id,
			codeType: 'ean13',
			codeValue: '4601234567890',
		})

		const losartan = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Лозартан',
			form: 'tablet',
			strengthText: '50 мг',
		})
		await createBatch(db, {
			medicineId: losartan.id,
			cabinetId: seed.cabinet.id,
			quantity: 4,
			unit: 'tablet',
			expiryDate: '2029-01',
		})

		const course = await createCourseWithSchedules(db, {
			course: {
				householdId: seed.household.id,
				personId: anna.id,
				medicineId: losartan.id,
				doseQuantity: 1,
				doseUnit: 'tablet',
				startDate: '2026-09-01',
				isPrn: false,
			},
			schedules: [{ type: 'daily', timeOfDay: '08:00' }],
		})

		await markOccurrenceTaken(db, {
			courseId: course.course.id,
			scheduleId: course.schedules[0].id,
			medicineId: losartan.id,
			personId: anna.id,
			scheduledDate: '2026-09-04',
			scheduledTime: '08:00',
			doseQuantity: 1,
			doseUnit: 'tablet',
		})
		await markOccurrenceSkipped(db, {
			courseId: course.course.id,
			scheduleId: course.schedules[0].id,
			medicineId: losartan.id,
			personId: anna.id,
			scheduledDate: '2026-09-03',
			scheduledTime: '08:00',
			doseQuantity: 1,
			doseUnit: 'tablet',
		})

		await syncAutomaticShoppingItems(db, seed.household.id)
		await addCustomShoppingItem(db, {
			householdId: seed.household.id,
			customName: 'Бинт',
		})
		const custom = await addCustomShoppingItem(db, {
			householdId: seed.household.id,
			customName: 'Вата',
		})
		await markPurchasedSimple(db, custom.id)

		// Fake notification ledger — must NOT be backed up.
		await db.runAsync(
			`INSERT INTO scheduled_notifications
				(id, occurrence_key, course_id, schedule_id, scheduled_date,
				 scheduled_time, native_notification_id, trigger_at, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				'notif1',
				'occ-key',
				course.course.id,
				course.schedules[0].id,
				'2026-09-10',
				'08:00',
				'native-OLD',
				'2026-09-10T05:00:00.000Z',
				'2026-09-01T00:00:00.000Z',
				'2026-09-01T00:00:00.000Z',
			],
		)

		const mediaMap = new Map<string, Uint8Array>([
			['file:///old/path/nurofen.jpg', utf8('fake-jpeg-bytes')],
		])

		return { db, seed, anna, nurofen, losartan, course, mediaMap }
	}

	it('full semantic round-trip preserves user data and remaps media', async () => {
		const { db, seed, anna, nurofen, losartan, mediaMap } = await buildRichDb()

		const batchBefore = await db.getFirstAsync<{ quantity: number }>(
			`SELECT quantity FROM medicine_batches
			 WHERE medicine_id = ? AND lot_number = 'LOT-A'`,
			[nurofen.id],
		)
		expect(batchBefore?.quantity).toBe(7)

		const { pack, warnings } = await createBackupPackage(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
			appVersion: '1.0.0',
			platform: 'test',
		})
		expect(warnings).toHaveLength(0)
		expect(pack.data.medicines.find((m) => m.id === nurofen.id)?.photo_uri)
			.toMatch(/^media:\/\/medicine\//)
		expect(
			JSON.stringify(pack.data).includes('scheduled_notifications'),
		).toBe(false)
		expect(
			pack.data.settings.find((s) => s.key === 'expiry_warning_days')?.value,
		).toBe('60')

		const zip = await encodeBackupZip(pack)
		const target = createTestSqlExecutor()
		await applyMigrations(target)
		await ensureFirstRunDefaults(target)

		const written = new Map<string, Uint8Array>()
		await restoreFromBackupZipBytes(target, zip, {
			writeMediaFile: async (fileName, bytes) => {
				const uri = `file:///restored/${fileName}`
				written.set(uri, bytes)
				return uri
			},
			afterCommit: async () => {
				await syncAutomaticShoppingItems(
					target,
					(await target.getFirstAsync<{ id: string }>(
						`SELECT id FROM households LIMIT 1`,
					))!.id,
				)
			},
		})

		const people = await listPeopleByHousehold(target, seed.household.id)
		expect(people.map((p) => p.name).sort()).toEqual(['Анна', 'Я'])
		expect(people.find((p) => p.id === anna.id)?.archivedAt).toBeNull()

		const restoredNurofen = await getMedicineById(target, nurofen.id)
		expect(restoredNurofen?.photoUri?.startsWith('file:///restored/')).toBe(
			true,
		)
		expect(restoredNurofen?.photoUri).not.toBe('file:///old/path/nurofen.jpg')
		expect(written.get(restoredNurofen!.photoUri!) ).toEqual(
			utf8('fake-jpeg-bytes'),
		)

		const code = await findMedicineCodeByValue(target, '4601234567890')
		expect(code?.medicineId).toBe(nurofen.id)

		const batchAfter = await target.getFirstAsync<{
			quantity: number
			lot_number: string | null
			serial_number: string | null
		}>(
			`SELECT quantity, lot_number, serial_number FROM medicine_batches
			 WHERE medicine_id = ? AND lot_number = 'LOT-A'`,
			[nurofen.id],
		)
		expect(batchAfter?.quantity).toBe(7)
		expect(batchAfter?.serial_number).toBe('SER-1')

		const movements = await target.getAllAsync(
			`SELECT * FROM intake_inventory_movements`,
		)
		expect(movements.length).toBeGreaterThan(0)

		const notif = await target.getAllAsync(
			`SELECT * FROM scheduled_notifications`,
		)
		expect(notif).toHaveLength(0)

		const settings = await target.getFirstAsync<{ value: string }>(
			`SELECT value FROM app_meta WHERE key = 'default_low_stock_threshold'`,
		)
		expect(settings?.value).toBe('8')

		const autoActive = await target.getAllAsync(
			`SELECT * FROM shopping_items
			 WHERE source = 'automatic' AND status = 'active' AND archived_at IS NULL`,
		)
		expect(autoActive).toHaveLength(1)
		expect(autoActive[0]).toMatchObject({ medicine_id: losartan.id })

		const completed = await target.getAllAsync(
			`SELECT * FROM shopping_items WHERE status = 'completed'`,
		)
		expect(completed.length).toBeGreaterThanOrEqual(1)
	})

	it('excludes notification ledger from backup payload', async () => {
		const { db, mediaMap } = await buildRichDb()
		const { pack } = await createBackupPackage(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
		})
		expect((pack.data as { scheduled_notifications?: unknown }).scheduled_notifications)
			.toBeUndefined()
		const count = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM scheduled_notifications`,
		)
		expect(count?.c).toBe(1)
	})

	it('does not replay movements onto batch quantities', async () => {
		const { db, nurofen, mediaMap } = await buildRichDb()
		const { pack } = await createBackupPackage(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
		})
		const target = createTestSqlExecutor()
		await applyMigrations(target)
		await ensureFirstRunDefaults(target)
		await restoreFromBackupPackage(target, pack)
		const qty = await target.getFirstAsync<{ quantity: number }>(
			`SELECT quantity FROM medicine_batches
			 WHERE medicine_id = ? AND lot_number = 'LOT-A'`,
			[nurofen.id],
		)
		expect(qty?.quantity).toBe(7)
	})

	it('missing media becomes warning and null photo', async () => {
		const { db } = await buildRichDb()
		const { pack, warnings } = await createBackupPackage(db, {
			readMediaBytes: async () => null,
		})
		expect(warnings.some((w) => w.startsWith('missing_media:'))).toBe(true)
		const photo = pack.data.medicines.find((m) => m.name === 'Нурофен')
			?.photo_uri
		expect(photo).toBeNull()
		const target = createTestSqlExecutor()
		await applyMigrations(target)
		await ensureFirstRunDefaults(target)
		await restoreFromBackupPackage(target, pack)
		const medicine = await target.getFirstAsync<{ photo_uri: string | null }>(
			`SELECT photo_uri FROM medicines WHERE name = 'Нурофен'`,
		)
		expect(medicine?.photo_uri).toBeNull()
	})

	it('rejects invalid zip before mutating DB', async () => {
		const { db } = await buildRichDb()
		const before = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM medicines`,
		)
		await expect(
			restoreFromBackupZipBytes(db, utf8('not-a-zip')),
		).rejects.toBeInstanceOf(BackupValidationError)
		const after = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM medicines`,
		)
		expect(after?.c).toBe(before?.c)
	})

	it.each(['../evil', '/absolute/path', 'media/medicine/../evil'])(
		'rejects unsafe ZIP entry %s before mutating DB',
		async (unsafePath) => {
			const { db, mediaMap } = await buildRichDb()
			const { pack } = await createBackupPackage(db, {
				readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
			})
			const zip = new JSZip()
			zip.file('manifest.json', JSON.stringify(pack.manifest))
			zip.file('data.json', JSON.stringify(pack.data))
			zip.file(unsafePath, 'malicious')
			const before = await db.getFirstAsync<{ c: number }>(
				`SELECT COUNT(*) AS c FROM medicines`,
			)

			await expect(
				restoreFromBackupZipBytes(db, await zip.generateAsync({ type: 'uint8array' })),
			).rejects.toMatchObject({ name: 'UNSAFE_MEDIA_PATH' })
			const after = await db.getFirstAsync<{ c: number }>(
				`SELECT COUNT(*) AS c FROM medicines`,
			)
			expect(after?.c).toBe(before?.c)
		},
	)

	it('rejects future formatVersion without mutation', async () => {
		const { db, mediaMap } = await buildRichDb()
		const { pack } = await createBackupPackage(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
		})
		pack.manifest.formatVersion = 999
		const before = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM medicines`,
		)
		await expect(restoreFromBackupPackage(db, pack)).rejects.toMatchObject({
			name: 'FUTURE_FORMAT',
		})
		const after = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM medicines`,
		)
		expect(after?.c).toBe(before?.c)
	})

	it('rejects malformed foreign keys before mutation', async () => {
		const { db, mediaMap } = await buildRichDb()
		const { pack } = await createBackupPackage(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
		})
		pack.data.medicine_batches.push({
			id: 'orphan-batch',
			medicine_id: 'missing-medicine',
			cabinet_id: pack.data.medicine_cabinets[0].id,
			storage_location_id: null,
			quantity: 1,
			unit: 'tablet',
			expiry_date: null,
			opened_at: null,
			after_opening_value: null,
			after_opening_unit: null,
			purchase_date: null,
			notes: null,
			lot_number: null,
			serial_number: null,
			scanned_code_raw: null,
			created_at: 'a',
			updated_at: 'a',
			archived_at: null,
		})
		const before = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM medicines`,
		)
		await expect(restoreFromBackupPackage(db, pack)).rejects.toMatchObject({
			name: 'INVALID_DATA',
		})
		const after = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM medicines`,
		)
		expect(after?.c).toBe(before?.c)
	})

	it('rolls back to previous data on mid-restore failure', async () => {
		const source = await buildRichDb()
		const { pack } = await createBackupPackage(source.db, {
			readMediaBytes: async (uri) => source.mediaMap.get(uri) ?? null,
		})

		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)
		const marker = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'MARKER-BEFORE-RESTORE',
		})

		await expect(
			restoreFromBackupPackage(db, pack, {
				failAfterInsertTable: 'households',
			}),
		).rejects.toThrow(/TEST_FAIL_AFTER_INSERT/)

		const markerStill = await getMedicineById(db, marker.id)
		expect(markerStill?.name).toBe('MARKER-BEFORE-RESTORE')
		const nurofen = await db.getFirstAsync(
			`SELECT id FROM medicines WHERE name = 'Нурофен'`,
		)
		expect(nurofen).toBeNull()
	})

	it('double restore tap: only one proceeds', async () => {
		const { db, mediaMap } = await buildRichDb()
		const { pack } = await createBackupPackage(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
		})
		const target = createTestSqlExecutor()
		await applyMigrations(target)
		await ensureFirstRunDefaults(target)

		const first = restoreFromBackupPackage(target, pack)
		const second = restoreFromBackupPackage(target, pack)
		const results = await Promise.allSettled([first, second])
		const fulfilled = results.filter((r) => r.status === 'fulfilled')
		const rejected = results.filter((r) => r.status === 'rejected')
		expect(fulfilled).toHaveLength(1)
		expect(rejected).toHaveLength(1)
		expect((rejected[0] as PromiseRejectedResult).reason?.name).toBe(
			'BACKUP_BUSY',
		)
	})

	it('shopping reconciliation after restore stays idempotent', async () => {
		const { db, mediaMap, losartan, seed } = await buildRichDb()
		await syncAutomaticShoppingItems(db, seed.household.id)
		await syncAutomaticShoppingItems(db, seed.household.id)
		const before = await db.getAllAsync(
			`SELECT * FROM shopping_items
			 WHERE medicine_id = ? AND status = 'active' AND source = 'automatic'`,
			[losartan.id],
		)
		expect(before).toHaveLength(1)

		const { pack } = await createBackupPackage(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
		})
		const target = createTestSqlExecutor()
		await applyMigrations(target)
		await ensureFirstRunDefaults(target)
		await restoreFromBackupPackage(target, pack)
		await syncAutomaticShoppingItems(target, seed.household.id)
		await syncAutomaticShoppingItems(target, seed.household.id)
		const after = await target.getAllAsync(
			`SELECT * FROM shopping_items
			 WHERE medicine_id = ? AND status = 'active' AND source = 'automatic'`,
			[losartan.id],
		)
		expect(after).toHaveLength(1)
	})

	it('archived person history survives restore', async () => {
		const { db, mediaMap, anna, seed } = await buildRichDb()
		await db.runAsync(
			`UPDATE people SET archived_at = ? WHERE id = ?`,
			['2026-09-05T00:00:00.000Z', anna.id],
		)
		const { pack } = await createBackupPackage(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
		})
		const target = createTestSqlExecutor()
		await applyMigrations(target)
		await ensureFirstRunDefaults(target)
		await restoreFromBackupPackage(target, pack)

		const person = await target.getFirstAsync<{
			archived_at: string | null
			name: string
		}>(`SELECT name, archived_at FROM people WHERE id = ?`, [anna.id])
		expect(person?.name).toBe('Анна')
		expect(person?.archived_at).toBeTruthy()
		const intakes = await target.getAllAsync(
			`SELECT * FROM intake_records WHERE person_id = ?`,
			[anna.id],
		)
		expect(intakes.length).toBeGreaterThan(0)
		expect(seed.household.id).toBeTruthy()
	})

	it('CSV escapes quotes, semicolons, newlines and uses BOM + ;', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const seed = await ensureFirstRunDefaults(db)
		const medicine = await createMedicine(db, {
			householdId: seed.household.id,
			name: 'Крем "Особый"; 5%',
			form: 'cream',
			notes: 'строка1\nстрока2',
		})
		await createBatch(db, {
			medicineId: medicine.id,
			cabinetId: seed.cabinet.id,
			quantity: 12.5,
			unit: 'g',
			expiryDate: '2028-05',
			notes: 'партия; тест',
		})
		const csv = await buildInventoryCsv(db)
		expect(csv.startsWith('\uFEFF')).toBe(true)
		expect(csv).toContain(';')
		expect(csv).toContain('"Крем ""Особый""; 5%"')
		expect(csv).toContain('12,5')
		expect(escapeCsvField('a;b')).toBe('"a;b"')
	})

	it('createLogicalBackup serializes and deserializes via ZIP', async () => {
		const { db, mediaMap } = await buildRichDb()
		const { pack } = await createLogicalBackup(db, {
			readMediaBytes: async (uri) => mediaMap.get(uri) ?? null,
			platform: 'test',
		})
		const zip = await encodeBackupZip(pack)
		const decoded = await decodeBackupZip(zip)
		expect(decoded.data.medicines).toHaveLength(pack.data.medicines.length)
		expect(decoded.manifest.format).toBe('pharmacy-backup')
	})
})
