import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'

import {
	ChoiceChip,
	ChipGroup,
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
} from '@/components/ui'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	getAppSettings,
	setMedicationRemindersEnabled,
} from '@/db/repositories/settings'
import { analytics } from '@/services/analytics'
import {
	getNotificationPermissionState,
	openNotificationSystemSettings,
	requestNotificationPermissions,
	safeSyncMedicationReminders,
	scheduleTestReminder,
	getNotificationClient,
	NotificationPermissionState,
} from '@/services/notifications'

/**
 * Reminder permission status, global toggle, and test notification.
 */
export default function RemindersSettingsScreen () {
	const { executor, seed } = useDatabase()
	const [permission, setPermission] = useState<NotificationPermissionState>({
		status: 'undetermined',
		canAskAgain: true,
	})
	const [globalOn, setGlobalOn] = useState(true)
	const [busy, setBusy] = useState(false)

	const refresh = useCallback(async () => {
		const settings = await getAppSettings(executor)
		setGlobalOn(settings.medicationRemindersEnabled)
		const state = await getNotificationPermissionState()
		setPermission(state)
	}, [executor])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('settings_reminders')
			void refresh()
		}, [refresh]),
	)

	async function handleToggleGlobal (enabled: boolean) {
		setBusy(true)
		try {
			await setMedicationRemindersEnabled(executor, enabled)
			setGlobalOn(enabled)
			await safeSyncMedicationReminders(executor, seed.household.id, {
				defaultPersonName: seed.person.name,
			})
		} catch (error) {
			analytics.reportError(error, { source: 'RemindersSettings.toggle' })
			Alert.alert('Ошибка', 'Не удалось обновить настройку.')
		} finally {
			setBusy(false)
		}
	}

	async function handleRequestPermission () {
		setBusy(true)
		try {
			const next = await requestNotificationPermissions()
			setPermission(next)
			if (next.status === 'granted') {
				await safeSyncMedicationReminders(executor, seed.household.id, {
					defaultPersonName: seed.person.name,
				})
			} else if (!next.canAskAgain) {
				Alert.alert(
					'Напоминания выключены',
					'Разрешите уведомления в системных настройках приложения.',
					[
						{ text: 'Отмена', style: 'cancel' },
						{
							text: 'Открыть настройки',
							onPress: () => {
								void openNotificationSystemSettings()
							},
						},
					],
				)
			}
		} finally {
			setBusy(false)
		}
	}

	async function handleTest () {
		setBusy(true)
		try {
			let state = await getNotificationPermissionState()
			if (state.status !== 'granted') {
				state = await requestNotificationPermissions()
				setPermission(state)
			}
			if (state.status !== 'granted') {
				Alert.alert(
					'Нужно разрешение',
					'Без разрешения на уведомления тестовое напоминание недоступно.',
				)
				return
			}
			const result = await scheduleTestReminder(getNotificationClient())
			if (result.scheduled) {
				Alert.alert(
					'Готово',
					'Тестовое напоминание запланировано примерно через 10 секунд.',
				)
			} else {
				Alert.alert('Не удалось', 'Тестовое напоминание не запланировано.')
			}
		} catch (error) {
			analytics.reportError(error, { source: 'RemindersSettings.test' })
			Alert.alert('Ошибка', 'Не удалось запланировать тестовое напоминание.')
		} finally {
			setBusy(false)
		}
	}

	const permissionLabel =
		permission.status === 'granted'
			? 'Напоминания включены'
			: 'Напоминания выключены'

	return (
		<Screen scroll>
			<ScreenTopBar title="Напоминания" />

			<Text style={styles.status}>{permissionLabel}</Text>
			<Text style={styles.hint}>
				Разрешение уведомлений:{' '}
				{permission.status === 'granted'
					? 'Включено'
					: permission.status === 'denied'
						? 'Выключено'
						: 'Не запрошено'}
			</Text>

			{permission.status !== 'granted' ? (
				<View style={styles.block}>
					{permission.canAskAgain ? (
						<PrimaryButton
							label="Разрешить уведомления"
							onPress={() => {
								void handleRequestPermission()
							}}
							disabled={busy}
						/>
					) : (
						<PrimaryButton
							label="Открыть настройки"
							onPress={() => {
								void openNotificationSystemSettings()
							}}
							disabled={busy}
						/>
					)}
				</View>
			) : null}

			<ChipGroup label="Напоминания о приёме">
				<ChoiceChip
					label="Вкл"
					selected={globalOn}
					onPress={() => {
						void handleToggleGlobal(true)
					}}
				/>
				<ChoiceChip
					label="Выкл"
					selected={!globalOn}
					onPress={() => {
						void handleToggleGlobal(false)
					}}
				/>
			</ChipGroup>

			<Text style={styles.hint}>
				При выключении курсы и экран «Сегодня» продолжают работать — только
				системные уведомления не планируются.
			</Text>

			<SecondaryButton
				label="Проверить напоминание"
				onPress={() => {
					void handleTest()
				}}
				disabled={busy}
				style={styles.testBtn}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	status: {
		...typography.section,
		marginBottom: spacing.xs,
		color: colors.text,
	},
	hint: {
		...typography.bodySmall,
		color: colors.textSecondary,
		marginBottom: spacing.md,
	},
	block: {
		marginBottom: spacing.md,
	},
	testBtn: {
		marginTop: spacing.md,
		marginBottom: spacing.xl,
	},
})
