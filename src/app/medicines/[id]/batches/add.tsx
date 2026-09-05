import { useEffect, useState } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

import {
	ChoiceChip,
	ChipGroup,
	PrimaryButton,
	Screen,
	ScreenTopBar,
	TextField,
} from '@/components/ui'
import { AFTER_OPENING_UNITS, MEDICINE_UNITS } from '@/constants/medicineUnits'
import { spacing } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { createBatch, getLatestActiveBatchPrefill } from '@/db/repositories/medicineBatches'
import { listCabinetsByHousehold } from '@/db/repositories/medicineCabinets'
import { getMedicineById } from '@/db/repositories/medicines'
import { listLocationsByCabinet } from '@/db/repositories/storageLocations'
import { markPurchasedWithBatch } from '@/domain/purchaseService'
import { attachScanCodesToMedicine } from '@/domain/scanService'
import { peekPendingScan, clearPendingScan } from '@/domain/scanSession'
import { safeSyncAutomaticShoppingItems } from '@/domain/shoppingService'
import {
	AfterOpeningUnit,
	MedicineCabinet,
	MedicineUnit,
	StorageLocation,
} from '@/db/types'
import { AnalyticsEvents, analytics } from '@/services/analytics'
import { adsService } from '@/services/ads'
import { isDateOnly } from '@/utils/dates'
import { ExpiryPrecision, getExpiryPrecision, normalizeExpiryInput } from '@/utils/expiry'
import { parseQuantityInput } from '@/utils/quantity'

