/**
 * Ads runtime configuration — production IDs in release, demo/disabled in dev.
 */

import {
	ADS_ENABLE_DEMO_IN_DEV,
	ADS_PROVIDER,
	YANDEX_ADS_DEMO,
	YANDEX_ADS_PRODUCTION,
} from '@/constants/adsConfig'

export interface AdsRuntimeConfig {
	enabled: boolean
	provider: typeof ADS_PROVIDER | 'noop'
	/** True when using official demo units (dev smoke only). */
	useDemoUnits: boolean
	bannerUnitId: string | null
	interstitialUnitId: string | null
	/** Documented only — never loaded in v1. */
	feedUnitId: string
	feedEnabled: false
}

/**
 * Resolves active ads configuration for the current JS runtime.
 * Production IDs are automatic in release builds — no manual swap.
 */
export function resolveAdsRuntimeConfig (
	options?: { forceDemo?: boolean; forceDisabled?: boolean },
): AdsRuntimeConfig {
	const feedUnitId = YANDEX_ADS_PRODUCTION.feed

	if (options?.forceDisabled) {
		return {
			enabled: false,
			provider: 'noop',
			useDemoUnits: false,
			bannerUnitId: null,
			interstitialUnitId: null,
			feedUnitId,
			feedEnabled: false,
		}
	}

	const wantDemo =
		options?.forceDemo === true ||
		(__DEV__ && ADS_ENABLE_DEMO_IN_DEV)

	if (__DEV__ && !wantDemo) {
		// Default development path: no production impressions.
		return {
			enabled: false,
			provider: 'noop',
			useDemoUnits: false,
			bannerUnitId: null,
			interstitialUnitId: null,
			feedUnitId,
			feedEnabled: false,
		}
	}

	if (wantDemo) {
		return {
			enabled: true,
			provider: ADS_PROVIDER,
			useDemoUnits: true,
			bannerUnitId: YANDEX_ADS_DEMO.banner,
			interstitialUnitId: YANDEX_ADS_DEMO.interstitial,
			feedUnitId,
			feedEnabled: false,
		}
	}

	// Release / production
	return {
		enabled: true,
		provider: ADS_PROVIDER,
		useDemoUnits: false,
		bannerUnitId: YANDEX_ADS_PRODUCTION.banner,
		interstitialUnitId: YANDEX_ADS_PRODUCTION.interstitial,
		feedUnitId,
		feedEnabled: false,
	}
}

let runtimeConfig: AdsRuntimeConfig = resolveAdsRuntimeConfig()

export function getAdsRuntimeConfig (): AdsRuntimeConfig {
	return runtimeConfig
}

/** Re-resolve (tests / rare overrides). */
export function refreshAdsRuntimeConfig (
	options?: { forceDemo?: boolean; forceDisabled?: boolean },
): AdsRuntimeConfig {
	runtimeConfig = resolveAdsRuntimeConfig(options)
	return runtimeConfig
}

export function setAdsRuntimeConfigForTests (
	config: AdsRuntimeConfig,
): void {
	runtimeConfig = config
}
