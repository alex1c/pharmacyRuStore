/**
 * Screen banner-dock helpers — layout policy without mounting native ads.
 */

import {
	resolveScreenSafeAreaEdges,
	shouldShowBannerDock,
} from '@/components/ui/screenLayout'
import { resolveBannerPlacementForPathname } from '@/services/ads/placements'

describe('Screen banner dock layout policy', () => {
	it('omits bottom safe-area on tab screens so the dock sits above the tab bar', () => {
		expect(resolveScreenSafeAreaEdges(true)).toEqual(['top'])
	})

	it('keeps bottom safe-area on stack screens for system navigation clearance', () => {
		expect(resolveScreenSafeAreaEdges(false)).toEqual(['top', 'bottom'])
	})

	it('hides the dock while the keyboard is open', () => {
		expect(
			shouldShowBannerDock({
				placementAllowed: true,
				showBannerProp: true,
				keyboardVisible: true,
			}),
		).toBe(false)
	})

	it('shows the dock when placement is allowed and keyboard is closed', () => {
		expect(
			shouldShowBannerDock({
				placementAllowed: true,
				showBannerProp: true,
				keyboardVisible: false,
			}),
		).toBe(true)
	})

	it('respects showBanner=false (bootstrap / fatal shells)', () => {
		expect(
			shouldShowBannerDock({
				placementAllowed: true,
				showBannerProp: false,
				keyboardVisible: false,
			}),
		).toBe(false)
	})

	it('shows a banner on the notification destination (Today /)', () => {
		expect(resolveBannerPlacementForPathname('/')).toBe('today')
	})

	it('does not classify the live scanner camera route', () => {
		expect(resolveBannerPlacementForPathname('/scan')).toBeNull()
	})
})
