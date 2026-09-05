/**
 * Phase 8A — privacy-safe AppMetrica analytics layer tests.
 */

import {
	AnalyticsEvents,
	analytics,
	getAnalyticsRuntimeStateForTests,
	initializeAnalytics,
	resetAnalyticsRuntimeForTests,
	setAnalyticsReporterForTests,
	trackAppOpenOnce,
} from '@/services/analytics'
import { sanitizeEventParams, sanitizeErrorMessage } from '@/services/analytics/sanitize'
import {
	activateAppMetricaOnce,
	resetAppMetricaActivationForTests,
} from '@/services/analytics/appMetricaAdapter'

describe('analytics sanitization', () => {
	beforeEach(() => {
		resetAnalyticsRuntimeForTests()
	})

	it('medicine_created allows source=scan and drops forbidden keys', () => {
		const sanitized = sanitizeEventParams(AnalyticsEvents.MEDICINE_CREATED, {
			source: 'scan',
			medicineName: 'Нурофен',
			personName: 'Анна',
			rawCode: '4601234567890',
			serial: 'ABC',
			notes: 'secret',
		} as never)

		expect(sanitized).toEqual({ source: 'scan' })
		expect(JSON.stringify(sanitized)).not.toContain('Нурофен')
		expect(JSON.stringify(sanitized)).not.toContain('Анна')
		expect(JSON.stringify(sanitized)).not.toContain('4601234567890')
	})

	it('scan_success keeps code_type and drops raw/gtin/serial', () => {
		const events: Array<{ name: string; attrs?: Record<string, unknown> }> = []
		setAnalyticsReporterForTests({
			event: (name, attrs) => {
				events.push({ name, attrs })
			},
			error: () => undefined,
		})

		analytics.trackEvent(AnalyticsEvents.SCAN_SUCCESS, {
			code_type: 'datamatrix',
			// @ts-expect-error intentional forbidden keys for runtime defense test
			rawData: 'SENSITIVE_RAW_CODE_MARKER',
			gtin: '04601234567890',
			serial: 'SERIAL_MARKER',
		})

		expect(events).toHaveLength(1)
		expect(events[0]?.name).toBe('scan_success')
		expect(events[0]?.attrs).toEqual({ code_type: 'datamatrix' })
		expect(JSON.stringify(events[0])).not.toContain('SENSITIVE_RAW_CODE_MARKER')
		expect(JSON.stringify(events[0])).not.toContain('SERIAL_MARKER')
		expect(JSON.stringify(events[0])).not.toContain('04601234567890')
	})

	it('reportError does not forward arbitrary sensitive context', () => {
		const errors: Array<{ id: string; message?: string }> = []
		setAnalyticsReporterForTests({
			event: () => undefined,
			error: (id, message) => {
				errors.push({ id, message })
			},
		})

		const err = new Error(
			'SQL INSERT INTO medicines VALUES (\'SENSITIVE_MED_MARKER\')',
		)
		analytics.reportError(err, {
			source: 'Inventory.save',
			// @ts-expect-error arbitrary context must not be forwarded
			medicineName: 'SENSITIVE_MED_MARKER',
			rawSql: 'SELECT * FROM people WHERE name=\'Анна\'',
			note: 'patient note',
		})

		expect(errors).toHaveLength(1)
		expect(errors[0]?.id).toBe('Inventory.save')
		expect(JSON.stringify(errors[0])).not.toContain('SENSITIVE_MED_MARKER')
		expect(JSON.stringify(errors[0])).not.toContain('Анна')
		expect(JSON.stringify(errors[0])).not.toContain('rawSql')
		expect(JSON.stringify(errors[0])).not.toContain('patient note')
	})

	it('sanitizeErrorMessage redacts quoted fragments', () => {
		const message = sanitizeErrorMessage(
			new Error('failed near \'Nurofen 200\' with 4607041234567'),
		)
		expect(message).not.toContain('Nurofen')
		expect(message).not.toContain('4607041234567')
	})
})

describe('analytics failure isolation', () => {
	beforeEach(() => {
		resetAnalyticsRuntimeForTests()
	})

	it('does not throw when reporter throws — business action stays successful', () => {
		setAnalyticsReporterForTests({
			event: () => {
				throw new Error('appmetrica_down')
			},
			error: () => {
				throw new Error('appmetrica_error_down')
			},
		})

		expect(() => {
			analytics.trackEvent(AnalyticsEvents.MEDICINE_CREATED, {
				source: 'manual',
			})
			analytics.trackEvent(AnalyticsEvents.INTAKE_TAKEN)
			analytics.trackEvent(AnalyticsEvents.BACKUP_CREATED, {
				has_media: false,
			})
			analytics.reportError(new Error('x'), { source: 'test' })
		}).not.toThrow()
	})
})

describe('analytics initialization', () => {
	beforeEach(() => {
		resetAnalyticsRuntimeForTests()
		resetAppMetricaActivationForTests()
	})

	it('activate guard runs once across repeated initialize calls', () => {
		initializeAnalytics()
		initializeAnalytics()
		initializeAnalytics()
		const state = getAnalyticsRuntimeStateForTests()
		expect(state.appMetricaActivated).toBe(true)
		// In Jest/__DEV__, native activate is skipped but the once-guard still latches.
		activateAppMetricaOnce()
		expect(getAnalyticsRuntimeStateForTests().appMetricaActivated).toBe(true)
	})

	it('trackAppOpenOnce emits a single app_open', () => {
		const events: string[] = []
		setAnalyticsReporterForTests({
			event: (name) => {
				events.push(name)
			},
			error: () => undefined,
		})
		trackAppOpenOnce()
		trackAppOpenOnce()
		trackAppOpenOnce()
		expect(events.filter((name) => name === 'app_open')).toHaveLength(1)
	})
})

describe('screen tracking dedupe', () => {
	beforeEach(() => {
		resetAnalyticsRuntimeForTests()
	})

	it('does not flood duplicate screen_view on repeated renders of same screen', () => {
		const events: Array<{ name: string; attrs?: Record<string, unknown> }> = []
		setAnalyticsReporterForTests({
			event: (name, attrs) => {
				events.push({ name, attrs })
			},
			error: () => undefined,
		})

		analytics.trackScreen('cabinet')
		analytics.trackScreen('cabinet')
		analytics.trackScreen('cabinet')
		expect(events.filter((e) => e.name === 'screen_view')).toHaveLength(1)

		analytics.trackScreen('shopping')
		analytics.trackScreen('cabinet')
		expect(events.filter((e) => e.name === 'screen_view')).toHaveLength(3)
	})
})
