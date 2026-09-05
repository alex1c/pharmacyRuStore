import { useEffect, useMemo, useState } from 'react'
import {
	Alert,
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

import {
	ChoiceChip,
	ChipGroup,
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { MEDICINE_FORMS } from '@/constants/medicineForms'
import { MEDICINE_UNITS, AFTER_OPENING_UNITS } from '@/constants/medicineUnits'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { listCabinetsByHousehold } from '@/db/repositories/medicineCabinets'
import { createMedicineWithFirstBatch } from '@/db/repositories/inventory'
import { listMedicines } from '@/db/repositories/medicines'
import { listLocationsByCabinet } from '@/db/repositories/storageLocations'
import {
	findLikelyDuplicateMedicines,
	findMedicineNameSuggestions,
} from '@/domain/duplicateMedicine'
import { markPurchasedSimple } from '@/domain/purchaseService'
import { listRecentMedicinesByBatch } from '@/domain/recentMedicines'
import { attachScanCodesToMedicine } from '@/domain/scanService'
import { clearPendingScan, peekPendingScan } from '@/domain/scanSession'
import { safeSyncAutomaticShoppingItems } from '@/domain/shoppingService'
import {
	AfterOpeningUnit,
	Medicine,
	MedicineCabinet,
	MedicineForm,
	MedicineUnit,
	StorageLocation,
} from '@/db/types'
import { pickAndStoreMedicinePhoto } from '@/services/medicineMedia'
import { AnalyticsEvents, analytics } from '@/services/analytics'
import { adsService } from '@/services/ads'
import {
	ExpiryPrecision,
	getExpiryPrecision,
	normalizeExpiryInput,
} from '@/utils/expiry'
import { parseQuantityInput } from '@/utils/quantity'
import { isDateOnly } from '@/utils/dates'

/**
 * Add medicine + first pack in one short flow.
 */
export default function AddMedicineScreen () {
	const params = useLocalSearchParams<{
		prefillName?: string
		shoppingItemId?: string
		attachScan?: string
		prefillExpiry?: string
		prefillLot?: string
		prefillSerial?: string
		scannedCodeRaw?: string
	}>()
	const { executor, seed } = useDatabase()
	const [cabinets, setCabinets] = useState<MedicineCabinet[]>([])
	const [locations, setLocations] = useState<StorageLocation[]>([])
	const [allMedicines, setAllMedicines] = useState<Medicine[]>([])
	const [recent, setRecent] = useState<Medicine[]>([])
	const [saving, setSaving] = useState(false)

	const [name, setName] = useState(params.prefillName ?? '')
	const [form, setForm] = useState<MedicineForm>('tablet')
	const [strengthText, setStrengthText] = useState('')
	const [notes, setNotes] = useState('')
	const [photoUri, setPhotoUri] = useState<string | null>(null)

	const [cabinetId, setCabinetId] = useState<string>('')
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
	const [batchNotes, setBatchNotes] = useState('')
	const [lotNumber, setLotNumber] = useState(params.prefillLot ?? '')
	const [serialNumber, setSerialNumber] = useState(params.prefillSerial ?? '')

	const [errors, setErrors] = useState<Record<string, string>>({})

	useEffect(() => {
		analytics.trackScreen('medicine_add')
		void (async () => {
			const next = await listCabinetsByHousehold(executor, seed.household.id)
			setCabinets(next)
			if (next[0]) {
				setCabinetId(next[0].id)
			}
			const medicines = await listMedicines(executor, {
				householdId: seed.household.id,
			})
			setAllMedicines(medicines.filter((item) => !item.archivedAt))
			setRecent(await listRecentMedicinesByBatch(executor, seed.household.id))

			if (params.prefillExpiry) {
				const precision = getExpiryPrecision(params.prefillExpiry)
				setExpiryPrecision(precision)
				if (precision === 'year-month') {
					setExpiryYearMonth(params.prefillExpiry)
				} else if (precision === 'date') {
					setExpiryDate(params.prefillExpiry)
				}
			}
		})()
	}, [executor, params.prefillExpiry, seed.household.id])

	useEffect(() => {
		if (!cabinetId) {
			return
		}
		let cancelled = false
		void (async () => {
			const next = await listLocationsByCabinet(executor, cabinetId)
			if (!cancelled) {
				setLocations(next)
				setLocationId(null)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [cabinetId, executor])

	const canSave = useMemo(() => name.trim().length > 0, [name])
	const suggestions = useMemo(
		() => findMedicineNameSuggestions(allMedicines, name),
		[allMedicines, name],
	)

	async function handlePickPhoto () {
		try {
			const uri = await pickAndStoreMedicinePhoto()
			if (uri) {
				setPhotoUri(uri)
			}
		} catch (error) {
			analytics.reportError(error, { source: 'AddMedicine.photo' })
			Alert.alert('Ошибка', 'Не удалось сохранить фото.')
		}
	}

	async function persistNewMedicine () {
		const nextErrors: Record<string, string> = {}
		if (!name.trim()) {
			nextErrors.name = 'Укажите название'
		}
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
				nextErrors.expiry =
					expiryPrecision === 'year-month'
						? 'Формат: ГГГГ-ММ, например 2028-05'
						: 'Формат: ГГГГ-ММ-ДД, например 2028-05-15'
			}
		}

		if (purchaseDate && !isDateOnly(purchaseDate)) {
			nextErrors.purchaseDate = 'Формат даты: ГГГГ-ММ-ДД'
		}
		if (openedAt && !isDateOnly(openedAt)) {
			nextErrors.openedAt = 'Формат даты: ГГГГ-ММ-ДД'
		}

		let afterValue: number | null = null
		if (afterOpeningValue.trim() || openedAt) {
			if (afterOpeningValue.trim()) {
				afterValue = parseQuantityInput(afterOpeningValue)
				if (afterValue === null || afterValue <= 0) {
					nextErrors.afterOpening = 'Укажите срок после вскрытия'
				}
			}
		}

		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0 || quantity === null) {
			return
		}

		setSaving(true)
		try {
			const session = peekPendingScan()
			const result = await createMedicineWithFirstBatch(
				executor,
				{
					householdId: seed.household.id,
					name,
					form,
					strengthText,
					notes,
					photoUri,
				},
				{
					cabinetId,
					storageLocationId: locationId,
					quantity,
					unit,
					expiryDate: expiry,
					purchaseDate: purchaseDate || null,
					openedAt: openedAt || null,
					afterOpeningValue: afterValue,
					afterOpeningUnit: afterValue ? afterOpeningUnit : null,
					notes: batchNotes,
					lotNumber: lotNumber.trim() || null,
					serialNumber: serialNumber.trim() || null,
					scannedCodeRaw:
						params.scannedCodeRaw || session?.scanned.rawData || null,
				},
			)

			if (params.attachScan === '1' && session) {
				try {
					await attachScanCodesToMedicine(
						executor,
						session,
						result.medicine.id,
					)
				} catch (error) {
					if (!(error instanceof Error && error.name === 'CODE_CONFLICT')) {
						throw error
					}
				}
			}

			// After successful persist only — never include medicine name / codes.
			analytics.trackEvent(AnalyticsEvents.MEDICINE_CREATED, {
				source: params.attachScan === '1' || Boolean(session) ? 'scan' : 'manual',
			})
			if (params.shoppingItemId) {
				await markPurchasedSimple(executor, params.shoppingItemId)
			}
			await safeSyncAutomaticShoppingItems(executor, seed.household.id)
			clearPendingScan()
			adsService.maybeShowInterstitial('medicine_saved')
			router.replace(`/medicines/${result.medicine.id}`)
		} catch (error) {
			analytics.reportError(error, { source: 'AddMedicine.save' })
			Alert.alert('Ошибка', 'Не удалось сохранить лекарство.')
		} finally {
			setSaving(false)
		}
	}

	async function handleSave () {
		const duplicates = findLikelyDuplicateMedicines(allMedicines, {
			name,
			strengthText,
		})
		if (duplicates.length > 0) {
			const first = duplicates[0].medicine
			Alert.alert(
				'Похожее лекарство уже есть',
				first.strengthText
					? `${first.name} · ${first.strengthText}`
					: first.name,
				[
					{ text: 'Отмена', style: 'cancel' },
					{
						text: 'Добавить упаковку',
						onPress: () => {
							router.replace(`/medicines/${first.id}/batches/add`)
						},
					},
					{
						text: 'Всё равно создать',
						onPress: () => {
							void persistNewMedicine()
						},
					},
				],
			)
			return
		}
		await persistNewMedicine()
	}

	return (
		<Screen scroll>
			<ScreenTopBar title="Новое лекарство" />
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.scrollWrap}>
					{recent.length > 0 ? (
						<>
							<Text style={styles.section}>Недавние лекарства</Text>
							{recent.map((medicine) => (
								<Pressable
									key={medicine.id}
									onPress={() => {
										router.replace(`/medicines/${medicine.id}/batches/add`)
									}}
									style={styles.recentRow}
								>
									<Text style={styles.recentTitle}>{medicine.name}</Text>
									<Text style={styles.recentMeta}>Добавить упаковку</Text>
								</Pressable>
							))}
						</>
					) : null}

					<Text style={styles.section}>Лекарство</Text>
					<TextField
						label="Название"
						value={name}
						onChangeText={setName}
						placeholder="Например, Нурофен"
						error={errors.name}
						autoFocus
					/>
					{suggestions.length > 0 ? (
						<View style={styles.suggestBox}>
							<Text style={styles.suggestTitle}>
								Возможно, это уже есть в аптечке
							</Text>
							{suggestions.map((medicine) => (
								<SecondaryButton
									key={medicine.id}
									label={`Добавить упаковку · ${medicine.name}`}
									onPress={() => {
										router.replace(`/medicines/${medicine.id}/batches/add`)
									}}
									style={styles.suggestBtn}
								/>
							))}
						</View>
					) : null}
					<ChipGroup label="Форма">
						{MEDICINE_FORMS.map((item) => (
							<ChoiceChip
								key={item.code}
								label={item.label}
								selected={form === item.code}
								onPress={() => setForm(item.code)}
							/>
						))}
					</ChipGroup>
					<TextField
						label="Дозировка / концентрация"
						value={strengthText}
						onChangeText={setStrengthText}
						placeholder="200 мг"
					/>
					<TextField
						label="Заметка"
						value={notes}
						onChangeText={setNotes}
						placeholder="Необязательно"
						multiline
					/>
					<View style={styles.photoBlock}>
						{photoUri ? (
							<Image source={{ uri: photoUri }} style={styles.photo} />
						) : null}
						<SecondaryButton
							label={photoUri ? 'Изменить фото' : 'Добавить фото'}
							onPress={() => void handlePickPhoto()}
						/>
					</View>

					<Text style={styles.section}>Первая упаковка</Text>
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
						placeholder="20 или 12,5"
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
						placeholder="30"
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
					<TextField
						label="Серия / лот"
						value={lotNumber}
						onChangeText={setLotNumber}
						placeholder="Необязательно"
					/>
					<TextField
						label="Серийный номер"
						value={serialNumber}
						onChangeText={setSerialNumber}
						placeholder="Необязательно"
					/>
					<TextField
						label="Заметка к упаковке"
						value={batchNotes}
						onChangeText={setBatchNotes}
						placeholder="Необязательно"
					/>
					<PrimaryButton
						label="Сохранить"
						onPress={() => void handleSave()}
						loading={saving}
						disabled={!canSave || saving}
						style={styles.save}
					/>
				</View>
			</KeyboardAvoidingView>
		</Screen>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	scrollWrap: {
		paddingBottom: spacing.xxl,
	},
	section: {
		...typography.section,
		marginTop: spacing.md,
		marginBottom: spacing.sm,
		color: colors.text,
	},
	photoBlock: {
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	photo: {
		width: 96,
		height: 96,
		borderRadius: radii.md,
		backgroundColor: colors.surfaceMuted,
	},
	save: {
		marginTop: spacing.md,
		marginBottom: spacing.xl,
	},
	recentRow: {
		paddingVertical: spacing.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	recentTitle: {
		...typography.body,
		color: colors.text,
		fontWeight: '600',
	},
	recentMeta: {
		...typography.caption,
		color: colors.textSecondary,
	},
	suggestBox: {
		marginBottom: spacing.md,
		gap: spacing.xs,
	},
	suggestTitle: {
		...typography.caption,
		color: colors.textSecondary,
		marginBottom: spacing.xs,
	},
	suggestBtn: {
		alignSelf: 'stretch',
	},
})
