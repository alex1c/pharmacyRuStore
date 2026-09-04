import { useCallback, useState } from 'react'
import {
	Alert,
	Image,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'

import {
	Card,
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
	SectionHeader,
} from '@/components/ui'
import { getMedicineFormLabel } from '@/constants/medicineForms'
import {
	getAfterOpeningUnitLabel,
	getMedicineUnitShortLabel,
} from '@/constants/medicineUnits'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { listBatchesForMedicine } from '@/db/repositories/medicineBatches'
import { getCabinetById } from '@/db/repositories/medicineCabinets'
import {
	archiveMedicine,
	getMedicineSummary,
} from '@/db/repositories/medicines'
import { getLocationById } from '@/db/repositories/storageLocations'
import { MedicineBatch, MedicineSummary } from '@/db/types'
import { analytics } from '@/services/analytics'
import { formatExpiryUntilLabel } from '@/utils/expiry'
import { formatQuantityWithUnit } from '@/utils/quantity'

interface BatchView extends MedicineBatch {
	cabinetName: string
	locationName: string | null
}

/**
 * Medicine detail with packs (batches) list.
 */
export default function MedicineDetailScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const [summary, setSummary] = useState<MedicineSummary | null>(null)
	const [batches, setBatches] = useState<BatchView[]>([])

	const load = useCallback(async () => {
		if (!id) {
			return
		}
		const nextSummary = await getMedicineSummary(executor, id)
		if (!nextSummary) {
			Alert.alert('Не найдено', 'Лекарство недоступно.', [
				{ text: 'OK', onPress: () => router.replace('/(tabs)/cabinet') },
			])
			return
		}
		const nextBatches = await listBatchesForMedicine(executor, id)
		const enriched: BatchView[] = []
		for (const batch of nextBatches) {
			const cabinet = await getCabinetById(executor, batch.cabinetId)
			const location = batch.storageLocationId
				? await getLocationById(executor, batch.storageLocationId)
				: null
			enriched.push({
				...batch,
				cabinetName: cabinet?.name ?? 'Аптечка',
				locationName: location?.name ?? null,
			})
		}
		setSummary(nextSummary)
		setBatches(enriched)
	}, [executor, id])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('medicine_detail')
			void load()
		}, [load]),
	)

	function handleArchiveMedicine () {
		Alert.alert(
			'Архивировать лекарство?',
			'Оно исчезнет из активной аптечки вместе с упаковками.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Архивировать',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							if (!id) {
								return
							}
							await archiveMedicine(executor, id)
							router.replace('/(tabs)/cabinet')
						})()
					},
				},
			],
		)
	}

	if (!summary) {
		return (
			<Screen>
				<ScreenTopBar title="Лекарство" />
			</Screen>
		)
	}

	const unitLabel = summary.unit
		? getMedicineUnitShortLabel(summary.unit)
		: ''
	const totalLabel = formatQuantityWithUnit(summary.totalQuantity, unitLabel)
	const formLabel = getMedicineFormLabel(summary.medicine.form)
	const meta = [summary.medicine.strengthText, formLabel.toLowerCase()]
		.filter(Boolean)
		.join(' · ')

	return (
		<Screen scroll>
			<ScreenTopBar title={summary.medicine.name} />
			<View style={styles.hero}>
				{summary.medicine.photoUri ? (
					<Image
						source={{ uri: summary.medicine.photoUri }}
						style={styles.photo}
					/>
				) : null}
				<Text style={styles.title}>{summary.medicine.name}</Text>
				{meta ? <Text style={styles.meta}>{meta}</Text> : null}
				<Text style={styles.total}>Всего: {totalLabel}</Text>
				{summary.medicine.notes ? (
					<Text style={styles.notes}>{summary.medicine.notes}</Text>
				) : null}
			</View>

			<View style={styles.actions}>
				<SecondaryButton
					label="Изменить"
					onPress={() => router.push(`/medicines/${id}/edit`)}
				/>
				<SecondaryButton
					label="В архив"
					onPress={handleArchiveMedicine}
				/>
			</View>

			<SectionHeader title="Упаковки" />
			{batches.length === 0 ? (
				<Card>
					<Text style={styles.emptyPacks}>Активных упаковок нет</Text>
				</Card>
			) : (
				batches.map((batch) => (
					<Card key={batch.id} style={styles.packCard}>
						<Text style={styles.packPlace}>
							{[batch.cabinetName, batch.locationName]
								.filter(Boolean)
								.join(' · ')}
						</Text>
						<Text style={styles.packQty}>
							{formatQuantityWithUnit(
								batch.quantity,
								getMedicineUnitShortLabel(batch.unit),
							)}
						</Text>
						{formatExpiryUntilLabel(batch.expiryDate) ? (
							<Text style={styles.packExpiry}>
								{formatExpiryUntilLabel(batch.expiryDate)}
							</Text>
						) : (
							<Text style={styles.packExpiry}>Срок не указан</Text>
						)}
						{batch.openedAt ? (
							<Text style={styles.packExtra}>
								Вскрыто: {batch.openedAt}
								{batch.afterOpeningValue && batch.afterOpeningUnit
									? ` · ${batch.afterOpeningValue} ${getAfterOpeningUnitLabel(batch.afterOpeningUnit)}`
									: ''}
							</Text>
						) : null}
						<SecondaryButton
							label="Изменить упаковку"
							onPress={() =>
								router.push(`/medicines/${id}/batches/${batch.id}`)
							}
							style={styles.packButton}
						/>
					</Card>
				))
			)}

			<PrimaryButton
				label="+ Добавить упаковку"
				onPress={() => router.push(`/medicines/${id}/batches/add`)}
				style={styles.addPack}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	hero: {
		gap: spacing.xs,
		marginBottom: spacing.md,
	},
	photo: {
		width: 88,
		height: 88,
		borderRadius: radii.lg,
		marginBottom: spacing.sm,
		backgroundColor: colors.surfaceMuted,
	},
	title: {
		...typography.title,
		fontSize: 26,
	},
	meta: {
		...typography.subtitle,
	},
	total: {
		...typography.section,
		marginTop: spacing.xs,
		color: colors.primaryDark,
	},
	notes: {
		...typography.bodySmall,
		marginTop: spacing.xs,
	},
	actions: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	emptyPacks: {
		...typography.bodySmall,
		textAlign: 'center',
	},
	packCard: {
		marginBottom: spacing.sm,
		gap: 4,
	},
	packPlace: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	packQty: {
		...typography.section,
	},
	packExpiry: {
		...typography.bodySmall,
	},
	packExtra: {
		...typography.caption,
		color: colors.muted,
	},
	packButton: {
		marginTop: spacing.sm,
	},
	addPack: {
		marginTop: spacing.md,
		marginBottom: spacing.xl,
	},
})
