import { useCallback, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

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
import {
	archiveCabinet,
	countActiveBatchesInCabinet,
	createCabinet,
	listCabinetsByHousehold,
	updateCabinet,
} from '@/db/repositories/medicineCabinets'
import { MedicineCabinet } from '@/db/types'
import { analytics } from '@/services/analytics'
import { adsService } from '@/services/ads'

/**
 * Manage home medicine cabinets (create / rename / safe archive).
 */
export default function CabinetsScreen () {
	const { executor, seed } = useDatabase()
	const [cabinets, setCabinets] = useState<MedicineCabinet[]>([])
	const [name, setName] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		const next = await listCabinetsByHousehold(executor, seed.household.id)
		setCabinets(next)
	}, [executor, seed.household.id])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('cabinets')
			void load()
		}, [load]),
	)

	async function handleSave () {
		if (!name.trim()) {
			setError('Укажите название аптечки')
			return
		}
		setError(null)
		try {
			if (editingId) {
				await updateCabinet(executor, editingId, { name })
			} else {
				await createCabinet(executor, {
					householdId: seed.household.id,
					name,
				})
			}
			setName('')
			setEditingId(null)
			await load()
			adsService.maybeShowInterstitial('storage_saved')
		} catch (err) {
			analytics.reportError(err, { source: 'CabinetsScreen.save' })
			Alert.alert('Ошибка', 'Не удалось сохранить аптечку.')
		}
	}

	function handleArchive (cabinet: MedicineCabinet) {
		void (async () => {
			const active = await countActiveBatchesInCabinet(executor, cabinet.id)
			if (active > 0) {
				Alert.alert(
					'Нельзя удалить',
					`В аптечке «${cabinet.name}» есть активные упаковки. Сначала переместите или архивируйте их.`,
				)
				return
			}
			Alert.alert(
				'Архивировать аптечку?',
				`«${cabinet.name}» исчезнет из списка.`,
				[
					{ text: 'Отмена', style: 'cancel' },
					{
						text: 'Архивировать',
						style: 'destructive',
						onPress: () => {
							void (async () => {
								await archiveCabinet(executor, cabinet.id)
								await load()
							})()
						},
					},
				],
			)
		})()
	}

	return (
		<Screen scroll>
			<ScreenTopBar title="Аптечки" />
			{cabinets.map((cabinet) => (
				<Card key={cabinet.id} style={styles.card}>
					<Pressable
						onPress={() => router.push(`/cabinets/${cabinet.id}/locations`)}
						style={styles.cardMain}
						accessibilityRole="button"
						accessibilityLabel={`Места хранения: ${cabinet.name}`}
					>
						<View style={styles.cardText}>
							<Text style={styles.cardTitle}>{cabinet.name}</Text>
							<Text style={styles.cardSubtitle}>Места хранения</Text>
						</View>
						<Ionicons name="chevron-forward" size={18} color={colors.muted} />
					</Pressable>
					<View style={styles.actions}>
						<SecondaryButton
							label="Переименовать"
							onPress={() => {
								setEditingId(cabinet.id)
								setName(cabinet.name)
							}}
							style={styles.actionBtn}
						/>
						<SecondaryButton
							label="Архив"
							onPress={() => handleArchive(cabinet)}
							style={styles.actionBtn}
						/>
					</View>
				</Card>
			))}

			<TextField
				label={editingId ? 'Новое название' : 'Новая аптечка'}
				value={name}
				onChangeText={setName}
				placeholder="Например, Автомобиль"
				error={error}
			/>
			<PrimaryButton
				label={editingId ? 'Сохранить название' : 'Создать аптечку'}
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
	card: {
		marginBottom: spacing.sm,
		gap: spacing.sm,
	},
	cardMain: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	cardText: {
		flex: 1,
		gap: 2,
	},
	cardTitle: {
		...typography.section,
		color: colors.text,
	},
	cardSubtitle: {
		...typography.bodySmall,
		color: colors.textSecondary,
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
