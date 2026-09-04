import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'

import {
	Card,
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { getCabinetById } from '@/db/repositories/medicineCabinets'
import {
	archiveLocation,
	createLocation,
	listLocationsByCabinet,
	updateLocation,
} from '@/db/repositories/storageLocations'
import { StorageLocation } from '@/db/types'
import { analytics } from '@/services/analytics'

export default function CabinetLocationsScreen () {
	const { cabinetId } = useLocalSearchParams<{ cabinetId: string }>()
	const { executor } = useDatabase()
	const [cabinetName, setCabinetName] = useState('Места хранения')
	const [locations, setLocations] = useState<StorageLocation[]>([])
	const [name, setName] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		if (!cabinetId) {
			return
		}
		const cabinet = await getCabinetById(executor, cabinetId)
		if (!cabinet || cabinet.archivedAt) {
			Alert.alert('Не найдено', 'Аптечка недоступна.')
			return
		}
		setCabinetName(cabinet.name)
		setLocations(await listLocationsByCabinet(executor, cabinetId))
	}, [cabinetId, executor])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('storage_locations')
			void load()
		}, [load]),
	)

	async function handleSave () {
		if (!cabinetId) {
			return
		}
		if (!name.trim()) {
			setError('Укажите название места')
			return
		}
		setError(null)
		try {
			if (editingId) {
				await updateLocation(executor, editingId, { name })
			} else {
				await createLocation(executor, { cabinetId, name })
			}
			setName('')
			setEditingId(null)
			await load()
		} catch (err) {
			analytics.reportError(err, { source: 'LocationsScreen.save' })
			Alert.alert('Ошибка', 'Не удалось сохранить место хранения.')
		}
	}

	function handleArchive (location: StorageLocation) {
		Alert.alert(
			'Архивировать место?',
			`«${location.name}» будет скрыто. У активных упаковок место станет пустым.`,
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Архивировать',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await archiveLocation(executor, location.id)
							await load()
						})()
					},
				},
			],
		)
	}

	return (
		<Screen scroll>
			<ScreenTopBar title={cabinetName} />
			{locations.length === 0 ? (
				<Card style={styles.empty}>
					<Text style={styles.emptyText}>Мест хранения пока нет</Text>
				</Card>
			) : null}
			{locations.map((location) => (
				<Card key={location.id} style={styles.card}>
					<Text style={styles.cardTitle}>{location.name}</Text>
					<View style={styles.actions}>
						<SecondaryButton
							label="Переименовать"
							onPress={() => {
								setEditingId(location.id)
								setName(location.name)
							}}
							style={styles.actionBtn}
						/>
						<SecondaryButton
							label="Архив"
							onPress={() => handleArchive(location)}
							style={styles.actionBtn}
						/>
					</View>
				</Card>
			))}

			<TextField
				label={editingId ? 'Новое название' : 'Новое место'}
				value={name}
				onChangeText={setName}
				placeholder="Например, Бардачок"
				error={error}
			/>
			<PrimaryButton
				label={editingId ? 'Сохранить название' : 'Добавить место'}
				onPress={() => void handleSave()}
			/>
			{editingId ? (
				<SecondaryButton
					label="Отменить редактирование"
					onPress={() => {
						setEditingId(null)
						setName('')
					}}
					style={styles.cancel}
				/>
			) : null}
		</Screen>
	)
}

const styles = StyleSheet.create({
	empty: {
		marginBottom: spacing.md,
	},
	emptyText: {
		...typography.bodySmall,
		color: colors.textSecondary,
		textAlign: 'center',
	},
	card: {
		marginBottom: spacing.sm,
		gap: spacing.sm,
	},
	cardTitle: {
		...typography.section,
		color: colors.text,
	},
	actions: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	actionBtn: {
		flex: 1,
	},
	cancel: {
		marginTop: spacing.sm,
		marginBottom: spacing.xl,
	},
})
