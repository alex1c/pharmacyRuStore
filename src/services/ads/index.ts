/**
 * Ads configuration / service layer for future Yandex Mobile Ads (РСЯ).
 * Real SDK is not wired in Phase 0 — keep policy rules in one place.
 */

export interface AdsConfig {
	/** Master switch — false until production units are configured. */
	enabled: boolean
	provider: 'noop' | 'yandex'
	bannerUnitId: string | null
	interstitialUnitId: string | null
}

/**
 * Product policy for ad placement (enforced when SDK is connected later).
 */
export const adsPolicy = {
	/** One unobtrusive banner on suitable main screens. */
	allowBannerOnMainTabs: true,
	/** Never show interstitial immediately after app launch. */
	allowInterstitialOnLaunch: false,
	/** Never interrupt medicine intake confirmation. */
	allowInterstitialDuringIntakeConfirm: false,
	/** Interstitials only at natural pause points, infrequently. */
	preferNaturalBreaksOnly: true,
} as const

export const adsConfig: AdsConfig = {
	enabled: false,
	provider: 'noop',
	bannerUnitId: null,
	interstitialUnitId: null,
}

export interface AdsService {
	isEnabled (): boolean
	canShowBanner (placement: string): boolean
	canShowInterstitial (placement: string): boolean
}

export const adsService: AdsService = {
	isEnabled () {
		return adsConfig.enabled && adsConfig.provider !== 'noop'
	},
	canShowBanner (placement) {
		if (!this.isEnabled()) {
			return false
		}
		return adsPolicy.allowBannerOnMainTabs && placement.startsWith('tab.')
	},
	canShowInterstitial (placement) {
		if (!this.isEnabled()) {
			return false
		}
		if (placement === 'launch') {
			return adsPolicy.allowInterstitialOnLaunch
		}
		if (placement === 'intake.confirm') {
			return adsPolicy.allowInterstitialDuringIntakeConfirm
		}
		return adsPolicy.preferNaturalBreaksOnly
	},
}
