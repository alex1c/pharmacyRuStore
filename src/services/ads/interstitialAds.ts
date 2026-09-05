/**
 * Interstitial preload + gated show — never blocks user flows.
 */

import { AnalyticsEvents, analytics } from '@/services/analytics'
import { logger } from '@/services/logging'

import {
	InterstitialTrigger,
	isInterstitialEligible,
	isInterstitialTriggerAllowed,
	markInterstitialShown,
	recordMeaningfulAdAction,
} from './adSessionPolicy'
import { getAdsRuntimeConfig } from './adsConfig'
import { getYandexAdsModule } from './yandexAdapter'

type LoadedInterstitial = {
	show: () => Promise<void>
	onAdShown: (() => void) | null
	onAdFailedToShow: ((error?: unknown) => void) | null
	onAdDismissed: (() => void) | null
}

let loadedAd: LoadedInterstitial | null = null
let loading = false
let showInFlight = false

type InterstitialBridge = {
	preload: () => Promise<void>
	tryShow: (trigger: InterstitialTrigger) => Promise<boolean>
	isReady: () => boolean
	reset: () => void
}

let bridgeOverride: InterstitialBridge | null = null

async function preloadNative (): Promise<void> {
	const config = getAdsRuntimeConfig()
	if (!config.enabled || !config.interstitialUnitId) {
		return
	}
	if (loading || loadedAd) {
		return
	}
	loading = true
	try {
		const sdk = getYandexAdsModule()
		if (!sdk) {
			return
		}
		const loader = await sdk.InterstitialAdLoader.create()
		const ad = await loader.loadAd({
			adUnitId: config.interstitialUnitId,
		})
		loadedAd = ad
		analytics.trackEvent(AnalyticsEvents.AD_INTERSTITIAL_LOADED, {
			format: 'interstitial',
		})
	} catch (error) {
		loadedAd = null
		logger.debug('Interstitial preload failed', {
			message: error instanceof Error ? error.message : 'unknown',
		})
		analytics.trackEvent(AnalyticsEvents.AD_INTERSTITIAL_FAILED, {
			format: 'interstitial',
		})
	} finally {
		loading = false
	}
}

/**
 * Fire-and-forget preload. Safe to call repeatedly.
 */
export function preloadInterstitial (): void {
	if (bridgeOverride) {
		void bridgeOverride.preload()
		return
	}
	void preloadNative()
}

/**
 * Attempt interstitial after a secondary (non-medical) flow completes.
 * Never throws; never delays the caller beyond a microtask hop.
 */
export async function tryShowInterstitial (
	trigger: InterstitialTrigger,
): Promise<boolean> {
	try {
		if (bridgeOverride) {
			return await bridgeOverride.tryShow(trigger)
		}
		if (!isInterstitialTriggerAllowed(trigger)) {
			return false
		}
		// Completing a secondary flow also counts as a meaningful action.
		recordMeaningfulAdAction(trigger)
		if (!isInterstitialEligible()) {
			return false
		}
		const config = getAdsRuntimeConfig()
		if (!config.enabled || !config.interstitialUnitId) {
			return false
		}
		if (showInFlight) {
			return false
		}
		if (!loadedAd) {
			await preloadNative()
		}
		const ad = loadedAd
		if (!ad) {
			return false
		}

		showInFlight = true
		loadedAd = null

		return await new Promise<boolean>((resolve) => {
			let settled = false
			const finish = (shown: boolean) => {
				if (settled) {
					return
				}
				settled = true
				showInFlight = false
				resolve(shown)
				// Warm the next session slot asynchronously (still gated by policy).
				preloadInterstitial()
			}

			ad.onAdShown = () => {
				markInterstitialShown()
				analytics.trackEvent(AnalyticsEvents.AD_INTERSTITIAL_SHOWN, {
					format: 'interstitial',
				})
			}
			ad.onAdFailedToShow = () => {
				analytics.trackEvent(AnalyticsEvents.AD_INTERSTITIAL_FAILED, {
					format: 'interstitial',
				})
				finish(false)
			}
			ad.onAdDismissed = () => {
				finish(true)
			}

			void ad.show().catch((error) => {
				logger.debug('Interstitial show failed', {
					message: error instanceof Error ? error.message : 'unknown',
				})
				analytics.trackEvent(AnalyticsEvents.AD_INTERSTITIAL_FAILED, {
					format: 'interstitial',
				})
				finish(false)
			})
		})
	} catch (error) {
		logger.error(
			'tryShowInterstitial failed',
			error instanceof Error ? error : undefined,
		)
		showInFlight = false
		return false
	}
}

export function isInterstitialReady (): boolean {
	if (bridgeOverride) {
		return bridgeOverride.isReady()
	}
	return loadedAd !== null
}

export function resetInterstitialRuntimeForTests (): void {
	loadedAd = null
	loading = false
	showInFlight = false
	bridgeOverride = null
}

export function setInterstitialBridgeForTests (
	bridge: InterstitialBridge | null,
): void {
	bridgeOverride = bridge
}
