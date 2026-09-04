import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { AppHeader, EmptyState, Screen } from '@/components/ui'
import { tabs } from '@/constants/copy'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { analytics } from '@/services/analytics'

/**
 * «Аптечка» — home medicine cabinets and medicines (Phase 1+).
 */
export default function CabinetScreen () {
	const { seed } = useDatabase()

	useEffect(() => {
		analytics.trackScreen('cabinet')
	}, [])

	return (
		<Screen>
			<AppHeader title={tabs.cabinet.title} />
			<View style={styles.meta}>
				<Text style={styles.metaText}>
					Аптечка «{seed.cabinet.name}» · профиль «{seed.person.name}»
				</Text>
			</View>
			<EmptyState
				title={tabs.cabinet.empty}
				icon="medkit-outline"
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	meta: {
		marginBottom: spacing.md,
	},
	metaText: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
})
