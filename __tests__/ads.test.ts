import { adsConfig, adsService } from '@/services/ads'

describe('ads abstraction', () => {
	it('keeps ads disabled in Phase 0', () => {
		expect(adsConfig.enabled).toBe(false)
		expect(adsService.isEnabled()).toBe(false)
		expect(adsService.canShowBanner('tab.today')).toBe(false)
		expect(adsService.canShowInterstitial('launch')).toBe(false)
		expect(adsService.canShowInterstitial('intake.confirm')).toBe(false)
	})
})
