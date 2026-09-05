/**
 * AppMetrica native bridge adapter (production).
 * Never import AppMetrica from UI — go through analytics/index.
 */

import Constants from 'expo-constants'

import {
	APPMETRICA_API_KEY,
	APPMETRICA_ENABLE_IN_DEV,
} from '@/constants/analyticsConfig'
import { logger } from '@/services/logging'

let activated = false

type AppMetricaModule = {
	activate: (config: Record<string, unknown>) => void
	reportEvent: (
		name: string,
		attributes?: Record<string, string | number | boolean>,
	) => void
	reportError: (identifier: string, message?: string) => void
}

/**
 * Lazy require so Jest / SSR can load the analytics facade without native bridge.
 */
function getAppMetrica (): AppMetricaModule | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('@appmetrica/react-native-analytics') as
			| AppMetricaModule
			| { default: AppMetricaModule }
		if (mod && typeof (mod as AppMetricaModule).activate === 'function') {
			return mod as AppMetricaModule
		}
		if (
			mod &&
			'default' in mod &&
			typeof mod.default.activate === 'function'
		) {
			return mod.default
		}
		return null
	} catch (error) {
		logger.error('AppMetrica module unavailable', error)
		return null
	}
}

export function shouldActivateAppMetrica (): boolean {
	if (!APPMETRICA_API_KEY) {
		return false
	}
	if (__DEV__ && !APPMETRICA_ENABLE_IN_DEV) {
		return false
	}
	return true
}

export function isAppMetricaActivated (): boolean {
	return activated
}

/**
 * One-time AppMetrica activation. Safe to call repeatedly.
 */
export function activateAppMetricaOnce (): void {
	if (activated) {
		return
	}
	activated = true

	if (!shouldActivateAppMetrica()) {
		logger.debug('AppMetrica skipped (dev or disabled)')
		return
	}

	try {
		const AppMetrica = getAppMetrica()
		if (!AppMetrica) {
			logger.error('AppMetrica activate skipped — module missing')
			return
		}
		AppMetrica.activate({
			apiKey: APPMETRICA_API_KEY,
			appVersion: Constants.expoConfig?.version ?? '1.0.0',
			sessionTimeout: 120,
			logs: false,
			locationTracking: false,
			// Product analytics does not need Advertising ID for Phase 8A.
			advIdentifiersTracking: false,
			crashReporting: true,
			sessionsAutoTracking: true,
			appOpenTrackingEnabled: true,
			statisticsSending: true,
		})
		logger.info('AppMetrica activated')
	} catch (error) {
		logger.error('AppMetrica activation failed', error)
		// Do not rethrow — app must continue.
	}
}

/** Test helper — reset activation guard between suites. */
export function resetAppMetricaActivationForTests (): void {
	activated = false
}

export function reportAppMetricaEvent (
	name: string,
	attributes?: Record<string, string | number | boolean>,
): void {
	if (!shouldActivateAppMetrica()) {
		return
	}
	try {
		const AppMetrica = getAppMetrica()
		if (!AppMetrica) {
			return
		}
		if (attributes && Object.keys(attributes).length > 0) {
			AppMetrica.reportEvent(name, attributes)
		} else {
			AppMetrica.reportEvent(name)
		}
	} catch (error) {
		logger.error('AppMetrica reportEvent failed', error)
	}
}

export function reportAppMetricaError (
	identifier: string,
	message?: string,
): void {
	if (!shouldActivateAppMetrica()) {
		return
	}
	try {
		const AppMetrica = getAppMetrica()
		if (!AppMetrica) {
			return
		}
		AppMetrica.reportError(identifier, message)
	} catch (error) {
		logger.error('AppMetrica reportError failed', error)
	}
}
