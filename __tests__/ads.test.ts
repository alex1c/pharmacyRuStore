/**
 * Phase 8B — Yandex Ads policy, session gating, and config tests.
 */

import {
	adsService,
	getAdsRuntimeConfig,
	isBannerPlacementAllowed,
	isInterstitialEligible,
	markInterstitialShown,
	recordMeaningfulAdAction,
	recordMedicalAdAction,
	recordNotificationOpen,
	resetAdSessionForTests,
	resetAdsInitializationForTests,
	resetInterstitialRuntimeForTests,
	resolveAdsRuntimeConfig,
	setAdSessionStartedAtForTests,
	setAdsRuntimeConfigForTests,
	setInterstitialBridgeForTests,
	tryShowInterstitial,
	BANNER_BLOCKED_SCREENS,
} from '@/services/ads'
import {
	YANDEX_ADS_DEMO,
	YANDEX_ADS_PRODUCTION,
} from '@/constants/adsConfig'

describe('ads runtime config', () => {
	afterEach(() => {
		setAdsRuntimeConfigForTests(resolveAdsRuntimeConfig({ forceDisabled: true }))
	})

	it('disables production impressions in default development path', () => {
		const config = resolveAdsRuntimeConfig()
		expect(config.enabled).toBe(false)
		expect(config.bannerUnitId).toBeNull()
		expect(config.interstitialUnitId).toBeNull()
		expect(config.feedEnabled).toBe(false)
		expect(config.feedUnitId).toBe(YANDEX_ADS_PRODUCTION.feed)
	})

	it('uses demo units when forceDemo is set (dev smoke)', () => {
		const config = resolveAdsRuntimeConfig({ forceDemo: true })
		expect(config.enabled).toBe(true)
		expect(config.useDemoUnits).toBe(true)
		expect(config.bannerUnitId).toBe(YANDEX_ADS_DEMO.banner)
		expect(config.interstitialUnitId).toBe(YANDEX_ADS_DEMO.interstitial)
		expect(config.bannerUnitId).not.toBe(YANDEX_ADS_PRODUCTION.banner)
	})

	it('keeps feed reserved/disabled', () => {
		const config = resolveAdsRuntimeConfig({ forceDemo: true })
		expect(config.feedEnabled).toBe(false)
		expect(config.feedUnitId).toBe('R-M-19988985-3')
	})
})

describe('banner placement policy', () => {
	it('allows only approved placements', () => {
		expect(isBannerPlacementAllowed('cabinet')).toBe(true)
		expect(isBannerPlacementAllowed('shopping')).toBe(true)
		expect(isBannerPlacementAllowed('more')).toBe(true)
		expect(isBannerPlacementAllowed('history')).toBe(true)
		expect(isBannerPlacementAllowed('today')).toBe(false)
		expect(isBannerPlacementAllowed('scanner')).toBe(false)
		expect(isBannerPlacementAllowed('backup')).toBe(false)
	})

	it('documents blocked medical-critical screens', () => {
		expect(BANNER_BLOCKED_SCREENS).toEqual(
			expect.arrayContaining([
				'today',
				'medicine_edit',
				'batch_add',
				'course_edit',
				'scanner',
				'backup',
			]),
		)
	})
})

