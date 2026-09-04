import { useEffect } from 'react'

import { AppHeader, EmptyState, Screen } from '@/components/ui'
import { tabs } from '@/constants/copy'
import { analytics } from '@/services/analytics'

/**
 * «Сегодня» — future intake agenda for the current day.
 */
export default function TodayScreen () {
	useEffect(() => {
		analytics.trackScreen('today')
	}, [])

	return (
		<Screen>
			<AppHeader title={tabs.today.title} />
			<EmptyState
				title={tabs.today.empty}
				icon="sunny-outline"
			/>
		</Screen>
	)
}
