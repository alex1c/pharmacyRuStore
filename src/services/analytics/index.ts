/**
 * Privacy-safe analytics facade.
 * UI/domain call only this module — never AppMetrica directly.
 */

import { logger } from '@/services/logging'

import {
	activateAppMetricaOnce,
	isAppMetricaActivated,
	reportAppMetricaError,
	reportAppMetricaEvent,
	resetAppMetricaActivationForTests,
	shouldActivateAppMetrica,
} from './appMetricaAdapter'
import {
	AnalyticsEventName,
	AnalyticsEventParams,
	AnalyticsEvents,
	AnalyticsScreen,
} from './events'
import {
	isKnownAnalyticsEvent,
	resolveAnalyticsScreen,
	sanitizeErrorContext,
	sanitizeErrorMessage,
	sanitizeEventParams,
} from './sanitize'

export { AnalyticsEvents } from './events'
export type {
	AnalyticsEventName,
	AnalyticsEventParams,
	AnalyticsScreen,
	BatchAddSource,
	MedicineCreateSource,
	ScanCodeTypeParam,
	ScheduleTypeParam,
	ShoppingAddSource,
	ShoppingCompleteType,
	SnoozeMinutes,
} from './events'

export type AnalyticsParams = Record<string, string | number | boolean>

export interface AnalyticsService {
	/**
	 * Typed product events only. Unknown events are dropped at runtime.
	 */
	trackEvent<E extends AnalyticsEventName> (
		name: E,
		...args: AnalyticsEventParams[E] extends Record<string, never>
			? [params?: AnalyticsEventParams[E]]
			: [params: AnalyticsEventParams[E]]
	): void
	trackScreen (name: string): void
	reportError (
		error: unknown,
		context?: { source?: string },
	): void
}

type Reporter = {
	event: (
		name: string,
		attributes?: Record<string, string | number | boolean>,
	) => void
	error: (identifier: string, message?: string) => void
}

let lastTrackedScreen: AnalyticsScreen | null = null
let appOpenSent = false
let reporterOverride: Reporter | null = null

function getReporter (): Reporter {
	if (reporterOverride) {
		return reporterOverride
	}
	return {
		event: reportAppMetricaEvent,
		error: reportAppMetricaError,
	}
}

/**
 * One-time analytics bootstrap (AppMetrica activate). Safe to call repeatedly.
 */
export function initializeAnalytics (): void {
	try {
		activateAppMetricaOnce()
	} catch (error) {
		logger.error('initializeAnalytics failed', error)
	}
}

/**
 * Cold-start app_open — at most once per JS runtime.
 */
export function trackAppOpenOnce (): void {
	if (appOpenSent) {
		return
	}
	appOpenSent = true
	analytics.trackEvent(AnalyticsEvents.APP_OPEN)
}

function createAnalytics (): AnalyticsService {
	return {
		trackEvent (name, params?) {
			try {
				if (!isKnownAnalyticsEvent(name)) {
					logger.debug('analytics.drop_unknown_event', { name })
					return
				}
				const sanitized = sanitizeEventParams(
					name,
					params as Record<string, unknown> | undefined,
				)
				const attributes =
					Object.keys(sanitized).length > 0
						? (sanitized as Record<string, string | number | boolean>)
						: undefined

				if (__DEV__ && !shouldActivateAppMetrica()) {
					logger.debug('analytics.event', { name, ...attributes })
				}

				getReporter().event(name, attributes)
			} catch (error) {
				logger.error('analytics.trackEvent failed', error)
			}
		},

		trackScreen (name) {
			try {
				const screen = resolveAnalyticsScreen(name)
				if (!screen) {
					return
				}
				// Dedupe consecutive identical screen ids (re-render / focus bounce).
				if (screen === lastTrackedScreen) {
					return
				}
				lastTrackedScreen = screen

				if (__DEV__ && !shouldActivateAppMetrica()) {
					logger.debug('analytics.screen', { screen })
				}

				getReporter().event('screen_view', { screen })
			} catch (error) {
				logger.error('analytics.trackScreen failed', error)
			}
		},

		reportError (error, context) {
			try {
				const safeContext = sanitizeErrorContext(context)
				const message = sanitizeErrorMessage(error)
				const identifier =
					safeContext.source ??
					(error instanceof Error ? error.name : 'Error')

				if (__DEV__ && !shouldActivateAppMetrica()) {
					logger.error('analytics.error', message, safeContext)
				}

				getReporter().error(identifier.slice(0, 80), message)
			} catch (reportFailure) {
				logger.error('analytics.reportError failed', reportFailure)
			}
		},
	}
}

export const analytics: AnalyticsService = createAnalytics()

/** Test helpers — do not use from product UI. */
export function resetAnalyticsRuntimeForTests (): void {
	lastTrackedScreen = null
	appOpenSent = false
	reporterOverride = null
	resetAppMetricaActivationForTests()
}

export function setAnalyticsReporterForTests (reporter: Reporter | null): void {
	reporterOverride = reporter
}

export function getAnalyticsRuntimeStateForTests (): {
	lastScreen: AnalyticsScreen | null
	appOpenSent: boolean
	appMetricaActivated: boolean
} {
	return {
		lastScreen: lastTrackedScreen,
		appOpenSent,
		appMetricaActivated: isAppMetricaActivated(),
	}
}
