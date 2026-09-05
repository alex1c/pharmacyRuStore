/**
 * Central Yandex Ads unit IDs — never scatter across screens.
 * Feed is reserved for a future release and must stay disabled in v1.
 */

/** Production РСЯ units */
export const YANDEX_ADS_PRODUCTION = {
	banner: 'R-M-19988985-1',
	interstitial: 'R-M-19988985-2',
	/** Reserved in РСЯ cabinet — not integrated in v1.0 */
	feed: 'R-M-19988985-3',
} as const

/** Official Yandex demo units for development smoke (no production impressions). */
export const YANDEX_ADS_DEMO = {
	banner: 'demo-banner-yandex',
	interstitial: 'demo-interstitial-yandex',
} as const

/**
 * When true in __DEV__, SDK initializes with demo units.
 * When false in __DEV__, ads stay fully disabled (default).
 */
export const ADS_ENABLE_DEMO_IN_DEV = false

export const ADS_PROVIDER = 'yandex' as const