export default function AddBatchScreen () {
	const {
		id,
		shoppingItemId,
		prefillExpiry,
		prefillLot,
		prefillSerial,
		scannedCodeRaw,
		attachScan,
	} = useLocalSearchParams<{
		id: string
		shoppingItemId?: string
		prefillExpiry?: string
		prefillLot?: string
		prefillSerial?: string
		scannedCodeRaw?: string
		attachScan?: string
	}>()
	const { executor, seed } = useDatabase()
	const [cabinets, setCabinets] = useState<MedicineCabinet[]>([])
	const [locations, setLocations] = useState<StorageLocation[]>([])
	const [cabinetId, setCabinetId] = useState('')
	const [locationId, setLocationId] = useState<string | null>(null)
	const [quantityText, setQuantityText] = useState('')
	const [unit, setUnit] = useState<MedicineUnit>('tablet')
	const [expiryPrecision, setExpiryPrecision] =
		useState<ExpiryPrecision>('unknown')
	const [expiryYearMonth, setExpiryYearMonth] = useState('')
	const [expiryDate, setExpiryDate] = useState('')
	const [purchaseDate, setPurchaseDate] = useState('')
	const [openedAt, setOpenedAt] = useState('')
	const [afterOpeningValue, setAfterOpeningValue] = useState('')
	const [afterOpeningUnit, setAfterOpeningUnit] =
		useState<AfterOpeningUnit>('days')
	const [notes, setNotes] = useState('')
	const [lotNumber, setLotNumber] = useState(prefillLot ?? '')
	const [serialNumber, setSerialNumber] = useState(prefillSerial ?? '')
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		analytics.trackScreen('batch_add')
		void (async () => {
			if (!id) {
				return
			}
			const medicine = await getMedicineById(executor, id)
			if (!medicine || medicine.archivedAt) {
				Alert.alert('Не найдено', 'Лекарство недоступно.')
				router.back()
				return
			}
			const nextCabinets = await listCabinetsByHousehold(
				executor,
				seed.household.id,
			)
			setCabinets(nextCabinets)

			const prefill = await getLatestActiveBatchPrefill(executor, id)
			if (prefill) {
				setCabinetId(prefill.cabinetId)
				setUnit(prefill.unit)
				setLocationId(prefill.storageLocationId)
			} else {
				if (medicine.form === 'tablet') {
					setUnit('tablet')
				} else if (medicine.form === 'capsule') {
					setUnit('capsule')
				}
				if (nextCabinets[0]) {
					setCabinetId(nextCabinets[0].id)
				}
			}

			// Prefill expiry from GS1 when available — user still reviews before save.
			if (prefillExpiry) {
				const precision = getExpiryPrecision(prefillExpiry)
				setExpiryPrecision(precision)
				if (precision === 'year-month') {
					setExpiryYearMonth(prefillExpiry)
				} else if (precision === 'date') {
					setExpiryDate(prefillExpiry)
				}
			}
		})()
	}, [executor, id, prefillExpiry, seed.household.id])

	useEffect(() => {
		if (!cabinetId) {
			return
		}
		void (async () => {
			const next = await listLocationsByCabinet(executor, cabinetId)
			setLocations(next)
			setLocationId((current) => {
				if (!current) {
					return null
				}
				return next.some((item) => item.id === current) ? current : null
			})
		})()
	}, [cabinetId, executor])

	async function handleSave () {
		if (!id) {
			return
		}
		const nextErrors: Record<string, string> = {}
		if (!cabinetId) {
			nextErrors.cabinetId = 'Выберите аптечку'
		}
		const quantity = parseQuantityInput(quantityText)
		if (quantity === null) {
			nextErrors.quantity = 'Укажите корректное количество'
		}
		let expiry: string | null = null
		if (expiryPrecision !== 'unknown') {
			expiry = normalizeExpiryInput(
				expiryPrecision,
				expiryYearMonth,
				expiryDate,
			)
			if (!expiry) {
				nextErrors.expiry = 'Проверьте формат срока годности'
			}
		}
		if (purchaseDate && !isDateOnly(purchaseDate)) {
			nextErrors.purchaseDate = 'Формат: ГГГГ-ММ-ДД'
		}
		if (openedAt && !isDateOnly(openedAt)) {
			nextErrors.openedAt = 'Формат: ГГГГ-ММ-ДД'
		}
		let afterValue: number | null = null
		if (afterOpeningValue.trim()) {
			afterValue = parseQuantityInput(afterOpeningValue)
			if (afterValue === null || afterValue <= 0) {
				nextErrors.afterOpening = 'Укажите срок после вскрытия'
			}
		}
		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0 || quantity === null) {
			return
		}

		setSaving(true)
		try {
			const session = peekPendingScan()
			if (attachScan === '1' && session) {
				try {
					await attachScanCodesToMedicine(executor, session, id)
				} catch (error) {
					if (error instanceof Error && error.name === 'CODE_CONFLICT') {
						// Code already on this or another medicine — continue pack add.
					} else {
						throw error
					}
				}
			}

			const batchInput = {
				medicineId: id,
				cabinetId,
				storageLocationId: locationId,
				quantity,
				unit,
				expiryDate: expiry,
				purchaseDate: purchaseDate || null,
				openedAt: openedAt || null,
				afterOpeningValue: afterValue,
				afterOpeningUnit: afterValue ? afterOpeningUnit : null,
				notes,
				lotNumber: lotNumber.trim() || null,
				serialNumber: serialNumber.trim() || null,
				scannedCodeRaw: scannedCodeRaw ?? session?.scanned.rawData ?? null,
			}
			if (shoppingItemId) {
				try {
					await markPurchasedWithBatch(executor, {
						shoppingItemId,
						batch: batchInput,
					})
				} catch (error) {
					if (error instanceof Error && error.message === 'ALREADY_COMPLETED') {
						Alert.alert('Уже отмечено', 'Покупка уже завершена.')
						clearPendingScan()
						router.back()
						return
					}
					throw error
				}
			} else {
				await createBatch(executor, batchInput)
				await safeSyncAutomaticShoppingItems(executor, seed.household.id)
			}
			// After successful batch persist — no medicine identifiers.
			analytics.trackEvent(AnalyticsEvents.BATCH_ADDED, {
				source: shoppingItemId
					? 'shopping'
					: attachScan === '1' || Boolean(session)
						? 'scan'
						: 'manual',
			})
			clearPendingScan()
			adsService.maybeShowInterstitial(
				shoppingItemId ? 'shopping_completed' : 'batch_saved',
			)
			router.back()
		} catch (error) {
			analytics.reportError(error, { source: 'AddBatch.save' })
			const message =
				error instanceof Error && error.name === 'LOCATION_CABINET_MISMATCH'
					? 'Место хранения должно относиться к выбранной аптечке.'
					: error instanceof Error && error.name === 'INCOMPATIBLE_UNIT'
						? 'Единица должна совпадать с другими активными упаковками этого лекарства.'
						: 'Не удалось сохранить упаковку.'
			Alert.alert('Ошибка', message)
		} finally {
			setSaving(false)
		}
	}

	return (
		<Screen scroll>
			<ScreenTopBar title="Новая упаковка" />
			<ChipGroup label="Аптечка" error={errors.cabinetId}>
				{cabinets.map((cabinet) => (
					<ChoiceChip
						key={cabinet.id}
						label={cabinet.name}
						selected={cabinetId === cabinet.id}
						onPress={() => setCabinetId(cabinet.id)}
					/>
				))}
			</ChipGroup>
			{locations.length > 0 ? (
				<ChipGroup label="Место хранения">
					<ChoiceChip
						label="Не указано"
						selected={locationId === null}
						onPress={() => setLocationId(null)}
					/>
					{locations.map((location) => (
						<ChoiceChip
							key={location.id}
							label={location.name}
							selected={locationId === location.id}
							onPress={() => setLocationId(location.id)}
						/>
					))}
				</ChipGroup>
			) : null}
			<TextField
				label="Количество"
				value={quantityText}
				onChangeText={setQuantityText}
				keyboardType="decimal-pad"
				error={errors.quantity}
			/>
			<ChipGroup label="Единица">
				{MEDICINE_UNITS.map((item) => (
					<ChoiceChip
						key={item.code}
						label={item.label}
						selected={unit === item.code}
						onPress={() => setUnit(item.code)}
					/>
				))}
			</ChipGroup>
			<ChipGroup label="Срок годности">
				{(
					[
						['unknown', 'Не указан'],
						['year-month', 'Месяц'],
						['date', 'Точная дата'],
					] as const
				).map(([value, label]) => (
					<ChoiceChip
						key={value}
						label={label}
						selected={expiryPrecision === value}
						onPress={() => setExpiryPrecision(value)}
					/>
				))}
			</ChipGroup>
			{expiryPrecision === 'year-month' ? (
				<TextField
					label="ГГГГ-ММ"
					value={expiryYearMonth}
					onChangeText={setExpiryYearMonth}
					placeholder="2028-05"
					error={errors.expiry}
				/>
			) : null}
			{expiryPrecision === 'date' ? (
				<TextField
					label="ГГГГ-ММ-ДД"
					value={expiryDate}
					onChangeText={setExpiryDate}
					placeholder="2028-05-15"
					error={errors.expiry}
				/>
			) : null}
			<TextField
				label="Дата покупки (необязательно)"
				value={purchaseDate}
				onChangeText={setPurchaseDate}
				placeholder="ГГГГ-ММ-ДД"
				error={errors.purchaseDate}
			/>
			<TextField
				label="Вскрыто (необязательно)"
				value={openedAt}
				onChangeText={setOpenedAt}
				placeholder="ГГГГ-ММ-ДД"
				error={errors.openedAt}
			/>
			<TextField
				label="Срок после вскрытия"
				value={afterOpeningValue}
				onChangeText={setAfterOpeningValue}
				keyboardType="decimal-pad"
				error={errors.afterOpening}
			/>
			{afterOpeningValue.trim() ? (
				<ChipGroup label="Единица срока после вскрытия">
					{AFTER_OPENING_UNITS.map((item) => (
						<ChoiceChip
							key={item.code}
							label={item.label}
							selected={afterOpeningUnit === item.code}
							onPress={() => setAfterOpeningUnit(item.code)}
						/>
					))}
				</ChipGroup>
			) : null}
			<TextField
				label="Серия / лот (необязательно)"
				value={lotNumber}
				onChangeText={setLotNumber}
			/>
			<TextField
				label="Серийный номер (необязательно)"
				value={serialNumber}
				onChangeText={setSerialNumber}
			/>
			<TextField
				label="Заметка"
				value={notes}
				onChangeText={setNotes}
			/>
			<PrimaryButton
				label="Сохранить"
				onPress={() => {
					void handleSave()
				}}
				disabled={saving}
				style={styles.save}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	save: {
		marginTop: spacing.md,
		marginBottom: spacing.xl,
	},
})
