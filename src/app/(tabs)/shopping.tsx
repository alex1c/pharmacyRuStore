import { useEffect } from 'react'

import { AppHeader, EmptyState, Screen } from '@/components/ui'
import { tabs } from '@/constants/copy'
import { analytics } from '@/services/analytics'

/**
 * «Покупки» — low-stock / restock list (Phase 5).
 */
export default function ShoppingScreen () {
	useEffect(() => {
		analytics.trackScreen('shopping')
	}, [])

	return (
		<Screen>
			<AppHeader title={tabs.shopping.title} />
			<EmptyState
				title={tabs.shopping.empty}
				icon="cart-outline"
			/>
		</Screen>
	)
}
