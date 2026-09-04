import { useCallback, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useFocusEffect } from 'expo-router'

import { AppHeader, Card, EmptyState, Screen } from '@/components/ui'
import { tabs } from '@/constants/copy'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	countActiveBatches,
	countActiveMedicines,
} from '@/db/repositories/medicines'
import { analytics } from '@/services/analytics'

/**
 * «Сегодня» — placeholder for reminders + light inventory stats.
 */
export default function TodayScreen () {
	const { executor, seed } = useDatabase()
	const [medicineCount, setMedicineCount] = useState(0)
	const [batchCount, setBatchCount] = useState(0)

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('today')
			void (async () => {
				const medicines = await countActiveMedicines(
					executor,
					seed.household.id,
				)
				const batches = await countActiveBatches(executor, seed.household.id)
				setMedicineCount(medicines)
				setBatchCount(batches)
			})()
		}, [executor, seed.household.id]),
	)

	return (
		<Screen>
			<AppHeader title={tabs.today.title} />
			{medicineCount > 0 ? (
				<Card style={styles.stats}>
					<Text style={styles.statsTitle}>Краткая сводка</Text>
					<Text style={styles.statsLine}>
						В аптечке: {medicineCount}{' '}
						{pluralize(medicineCount, 'лекарство', 'лекарства', 'лекарств')}
					</Text>
					<Text style={styles.statsLine}>
						Всего упаковок: {batchCount}
					</Text>
				</Card>
			) : null}
			<EmptyState
				title={tabs.today.empty}
				icon="sunny-outline"
			/>
		</Screen>
	)
}

function pluralize (
	count: number,
	one: string,
	few: string,
	many: string,
): string {
	const mod10 = count % 10
	const mod100 = count % 100
	if (mod10 === 1 && mod100 !== 11) {
		return one
	}
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return few
	}
	return many
}

const styles = StyleSheet.create({
	stats: {
		marginBottom: spacing.md,
		gap: spacing.xs,
	},
	statsTitle: {
		...typography.section,
		color: colors.text,
		marginBottom: spacing.xxs,
	},
	statsLine: {
		...typography.body,
		color: colors.textSecondary,
	},
})
