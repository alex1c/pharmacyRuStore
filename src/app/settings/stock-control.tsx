import { useCallback, useState } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'

import {
	ChoiceChip,
	ChipGroup,
	PrimaryButton,
	Screen,
	ScreenTopBar,
	TextField,
} from '@/components/ui'
import { spacing } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	EXPIRY_WARNING_PRESETS,
	getAppSettings,
	setDefaultLowStockThreshold,
	setExpiryWarningDays,
} from '@/db/repositories/settings'
import { analytics } from '@/services/analytics'
import { parseQuantityInput } from '@/utils/quantity'

/**
 * Stock/expiry monitoring settings.
 */
export default function StockControlSettingsScreen () {
	const { executor } = useDatabase()
	const [warningDays, setWarningDays] = useState(30)
	const [lowStockText, setLowStockText] = useState('5')
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('settings_stock')
			void (async () => {
				const settings = await getAppSettings(executor)
				setWarningDays(settings.expiryWarningDays)
				setLowStockText(String(settings.defaultLowStockThreshold))
			})()
		}, [executor]),
	)

	async function handleSave () {
		const parsed = parseQuantityInput(lowStockText)
		if (parsed === null) {
			setError('Укажите корректный порог остатка')
			return
		}
		setError(null)
		setSaving(true)
		try {
			await setExpiryWarningDays(executor, warningDays)
			await setDefaultLowStockThreshold(executor, parsed)
			Alert.alert('Сохранено', 'Настройки контроля запасов обновлены.')
		} catch (err) {
			analytics.reportError(err, { source: 'StockSettings.save' })
			Alert.alert('Ошибка', 'Не удалось сохранить настройки.')
		} finally {
			setSaving(false)
		}
	}

	return (
		<Screen scroll>
			<ScreenTopBar title="Контроль запасов" />
			<ChipGroup label="Предупреждать о сроке за">
				{EXPIRY_WARNING_PRESETS.map((days) => (
					<ChoiceChip
						key={days}
						label={`${days} дн.`}
						selected={warningDays === days}
						onPress={() => setWarningDays(days)}
					/>
				))}
			</ChipGroup>
			<TextField
				label="Считать низким остатком"
				value={lowStockText}
				onChangeText={setLowStockText}
				keyboardType="decimal-pad"
				hint="Единиц лекарства по умолчанию"
				error={error}
			/>
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
