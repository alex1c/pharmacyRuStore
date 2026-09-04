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
import { createBatch } from '@/db/repositories/medicineBatches'
import { listCabinetsByHousehold } from '@/db/repositories/medicineCabinets'
import { getMedicineById } from '@/db/repositories/medicines'
import { listLocationsByCabinet } from '@/db/repositories/storageLocations'
import {
	AfterOpeningUnit,
	MedicineCabinet,
	MedicineUnit,
	StorageLocation,
} from '@/db/types'
import { analytics } from '@/services/analytics'
import { isDateOnly } from '@/utils/dates'
import { ExpiryPrecision, normalizeExpiryInput } from '@/utils/expiry'
import { parseQuantityInput } from '@/utils/quantity'

export default function AddBatchScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
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
			if (medicine.form === 'tablet') {
				setUnit('tablet')
			} else if (medicine.form === 'capsule') {
				setUnit('capsule')
			}
			const nextCabinets = await listCabinetsByHousehold(
				executor,
				seed.household.id,
			)
			setCabinets(nextCabinets)
			if (nextCabinets[0]) {
				setCabinetId(nextCabinets[0].id)
			}
		})()
	}, [executor, id, seed.household.id])

	useEffect(() => {
		if (!cabinetId) {
			return
		}
		void (async () => {
			const next = await listLocationsByCabinet(executor, cabinetId)
			setLocations(next)
			setLocationId(null)
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
			await createBatch(executor, {
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
			})
			router.back()
		} catch (error) {
			analytics.reportError(error, { source: 'AddBatch.save' })
			const message =
				error instanceof Error && error.name === 'LOCATION_CABINET_MISMATCH'
					? 'Место хранения должно относиться к выбранной аптечке.'
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
				<ChoiceChip
					label="Неизвестен"
					selected={expiryPrecision === 'unknown'}
					onPress={() => setExpiryPrecision('unknown')}
				/>
				<ChoiceChip
					label="Месяц и год"
					selected={expiryPrecision === 'year-month'}
					onPress={() => setExpiryPrecision('year-month')}
				/>
				<ChoiceChip
					label="Точная дата"
					selected={expiryPrecision === 'date'}
					onPress={() => setExpiryPrecision('date')}
				/>
			</ChipGroup>
			{expiryPrecision === 'year-month' ? (
				<TextField
					label="Год и месяц"
					value={expiryYearMonth}
					onChangeText={setExpiryYearMonth}
					placeholder="2028-05"
					error={errors.expiry}
				/>
			) : null}
			{expiryPrecision === 'date' ? (
				<TextField
					label="Дата"
					value={expiryDate}
					onChangeText={setExpiryDate}
					placeholder="2028-05-15"
					error={errors.expiry}
				/>
			) : null}
			<TextField
				label="Дата покупки"
				value={purchaseDate}
				onChangeText={setPurchaseDate}
				placeholder="ГГГГ-ММ-ДД"
				error={errors.purchaseDate}
			/>
			<TextField
				label="Дата вскрытия"
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
			<TextField label="Заметка" value={notes} onChangeText={setNotes} />
			<PrimaryButton
				label="Сохранить"
				onPress={() => void handleSave()}
				loading={saving}
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
