import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import * as Notifications from 'expo-notifications'

import {
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
	SectionHeader,
	Card,
} from '@/components/ui'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { safeSyncAutomaticShoppingItems } from '@/domain/shoppingService'
import {
	BackupValidationError,
	createBackupZipBytes,
	exportInventoryCsvBytes,
	getLastBackupMeta,
	restoreFromBackupZipBytes,
} from '@/services/backup'
import {
	bestEffortDelete,
	pickBackupZipUri,
	readFileBytesFromUri,
	readLocalFileBytes,
	shareFileUri,
	writeMedicinePhotoFromBackup,
	writeTempBackupZip,
	writeTempCsv,
} from '@/services/backup/fileIo'
import { analytics } from '@/services/analytics'
import { safeSyncMedicationReminders } from '@/services/notifications'
import { formatDateRu } from '@/utils/formatRu'

/**
 * Backup / restore / CSV export — local only, replace-on-restore policy.
 */
export default function BackupScreen () {
	const { executor, refreshSeed } = useDatabase()
	const [busy, setBusy] = useState(false)
	const [lastAt, setLastAt] = useState<string | null>(null)
	const [lastName, setLastName] = useState<string | null>(null)

	const loadMeta = useCallback(async () => {
		const meta = await getLastBackupMeta(executor)
		setLastAt(meta.at)
		setLastName(meta.filename)
	}, [executor])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('backup')
			void loadMeta()
		}, [loadMeta]),
	)

	async function handleCreateBackup () {
		if (busy) {
			return
		}
		setBusy(true)
		let tempUri: string | null = null
		try {
			const result = await createBackupZipBytes(executor, {
				readMediaBytes: readLocalFileBytes,
			})
			tempUri = await writeTempBackupZip(result.filename, result.bytes)
			await shareFileUri(tempUri)
			Alert.alert(
				'Резервная копия создана',
				result.warnings.length > 0
					? `Файл готов. Предупреждений: ${result.warnings.length} (например, отсутствующие фото).`
					: 'Сохраните файл в надёжном месте. Файл не зашифрован.',
			)
			await loadMeta()
			analytics.trackEvent('backup_created', {
				warnings: result.warnings.length,
			})
		} catch (error) {
			if (error instanceof Error && error.name === 'BACKUP_BUSY') {
				Alert.alert('Подождите', 'Операция уже выполняется.')
			} else {
				analytics.reportError(error, { source: 'Backup.create' })
				Alert.alert('Ошибка', 'Не удалось создать резервную копию.')
			}
		} finally {
			if (tempUri) {
				await bestEffortDelete(tempUri)
			}
			setBusy(false)
		}
	}

	function handleRestorePress () {
		if (busy) {
			return
		}
		Alert.alert(
			'Восстановление',
			'Восстановление заменит текущие данные приложения данными из резервной копии.\n\nТекущая аптечка, история и настройки будут заменены.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Восстановить',
					style: 'destructive',
					onPress: () => {
						void runRestore()
					},
				},
			],
		)
	}

	async function runRestore () {
		setBusy(true)
		try {
			const uri = await pickBackupZipUri()
			if (!uri) {
				return
			}
			const bytes = await readFileBytesFromUri(uri)
			await restoreFromBackupZipBytes(executor, bytes, {
				writeMediaFile: writeMedicinePhotoFromBackup,
				afterCommit: async () => {
					// Drop stale native reminders; ledger was cleared with user tables.
					try {
						await Notifications.cancelAllScheduledNotificationsAsync()
					} catch {
						// Permission denied must not block restore.
					}
					const refreshed = await refreshSeed()
					await safeSyncAutomaticShoppingItems(
						executor,
						refreshed.household.id,
					)
					await safeSyncMedicationReminders(
						executor,
						refreshed.household.id,
					)
				},
			})
			Alert.alert('Данные восстановлены', 'Аптечка загружена из резервной копии.')
			analytics.trackEvent('backup_restored')
			await loadMeta()
		} catch (error) {
			if (error instanceof BackupValidationError) {
				if (error.code === 'FUTURE_FORMAT') {
					Alert.alert(
						'Новая версия',
						'Эта резервная копия создана более новой версией приложения.',
					)
				} else if (
					error.code === 'UNSUPPORTED_FORMAT' ||
					error.code === 'INVALID_MANIFEST'
				) {
					Alert.alert(
						'Неверный файл',
						'Это не резервная копия «Моей аптечки».',
					)
				} else {
					Alert.alert('Ошибка', 'Файл резервной копии повреждён или неполный.')
				}
			} else if (error instanceof Error && error.name === 'BACKUP_BUSY') {
				Alert.alert('Подождите', 'Операция уже выполняется.')
			} else {
				analytics.reportError(error, { source: 'Backup.restore' })
				Alert.alert(
					'Ошибка',
					'Не удалось восстановить данные. Текущая аптечка сохранена.',
				)
			}
		} finally {
			setBusy(false)
		}
	}

	async function handleExportCsv () {
		if (busy) {
			return
		}
		setBusy(true)
		let tempUri: string | null = null
		try {
			const result = await exportInventoryCsvBytes(executor)
			tempUri = await writeTempCsv(result.filename, result.text)
			await shareFileUri(tempUri)
			analytics.trackEvent('csv_exported')
		} catch (error) {
			analytics.reportError(error, { source: 'Backup.csv' })
			Alert.alert('Ошибка', 'Не удалось экспортировать список.')
		} finally {
			if (tempUri) {
				await bestEffortDelete(tempUri)
			}
			setBusy(false)
		}
	}

	const lastLabel =
		lastAt && lastName
			? `Последняя копия: ${formatDateRu(lastAt.slice(0, 10)) ?? lastAt} (${lastName})`
			: null

	return (
		<Screen scroll>
			<ScreenTopBar title="Резервная копия" />
			<Text style={styles.note}>
				Файл резервной копии не зашифрован. Храните его в безопасном месте.
				Приложение не загружает копии на сервер — вы сами выбираете, куда сохранить
				или отправить файл.
			</Text>

			<SectionHeader title="Создать резервную копию" />
			<Card>
				<Text style={styles.body}>
					Сохраните лекарства, историю, расписания, покупки и фотографии в один
					файл.
				</Text>
				{lastLabel ? <Text style={styles.meta}>{lastLabel}</Text> : null}
				<PrimaryButton
					label={busy ? 'Создаём резервную копию…' : 'Создать копию'}
					onPress={() => {
						void handleCreateBackup()
					}}
					disabled={busy}
					style={styles.btn}
				/>
			</Card>

			<SectionHeader title="Восстановить" />
			<Card>
				<Text style={styles.body}>
					Выберите ранее сохранённый ZIP-файл. Текущие данные будут полностью
					заменены.
				</Text>
				<PrimaryButton
					label={busy ? 'Восстанавливаем данные…' : 'Выбрать файл'}
					onPress={handleRestorePress}
					disabled={busy}
					style={styles.btn}
				/>
			</Card>

			<SectionHeader title="Экспорт списка" />
			<Card>
				<Text style={styles.body}>
					CSV-список активных упаковок для Excel (разделитель «;», UTF-8).
				</Text>
				<SecondaryButton
					label="Экспортировать CSV"
					onPress={() => {
						void handleExportCsv()
					}}
					disabled={busy}
					style={styles.btn}
				/>
			</Card>
			<View style={styles.spacer} />
		</Screen>
	)
}

const styles = StyleSheet.create({
	note: {
		...typography.caption,
		color: colors.textSecondary,
		marginBottom: spacing.md,
	},
	body: {
		...typography.bodySmall,
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	meta: {
		...typography.caption,
		color: colors.muted,
		marginBottom: spacing.sm,
	},
	btn: {
		marginTop: spacing.xs,
	},
	spacer: {
		height: spacing.xl,
	},
})
