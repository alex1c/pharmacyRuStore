/**
 * Public ads facade — UI uses this module and AppBannerAd only.
 */

import { logger } from '@/services/logging'

import {
	InterstitialTrigger,
	MeaningfulAdAction,
	MedicalAdAction,
	isInterstitialEligible,
	recordMeaningfulAdAction,
	recordMedicalAdAction,
	recordNotificationOpen,
	startAdSession,
} from './adSessionPolicy'
import {
	getAdsRuntimeConfig,
	refreshAdsRuntimeConfig,
} from './adsConfig'
import {
	preloadInterstitial,
	tryShowInterstitial,
} from './interstitialAds'
import {
	BannerPlacement,
	isBannerPlacementAllowed,
} from './placements'
import { getYandexAdsModule } from './yandexAdapter'

export type { AdsRuntimeConfig } from './adsConfig'
export type {
	InterstitialTrigger,
	MeaningfulAdAction,
	MedicalAdAction,
} from './adSessionPolicy'
export type { BannerPlacement } from './placements'
export {
	isBannerPlacementAllowed,
	BANNER_BLOCKED_SCREENS,
	BannerPlacements,
} from './placements'
export {
	isInterstitialEligible,
	getAdSessionState,
	getAdSessionPolicyConfig,
	DEFAULT_AD_SESSION_POLICY,
	resetAdSessionForTests,
	setAdSessionStartedAtForTests,
	startAdSession,
	recordMeaningfulAdAction,
	recordMedicalAdAction,
	recordNotificationOpen,
	markInterstitialShown,
} from './adSessionPolicy'
export {
	getAdsRuntimeConfig,
	refreshAdsRuntimeConfig,
	resolveAdsRuntimeConfig,
	setAdsRuntimeConfigForTests,
} from './adsConfig'
export {
	preloadInterstitial,
	tryShowInterstitial,
	isInterstitialReady,
	resetInterstitialRuntimeForTests,
	setInterstitialBridgeForTests,
} from './interstitialAds'
export { setYandexAdsModuleForTests } from './yandexAdapter'

let initialized = false

/**
 * One-time non-blocking ads SDK init. Safe failure.
 */
export async function initializeAds (): Promise<void> {
	if (initialized) {
		return
	}
	initialized = true
	startAdSession()
	refreshAdsRuntimeConfig()

	const config = getAdsRuntimeConfig()
	if (!config.enabled) {
		logger.debug('Ads disabled for this runtime')
		return
	}

	try {
		const sdk = getYandexAdsModule()
		if (!sdk) {
			logger.error('Ads init skipped — SDK missing')
			return
		}
		// RuStore / РФ: no fabricated GDPR consent screen.
		// Location for ads targeting stays off.
		sdk.MobileAds.setLocationConsent?.(false)
		await Promise.resolve(sdk.MobileAds.initialize())
		logger.info('Yandex Mobile Ads initialized', {
			useDemoUnits: config.useDemoUnits,
		})
		// Preload interstitial quietly after init — never await in UI.
		preloadInterstitial()
	} catch (error) {
		logger.error('Yandex Mobile Ads init failed', error)
	}
}

export function isAdsInitialized (): boolean {
	return initialized
}

export function resetAdsInitializationForTests (): void {
	initialized = false
}

/** @deprecated Prefer getAdsRuntimeConfig — kept for older tests. */
export const adsConfig = {
	get enabled () {
		return getAdsRuntimeConfig().enabled
	},
	get provider () {
		return getAdsRuntimeConfig().provider
	},
	get bannerUnitId () {
		return getAdsRuntimeConfig().bannerUnitId
	},
	get interstitialUnitId () {
		return getAdsRuntimeConfig().interstitialUnitId
	},
}

export interface AdsService {
	isEnabled (): boolean
	canShowBanner (placement: string): boolean
	canShowInterstitial (trigger?: string): boolean
	recordMeaningfulAction (action: MeaningfulAdAction): void
	recordMedicalAction (action: MedicalAdAction): void
	maybeShowInterstitial (trigger: InterstitialTrigger): void
}

export const adsService: AdsService = {
	isEnabled () {
		const config = getAdsRuntimeConfig()
		return config.enabled && config.provider === 'yandex'
	},
	canShowBanner (placement) {
		if (!this.isEnabled()) {
			return false
		}
		return isBannerPlacementAllowed(placement)
	},
	canShowInterstitial (trigger) {
		if (!this.isEnabled()) {
			return false
		}
		if (
			trigger === 'launch' ||
			trigger === 'intake.confirm' ||
			trigger === 'intake_taken' ||
			trigger === 'notification'
		) {
			return false
		}
		return isInterstitialEligible()
	},
	recordMeaningfulAction (action) {
		recordMeaningfulAdAction(action)
	},
	recordMedicalAction (action) {
		recordMedicalAdAction(action)
		if (action === 'notification_open') {
			recordNotificationOpen()
		}
	},
	maybeShowInterstitial (trigger) {
		void tryShowInterstitial(trigger)
	},
}

export function getBannerUnitIdForPlacement (
	placement: BannerPlacement,
): string | null {
	if (!adsService.canShowBanner(placement)) {
		return null
	}
	return getAdsRuntimeConfig().bannerUnitId
}
