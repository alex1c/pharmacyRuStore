import { useEffect } from 'react'

import { AppHeader, EmptyState, Screen } from '@/components/ui'
import { tabs } from '@/constants/copy'
import { analytics } from '@/services/analytics'

/**
 * «Приём» — schedules and intake history (Phase 3+).
 */
export default function IntakeScreen () {
	useEffect(() => {
		analytics.trackScreen('intake')
	}, [])

	return (
		<Screen>
			<AppHeader title={tabs.intake.title} />
			<EmptyState
				title={tabs.intake.empty}
				icon="checkbox-outline"
			/>
		</Screen>
	)
}
