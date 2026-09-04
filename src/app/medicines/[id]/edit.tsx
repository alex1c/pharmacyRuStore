import { useEffect, useState } from 'react'
import { Alert, Image, StyleSheet, View } from 'react-native'
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
import { colors, radii, spacing } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	getMedicineById,
	updateMedicine,
} from '@/db/repositories/medicines'
import { getAppSettings } from '@/db/repositories/settings'
import { MedicineForm } from '@/db/types'
import { pickAndStoreMedicinePhoto } from '@/services/medicineMedia'
import { analytics } from '@/services/analytics'
import { parseQuantityInput } from '@/utils/quantity'

export default function EditMedicineScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const [name, setName] = useState('')
	const [form, setForm] = useState<MedicineForm>('other')
	const [strengthText, setStrengthText] = useState('')
	const [notes, setNotes] = useState('')
	const [photoUri, setPhotoUri] = useState<string | null>(null)
	const [lowStockText, setLowStockText] = useState('')
	const [defaultLowStock, setDefaultLowStock] = useState(5)
	const [nameError, setNameError] = useState<string | null>(null)
	const [thresholdError, setThresholdError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		analytics.trackScreen('medicine_edit')
		if (!id) {
			return
		}
		void (async () => {
			const settings = await getAppSettings(executor)
			setDefaultLowStock(settings.defaultLowStockThreshold)
			const medicine = await getMedicineById(executor, id)
			if (!medicine || medicine.archivedAt) {
				Alert.alert('Не найдено', 'Лекарство недоступно.')
				router.back()
				return
			}
			setName(medicine.name)
			setForm(medicine.form)
			setStrengthText(medicine.strengthText ?? '')
			setNotes(medicine.notes ?? '')
			setPhotoUri(medicine.photoUri)
			setLowStockText(
				medicine.lowStockThreshold === null
					? ''
					: String(medicine.lowStockThreshold),
			)
		})()
	}, [executor, id])

	async function handleSave () {
		if (!id) {
			return
		}
		if (!name.trim()) {
			setNameError('Укажите название')
			return
		}
		setNameError(null)

		let lowStockThreshold: number | null = null
		if (lowStockText.trim()) {
			const parsed = parseQuantityInput(lowStockText)
			if (parsed === null) {
				setThresholdError('Укажите корректное число')
				return
			}
			lowStockThreshold = parsed
		}
		setThresholdError(null)

		setSaving(true)
		try {
			await updateMedicine(executor, id, {
				name,
				form,
				strengthText,
				notes,
				photoUri,
				lowStockThreshold,
			})
			router.back()
		} catch (error) {
			analytics.reportError(error, { source: 'EditMedicine.save' })
			Alert.alert('Ошибка', 'Не удалось сохранить изменения.')
		} finally {
			setSaving(false)
		}
	}

	return (
		<Screen scroll>
			<ScreenTopBar title="Изменить лекарство" />
			<TextField
				label="Название"
				value={name}
				onChangeText={setName}
				error={nameError}
			/>
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
			/>
			<TextField
				label="Заметка"
				value={notes}
				onChangeText={setNotes}
				multiline
			/>
			<TextField
				label="Предупреждать, если осталось меньше"
				value={lowStockText}
				onChangeText={setLowStockText}
				placeholder={`По умолчанию: ${defaultLowStock}`}
				keyboardType="decimal-pad"
				hint="Оставьте пустым, чтобы использовать общий порог"
				error={thresholdError}
			/>
			<View style={styles.photoBlock}>
				{photoUri ? (
					<Image source={{ uri: photoUri }} style={styles.photo} />
				) : null}
				<SecondaryButton
					label={photoUri ? 'Изменить фото' : 'Добавить фото'}
					onPress={() => {
						void (async () => {
							const uri = await pickAndStoreMedicinePhoto()
							if (uri) {
								setPhotoUri(uri)
							}
						})()
					}}
				/>
			</View>
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
		marginBottom: spacing.xl,
	},
})