describe('ad session interstitial policy', () => {
	beforeEach(() => {
		resetAdSessionForTests({
			minSessionAgeMs: 3 * 60 * 1000,
			minMeaningfulActions: 4,
			maxInterstitialsPerSession: 1,
			minimumInterstitialIntervalMs: 10 * 60 * 1000,
			notificationBlockMs: 5 * 60 * 1000,
		})
		resetInterstitialRuntimeForTests()
		resetAdsInitializationForTests()
		setAdsRuntimeConfigForTests({
			enabled: true,
			provider: 'yandex',
			useDemoUnits: true,
			bannerUnitId: YANDEX_ADS_DEMO.banner,
			interstitialUnitId: YANDEX_ADS_DEMO.interstitial,
			feedUnitId: YANDEX_ADS_PRODUCTION.feed,
			feedEnabled: false,
		})
	})

	it('is not eligible immediately on new session', () => {
		expect(isInterstitialEligible()).toBe(false)
	})

	it('is false before minimum session age', () => {
		recordMeaningfulAdAction('screen_browse')
		recordMeaningfulAdAction('screen_browse')
		recordMeaningfulAdAction('screen_browse')
		recordMeaningfulAdAction('screen_browse')
		expect(isInterstitialEligible()).toBe(false)
	})

	it('is false with insufficient meaningful actions', () => {
		setAdSessionStartedAtForTests(Date.now() - 4 * 60 * 1000)
		recordMeaningfulAdAction('screen_browse')
		recordMeaningfulAdAction('screen_browse')
		expect(isInterstitialEligible()).toBe(false)
	})

	it('becomes eligible after age + actions', () => {
		setAdSessionStartedAtForTests(Date.now() - 4 * 60 * 1000)
		for (let i = 0; i < 4; i += 1) {
			recordMeaningfulAdAction('screen_browse')
		}
		expect(isInterstitialEligible()).toBe(true)
	})

	it('medical actions do not increase eligibility', () => {
		setAdSessionStartedAtForTests(Date.now() - 4 * 60 * 1000)
		recordMedicalAdAction('intake_taken')
		recordMedicalAdAction('intake_skipped')
		recordMedicalAdAction('intake_snoozed')
		recordMedicalAdAction('notification_open')
		expect(isInterstitialEligible()).toBe(false)
		expect(adsService.canShowInterstitial('intake.confirm')).toBe(false)
		expect(adsService.canShowInterstitial('launch')).toBe(false)
	})

	it('blocks interstitial shortly after notification open', () => {
		setAdSessionStartedAtForTests(Date.now() - 4 * 60 * 1000)
		for (let i = 0; i < 4; i += 1) {
			recordMeaningfulAdAction('screen_browse')
		}
		recordNotificationOpen()
		expect(isInterstitialEligible()).toBe(false)
	})

	it('shows interstitial at most once per session even if called repeatedly', async () => {
		setAdSessionStartedAtForTests(Date.now() - 4 * 60 * 1000)
		for (let i = 0; i < 4; i += 1) {
			recordMeaningfulAdAction('screen_browse')
		}

		let showCalls = 0
		setInterstitialBridgeForTests({
			preload: async () => undefined,
			isReady: () => true,
			reset: () => undefined,
			tryShow: async () => {
				if (!isInterstitialEligible()) {
					return false
				}
				showCalls += 1
				markInterstitialShown()
				return true
			},
		})

		const first = await tryShowInterstitial('medicine_saved')
		const second = await tryShowInterstitial('batch_saved')
		const third = await tryShowInterstitial('shopping_completed')

		expect(first).toBe(true)
		expect(second).toBe(false)
		expect(third).toBe(false)
		expect(showCalls).toBe(1)
	})

	it('continues when interstitial is not ready', async () => {
		setAdSessionStartedAtForTests(Date.now() - 4 * 60 * 1000)
		for (let i = 0; i < 4; i += 1) {
			recordMeaningfulAdAction('screen_browse')
		}
		setInterstitialBridgeForTests({
			preload: async () => undefined,
			isReady: () => false,
			reset: () => undefined,
			tryShow: async () => false,
		})
		await expect(tryShowInterstitial('medicine_saved')).resolves.toBe(false)
	})

	it('survives SDK throw without breaking caller', async () => {
		setAdSessionStartedAtForTests(Date.now() - 4 * 60 * 1000)
		for (let i = 0; i < 4; i += 1) {
			recordMeaningfulAdAction('screen_browse')
		}
		setInterstitialBridgeForTests({
			preload: async () => {
				throw new Error('preload_boom')
			},
			isReady: () => false,
			reset: () => undefined,
			tryShow: async () => {
				throw new Error('show_boom')
			},
		})
		await expect(tryShowInterstitial('storage_saved')).resolves.toBe(false)
	})
})

describe('adsService banner gating', () => {
	it('refuses banners when ads disabled', () => {
		setAdsRuntimeConfigForTests(resolveAdsRuntimeConfig({ forceDisabled: true }))
		expect(adsService.isEnabled()).toBe(false)
		expect(adsService.canShowBanner('cabinet')).toBe(false)
		expect(getAdsRuntimeConfig().enabled).toBe(false)
	})
})
