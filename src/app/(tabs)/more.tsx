import { useEffect } from 'react'
import { StyleSheet, Text } from 'react-native'

import {
	AppHeader,
	Card,
	ListRow,
	Screen,
	SectionHeader,
} from '@/components/ui'
import { HEALTH_DISCLAIMER, moreRows, tabs } from '@/constants/copy'
import { colors, typography } from '@/constants/theme'
import { analytics } from '@/services/analytics'

/**
 * «Ещё» — future settings, family, backup, about.
 */
export default function MoreScreen () {
	useEffect(() => {
		analytics.trackScreen('more')
	}, [])

	return (
		<Screen scroll>
			<AppHeader
				title={tabs.more.title}
				subtitle={tabs.more.subtitle}
			/>

			<SectionHeader title="Разделы" />
			<Card style={styles.listCard}>
				{moreRows.map((row, index) => (
					<ListRow
						key={row.id}
						title={row.title}
						subtitle={row.subtitle}
						disabled
						style={[
							styles.row,
							index === moreRows.length - 1 ? styles.rowLast : null,
						]}
					/>
				))}
			</Card>

			<SectionHeader title="Важно" />
			<Card>
				<Text style={styles.disclaimer}>{HEALTH_DISCLAIMER}</Text>
			</Card>
		</Screen>
	)
}

const styles = StyleSheet.create({
	listCard: {
		padding: 0,
		overflow: 'hidden',
	},
	row: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	rowLast: {
		borderBottomWidth: 0,
	},
	disclaimer: {
		...typography.bodySmall,
		color: colors.textSecondary,
		lineHeight: 20,
	},
})
