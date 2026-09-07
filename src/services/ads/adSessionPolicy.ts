/**
 * Runtime interstitial session policy — one delayed interstitial per cold start.
 */

export type MeaningfulAdAction =
	| 'medicine_saved'
	| 'batch_saved'
	| 'shopping_completed'
	| 'storage_saved'
	| 'settings_saved'
	| 'shopping_manual'

/** Actions that must never unlock or trigger interstitial. */
export type MedicalAdAction =
	| 'intake_taken'
	| 'intake_skipped'
	| 'intake_snoozed'
	| 'intake_prn'
	| 'intake_undo'
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
	minSessionAgeMs: 5 * 60 * 1000,
	minMeaningfulActions: 5,
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

/** Injectable clock for deterministic eligibility tests. */
let nowFn: () => number = () => Date.now()

function now (): number {
	return nowFn()
}

export function setAdClockForTests (clock: (() => number) | null): void {
	nowFn = clock ?? (() => Date.now())
}

function createFreshState (): AdSessionState {
	return {
		sessionStartedAt: now(),
		meaningfulActionCount: 0,
		interstitialShownCount: 0,
		lastInterstitialAt: null,
		notificationOpenedAt: null,
	}
}

let state: AdSessionState = createFreshState()
let policyConfig: AdSessionPolicyConfig = { ...DEFAULT_AD_SESSION_POLICY }

/** Cold-start / test reset. */
export function resetAdSessionForTests (
	config?: Partial<AdSessionPolicyConfig>,
): void {
	policyConfig = { ...DEFAULT_AD_SESSION_POLICY, ...config }
	state = createFreshState()
}

export function startAdSession (
	at: number = now(),
	config?: Partial<AdSessionPolicyConfig>,
): void {
	if (config) {
		policyConfig = { ...DEFAULT_AD_SESSION_POLICY, ...config }
	}
	state = {
		...createFreshState(),
		sessionStartedAt: at,
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

export function recordNotificationOpen (at: number = now()): void {
	state.notificationOpenedAt = at
}

export function recordMeaningfulAdAction (
	_action: MeaningfulAdAction,
): void {
	state.meaningfulActionCount += 1
}

export function markInterstitialShown (at: number = now()): void {
	state.interstitialShownCount += 1
	state.lastInterstitialAt = at
}

/**
 * Whether an interstitial is allowed by session rules (ignores SDK readiness).
 */
export function isInterstitialEligible (
	at: number = now(),
): boolean {
	if (state.interstitialShownCount >= policyConfig.maxInterstitialsPerSession) {
		return false
	}
	if (at - state.sessionStartedAt < policyConfig.minSessionAgeMs) {
		return false
	}
	if (state.meaningfulActionCount < policyConfig.minMeaningfulActions) {
		return false
	}
	if (
		state.notificationOpenedAt !== null &&
		at - state.notificationOpenedAt < policyConfig.notificationBlockMs
	) {
		return false
	}
	if (
		state.lastInterstitialAt !== null &&
		at - state.lastInterstitialAt < policyConfig.minimumInterstitialIntervalMs
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
