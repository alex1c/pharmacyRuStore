/**
 * Runtime sanitization — drops unknown events and forbidden parameter keys.
 */

import {
	AnalyticsEventName,
	AnalyticsEventParams,
	AnalyticsScreen,
	EVENT_PARAM_ALLOWLIST,
	SCREEN_ALIASES,
} from './events'

const KNOWN_EVENTS = new Set<string>(Object.keys(EVENT_PARAM_ALLOWLIST))

/**
 * Returns only allowlisted params for a known event, or null if the event is unknown.
 */
export function sanitizeEventParams<E extends AnalyticsEventName> (
	eventName: E,
	params?: AnalyticsEventParams[E] | Record<string, unknown>,
): AnalyticsEventParams[E] | Record<string, never> {
	const allow = EVENT_PARAM_ALLOWLIST[eventName] as readonly string[]
	if (!params || allow.length === 0) {
		return {} as AnalyticsEventParams[E]
	}
	const out: Record<string, string | number | boolean> = {}
	for (const key of allow) {
		if (!(key in params)) {
			continue
		}
		const value = (params as Record<string, unknown>)[key]
		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			out[key] = value
		}
	}
	return out as AnalyticsEventParams[E]
}

export function isKnownAnalyticsEvent (name: string): name is AnalyticsEventName {
	return KNOWN_EVENTS.has(name)
}

export function resolveAnalyticsScreen (
	name: string,
): AnalyticsScreen | null {
	if (name in SCREEN_ALIASES) {
		return SCREEN_ALIASES[name] ?? null
	}
	return null
}

/**
 * Error context for reporting — only generic `source` category is kept.
 * Never forward arbitrary user/SQL values.
 */
export function sanitizeErrorContext (
	context?: Record<string, unknown>,
): { source?: string } {
	if (!context) {
		return {}
	}
	const source = context.source
	if (typeof source === 'string' && source.length > 0 && source.length < 120) {
		// Strip anything that looks like SQL / user payload markers.
		if (/SELECT |INSERT |UPDATE |DELETE |medicineName|rawCode|serial/i.test(source)) {
			return { source: 'sanitized' }
		}
		return { source: source.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) }
	}
	return {}
}

export function sanitizeErrorMessage (error: unknown): string {
	if (error instanceof Error) {
		const message = error.message || error.name || 'Error'
		// Drop likely SQL / user-entered fragments.
		return message
			.replace(/['"`].{0,80}['"`]/g, "'…'")
			.replace(/\b\d{8,}\b/g, '…')
			.slice(0, 160)
	}
	return 'unknown_error'
}
