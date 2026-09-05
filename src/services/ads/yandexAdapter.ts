/**
 * Lazy Yandex Mobile Ads SDK bridge — never import from UI screens directly.
 */

import type { ComponentType } from 'react'

import { logger } from '@/services/logging'

export type YandexAdsModule = {
	MobileAds: {
		initialize: () => Promise<void> | void
		setUserConsent?: (value: boolean) => void
		setLocationConsent?: (value: boolean) => void
		enableLogging?: (value: boolean) => void
	}
	BannerView: ComponentType<{
		size: unknown
		adRequest: { adUnitId: string }
		onAdLoaded?: (event: unknown) => void
		onAdFailedToLoad?: (event: unknown) => void
		style?: unknown
	}>
	BannerAdSize: {
		stickySize: (width: number) => Promise<{ width: number; height: number }>
	}
	InterstitialAdLoader: {
		create: () => Promise<{
			loadAd: (params: { adUnitId: string }) => Promise<{
				show: () => Promise<void>
				onAdShown: (() => void) | null
				onAdFailedToShow: ((error?: unknown) => void) | null
				onAdDismissed: (() => void) | null
			}>
		}>
	}
}

let cached: YandexAdsModule | null | undefined

/**
 * Lazy require so Jest can load the ads facade without native modules.
 */
export function getYandexAdsModule (): YandexAdsModule | null {
	if (cached !== undefined) {
		return cached
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('yandex-mobile-ads') as YandexAdsModule
		if (!mod?.MobileAds || !mod?.BannerView) {
			cached = null
			return null
		}
		cached = mod
		return cached
	} catch (error) {
		logger.error('Yandex Mobile Ads module unavailable', error)
		cached = null
		return null
	}
}

/** Test helper — inject / clear module cache. */
export function setYandexAdsModuleForTests (
	mod: YandexAdsModule | null | undefined,
): void {
	cached = mod
}
