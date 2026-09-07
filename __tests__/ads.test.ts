/**
 * Phase 8B — Yandex Ads policy, session gating, and config tests.
 */

import {
	AnalyticsEvents,
	analytics,
	resetAnalyticsRuntimeForTests,
	setAnalyticsReporterForTests,
} from '@/services/analytics'
import { sanitizeEventParams } from '@/services/analytics/sanitize'
import {
	BANNER_BLOCKED_SCREENS,
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
	setAdClockForTests,
	setAdSessionStartedAtForTests,
	setAdsRuntimeConfigForTests,
	setInterstitialBridgeForTests,
	tryShowInterstitial,
} from '@/services/ads'
import {
	YANDEX_ADS_DEMO,
	YANDEX_ADS_PRODUCTION,
} from '@/constants/adsConfig'

const FIVE_MIN = 5 * 60 * 1000

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
	it('allows only cabinet, shopping, more', () => {
		expect(isBannerPlacementAllowed('cabinet')).toBe(true)
		expect(isBannerPlacementAllowed('shopping')).toBe(true)
		expect(isBannerPlacementAllowed('more')).toBe(true)
		expect(isBannerPlacementAllowed('today')).toBe(false)
		expect(isBannerPlacementAllowed('intake')).toBe(false)
		expect(isBannerPlacementAllowed('history')).toBe(false)
		expect(isBannerPlacementAllowed('scanner')).toBe(false)
		expect(isBannerPlacementAllowed('backup')).toBe(false)
	})

	it('documents blocked medical-critical screens', () => {
		expect(BANNER_BLOCKED_SCREENS).toEqual(
			expect.arrayContaining([
				'today',
				'intake',
				'medicine_edit',
				'batch_add',
				'course_edit',
				'scanner',
				'backup',
			]),
		)
	})
})

describe('ad session interstitial policy (injectable clock)', () => {
	let clock = 0

	beforeEach(() => {
		clock = 1_000_000
		setAdClockForTests(() => clock)
		resetAdSessionForTests()
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

	afterEach(() => {
		setAdClockForTests(null)
	})

	function addActions (count: number) {
		for (let i = 0; i < count; i += 1) {
			recordMeaningfulAdAction('medicine_saved')
		}
	}

	it('0:00 + 10 actions → not eligible', () => {
		addActions(10)
		expect(isInterstitialEligible()).toBe(false)
	})

	it('4:59 + 10 actions → not eligible', () => {
		addActions(10)
		clock += FIVE_MIN - 1
		expect(isInterstitialEligible()).toBe(false)
	})

	it('5:00 + 4 actions → not eligible', () => {
		addActions(4)
		clock += FIVE_MIN
		expect(isInterstitialEligible()).toBe(false)
	})

	it('5:00 + 5 actions → eligible', () => {
		addActions(5)
		clock += FIVE_MIN
		expect(isInterstitialEligible()).toBe(true)
	})

	it('medical actions do not increase eligibility', () => {
		clock += FIVE_MIN
		recordMedicalAdAction('intake_taken')
		recordMedicalAdAction('intake_skipped')
		recordMedicalAdAction('intake_snoozed')
		recordMedicalAdAction('intake_prn')
		recordMedicalAdAction('intake_undo')
		recordMedicalAdAction('notification_open')
		expect(isInterstitialEligible()).toBe(false)
		expect(adsService.canShowInterstitial('intake.confirm')).toBe(false)
		expect(adsService.canShowInterstitial('launch')).toBe(false)
	})

	it('blocks interstitial shortly after notification open', () => {
		addActions(5)
		clock += FIVE_MIN
		recordNotificationOpen()
		expect(isInterstitialEligible()).toBe(false)
	})

	it('shows interstitial at most once per session', async () => {
		addActions(5)
		clock += FIVE_MIN

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

		expect(await tryShowInterstitial('medicine_saved')).toBe(true)
		expect(await tryShowInterstitial('batch_saved')).toBe(false)
		expect(await tryShowInterstitial('shopping_completed')).toBe(false)
		expect(showCalls).toBe(1)
	})

	it('continues when interstitial is not ready', async () => {
		addActions(5)
		clock += FIVE_MIN
		setInterstitialBridgeForTests({
			preload: async () => undefined,
			isReady: () => false,
			reset: () => undefined,
			tryShow: async () => false,
		})
		await expect(tryShowInterstitial('medicine_saved')).resolves.toBe(false)
	})

	it('survives SDK throw without breaking caller', async () => {
		addActions(5)
		clock += FIVE_MIN
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

describe('ads analytics allowlist', () => {
	beforeEach(() => {
		resetAnalyticsRuntimeForTests()
	})

	it('allows placement+format and drops medical/ad-creative keys', () => {
		const sanitized = sanitizeEventParams(AnalyticsEvents.AD_BANNER_LOADED, {
			placement: 'shopping',
			format: 'banner',
			medicineName: 'Нурофен',
			personName: 'Анна',
			rawCode: '460123',
			advertiser: 'ACME',
		} as never)
		expect(sanitized).toEqual({
			placement: 'shopping',
			format: 'banner',
		})
		expect(JSON.stringify(sanitized)).not.toContain('Нурофен')
		expect(JSON.stringify(sanitized)).not.toContain('ACME')
	})

	it('drops forbidden keys before reporter', () => {
		const events: Array<{ name: string; attrs?: Record<string, unknown> }> = []
		setAnalyticsReporterForTests({
			event: (name, attrs) => {
				events.push({ name, attrs })
			},
			error: () => undefined,
		})
		analytics.trackEvent(AnalyticsEvents.AD_BANNER_FAILED, {
			placement: 'cabinet',
			format: 'banner',
			// @ts-expect-error intentional forbidden keys
			medicineName: 'X',
			advertiser: 'Y',
		})
		expect(events[0]?.attrs).toEqual({
			placement: 'cabinet',
			format: 'banner',
		})
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
