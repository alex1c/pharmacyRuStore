/**
 * Analytics abstraction for future AppMetrica integration.
 * Phase 0 uses a safe noop/dev logger — no production API keys.
 */

import { logger } from '@/services/logging'

export type AnalyticsParams = Record<string, string | number | boolean | null>

export interface AnalyticsService {
	trackEvent (name: string, params?: AnalyticsParams): void
	trackScreen (name: string): void
	reportError (
		error: unknown,
		context?: AnalyticsParams & { source?: string },
	): void
}

function createDevAnalytics (): AnalyticsService {
	return {
		trackEvent (name, params) {
			logger.debug('analytics.event', { name, ...params })
		},
		trackScreen (name) {
			logger.debug('analytics.screen', { name })
		},
		reportError (error, context) {
			logger.error('analytics.error', error, context)
		},
	}
}

export const analytics: AnalyticsService = createDevAnalytics()
