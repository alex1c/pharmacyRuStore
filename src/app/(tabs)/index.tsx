import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'

import {
	AppHeader,
	Card,
	EmptyState,
	Screen,
} from '@/components/ui'
import { tabs } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	buildMedicineAttentionState,
} from '@/domain/medicineSummary'
import {
	countActiveBatches,
	countActiveMedicines,
	listMedicineSummaries,
} from '@/db/repositories/medicines'
import { MedicineSummary } from '@/db/types'
import { analytics } from '@/services/analytics'
import { formatQuantityWithUnit } from '@/utils/quantity'
import { getMedicineUnitShortLabel } from '@/constants/medicineUnits'

/**
 * «Сегодня» — attention dashboard for expiry and stock issues.
 */
export default function TodayScreen () {
	const { executor, seed } = useDatabase()
	const [medicineCount, setMedicineCount] = useState(0)
	const [batchCount, setBatchCount] = useState(0)
	const [attentionItems, setAttentionItems] = useState<MedicineSummary[]>([])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('today')
			void (async () => {
				const medicines = await countActiveMedicines(
					executor,
					seed.household.id,
				)
				const batches = await countActiveBatches(executor, seed.household.id)
				const summaries = await listMedicineSummaries(executor, {
					householdId: seed.household.id,
					sort: 'attention',
					attentionFilter: 'attention',
				})
				setMedicineCount(medicines)
				setBatchCount(batches)
				setAttentionItems(summaries)
			})()
		}, [executor, seed.household.id]),
	)

	return (
		<Screen scroll>
			<AppHeader title={tabs.today.title} />

			<Card style={styles.stats}>
				<Text style={styles.statsLine}>Лекарств: {medicineCount}</Text>
				<Text style={styles.statsLine}>Упаковок: {batchCount}</Text>
				<Text style={styles.statsLine}>
					Требуют внимания: {attentionItems.length}
				</Text>
			</Card>

			<Text style={styles.sectionTitle}>Требует внимания</Text>

			{attentionItems.length === 0 ? (
				<Card style={styles.okCard}>
					<Text style={styles.okTitle}>С аптечкой всё в порядке</Text>
					<Text style={styles.okText}>
						Нет просроченных или заканчивающихся лекарств.
					</Text>
				</Card>
			) : (
				attentionItems.map((summary) => {
					const attention = buildMedicineAttentionState(summary)
					if (!attention) {
						return null
					}
					const unit = summary.unit
						? getMedicineUnitShortLabel(summary.unit)
						: ''
					const qty = formatQuantityWithUnit(summary.totalQuantity, unit)
					return (
						<Pressable
							key={summary.medicine.id}
							onPress={() =>
								router.push(`/medicines/${summary.medicine.id}`)
							}
							style={({ pressed }) => [
								styles.attentionPress,
								pressed && styles.pressed,
							]}
						>
							<Card
								style={[
									styles.attentionCard,
									attention.kind === 'expired' || attention.kind === 'empty'
										? styles.attentionDanger
										: styles.attentionWarn,
								]}
							>
								<Text style={styles.attentionTitle}>{attention.title}</Text>
								<Text style={styles.attentionDetail}>{attention.detail}</Text>
								<Text style={styles.attentionQty}>{qty}</Text>
								<Text style={styles.attentionAction}>{attention.actionLabel}</Text>
							</Card>
						</Pressable>
					)
				})
			)}

			<View style={styles.spacer} />
			<EmptyState
				title={tabs.today.empty}
				icon="sunny-outline"
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	stats: {
		marginBottom: spacing.md,
		gap: spacing.xs,
	},
	statsLine: {
		...typography.body,
		color: colors.textSecondary,
	},
	sectionTitle: {
		...typography.section,
		marginBottom: spacing.sm,
		color: colors.text,
	},
	okCard: {
		marginBottom: spacing.lg,
		gap: spacing.xs,
	},
	okTitle: {
		...typography.section,
		color: colors.success,
	},
	okText: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	attentionPress: {
		marginBottom: spacing.sm,
		borderRadius: radii.lg,
	},
	pressed: {
		opacity: 0.92,
	},
	attentionCard: {
		gap: 4,
	},
	attentionDanger: {
		borderColor: '#E8C4C4',
		backgroundColor: '#FFF8F8',
	},
	attentionWarn: {
		borderColor: '#E8D9A8',
		backgroundColor: '#FFFCF3',
	},
	attentionTitle: {
		...typography.section,
		color: colors.text,
	},
	attentionDetail: {
		...typography.body,
		color: colors.textSecondary,
	},
	attentionQty: {
		...typography.bodySmall,
		color: colors.muted,
	},
	attentionAction: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.primaryDark,
		marginTop: spacing.xs,
	},
	spacer: {
		height: spacing.lg,
	},
})
