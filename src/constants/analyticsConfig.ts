/**
 * Central analytics configuration — production AppMetrica key lives here only.
 * Do not copy the API key into screens or repositories.
 */

export const APPMETRICA_API_KEY =
	'bbf42d5e-64b9-4a91-b4d0-766438bd07b3'

export const ANALYTICS_PROVIDER = 'appmetrica' as const

/**
 * When false, AppMetrica activate/report are skipped in __DEV__
 * (events still go to the local logger).
 */
export const APPMETRICA_ENABLE_IN_DEV = false
