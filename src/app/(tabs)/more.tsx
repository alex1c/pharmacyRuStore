import { useEffect } from 'react'
import { StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'

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
 * «Ещё» — settings entry points and disclaimer.
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
				<ListRow
					title="Аптечки и места хранения"
					subtitle="Управление"
					showChevron
					onPress={() => router.push('/cabinets')}
				/>
				<ListRow
					title="Контроль запасов"
					subtitle="Сроки и низкий остаток"
					showChevron
					onPress={() => router.push('/settings/stock-control')}
				/>
				<ListRow
					title="Напоминания"
					subtitle="Уведомления о приёме"
					showChevron
					onPress={() => router.push('/settings/reminders')}
				/>
				<ListRow
					title="Члены семьи"
					subtitle="Профили для курсов"
					showChevron
					onPress={() => router.push('/family/index')}
				/>
				<ListRow
					title="Резервная копия"
					subtitle="Сохранить и восстановить данные"
					showChevron
					onPress={() => router.push('/settings/backup' as never)}
				/>
				{moreRows
					.filter((row) => row.id !== 'family' && row.id !== 'backup')
					.map((row, index, list) => (
					<ListRow
						key={row.id}
						title={row.title}
						subtitle={row.subtitle}
						disabled
						style={index === list.length - 1 ? styles.rowLast : null}
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
	rowLast: {
		borderBottomWidth: 0,
	},
	disclaimer: {
		...typography.bodySmall,
		color: colors.textSecondary,
		lineHeight: 20,
	},
})
