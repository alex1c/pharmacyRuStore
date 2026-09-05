/**
 * Runtime interstitial session policy — one delayed interstitial per cold start.
 */

export type MeaningfulAdAction =
	| 'medicine_saved'
	| 'batch_saved'
	| 'shopping_completed'
	| 'storage_saved'
	| 'settings_saved'
	| 'screen_browse'

/** Actions that must never unlock or trigger interstitial. */
export type MedicalAdAction =
	| 'intake_taken'
	| 'intake_skipped'
	| 'intake_snoozed'
	| 'notification_open'

export type InterstitialTrigger =
	| 'medicine_saved'
	| 'batch_saved'
	| 'shopping_completed'
	| 'storage_saved'

export interface AdSessionPolicyConfig {
	minSessionAgeMs: number
	minMeaningfulActions: number
	maxInterstitialsPerSession: number
	minimumInterstitialIntervalMs: number
	/** Block interstitial for this long after a medication notification open. */
	notificationBlockMs: number
}

export const DEFAULT_AD_SESSION_POLICY: AdSessionPolicyConfig = {
	minSessionAgeMs: 3 * 60 * 1000,
	minMeaningfulActions: 4,
	maxInterstitialsPerSession: 1,
	minimumInterstitialIntervalMs: 10 * 60 * 1000,
	notificationBlockMs: 5 * 60 * 1000,
}

interface AdSessionState {
	sessionStartedAt: number
	meaningfulActionCount: number
	interstitialShownCount: number
	lastInterstitialAt: number | null
	notificationOpenedAt: number | null
}

let state: AdSessionState = createFreshState()
let policyConfig: AdSessionPolicyConfig = { ...DEFAULT_AD_SESSION_POLICY }

function createFreshState (): AdSessionState {
	return {
		sessionStartedAt: Date.now(),
		meaningfulActionCount: 0,
		interstitialShownCount: 0,
		lastInterstitialAt: null,
		notificationOpenedAt: null,
	}
}

/** Cold-start / test reset. */
export function resetAdSessionForTests (
	config?: Partial<AdSessionPolicyConfig>,
): void {
	policyConfig = { ...DEFAULT_AD_SESSION_POLICY, ...config }
	state = createFreshState()
}

export function startAdSession (
	now: number = Date.now(),
	config?: Partial<AdSessionPolicyConfig>,
): void {
	if (config) {
		policyConfig = { ...DEFAULT_AD_SESSION_POLICY, ...config }
	}
	state = {
		...createFreshState(),
		sessionStartedAt: now,
	}
}

export function getAdSessionState (): Readonly<AdSessionState> {
	return { ...state }
}

export function getAdSessionPolicyConfig (): AdSessionPolicyConfig {
	return { ...policyConfig }
}

/**
 * Medical actions never increase eligibility counters.
 */
export function recordMedicalAdAction (_action: MedicalAdAction): void {
	// Intentionally no-op for eligibility.
}

export function recordNotificationOpen (now: number = Date.now()): void {
	state.notificationOpenedAt = now
}

export function recordMeaningfulAdAction (
	_action: MeaningfulAdAction,
): void {
	state.meaningfulActionCount += 1
}

export function markInterstitialShown (now: number = Date.now()): void {
	state.interstitialShownCount += 1
	state.lastInterstitialAt = now
}

/**
 * Whether an interstitial is allowed by session rules (ignores SDK readiness).
 */
export function isInterstitialEligible (
	now: number = Date.now(),
): boolean {
	if (state.interstitialShownCount >= policyConfig.maxInterstitialsPerSession) {
		return false
	}
	if (now - state.sessionStartedAt < policyConfig.minSessionAgeMs) {
		return false
	}
	if (state.meaningfulActionCount < policyConfig.minMeaningfulActions) {
		return false
	}
	if (
		state.notificationOpenedAt !== null &&
		now - state.notificationOpenedAt < policyConfig.notificationBlockMs
	) {
		return false
	}
	if (
		state.lastInterstitialAt !== null &&
		now - state.lastInterstitialAt < policyConfig.minimumInterstitialIntervalMs
	) {
		return false
	}
	return true
}

export function isInterstitialTriggerAllowed (
	trigger: InterstitialTrigger,
): boolean {
	return (
		trigger === 'medicine_saved' ||
		trigger === 'batch_saved' ||
		trigger === 'shopping_completed' ||
		trigger === 'storage_saved'
	)
}

/** Test helper — force clock-relative session age without waiting. */
export function setAdSessionStartedAtForTests (startedAt: number): void {
	state.sessionStartedAt = startedAt
}
