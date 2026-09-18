/**
 * Banner placement allowlist and safe route classification.
 *
 * Analytics only receives coarse placement names — never medicine/cabinet IDs.
 */

export const BannerPlacements = [
	'today',
	'cabinet',
	'shopping',
	'more',
] as const

export type BannerPlacement = (typeof BannerPlacements)[number]

/** Screens / flows where banners are forbidden. */
export const BANNER_BLOCKED_SCREENS = [
	'intake',
	'history',
	'medicine_edit',
	'medicine_add',
	'batch_edit',
	'batch_add',
	'course_edit',
	'course_add',
	'scanner',
	'scan_result',
	'backup',
	'restore',
	'reminders',
	'family',
	'error',
	'bootstrap',
] as const

export function isBannerPlacementAllowed (
	placement: string,
): placement is BannerPlacement {
	return (BannerPlacements as readonly string[]).includes(placement)
}

/**
 * Normalizes Expo Router pathnames (strips groups, trailing slashes).
 */
export function normalizeAppPathname (
	pathname: string | null | undefined,
): string {
	if (!pathname) {
		return ''
	}
	const withoutGroups = pathname.replace(/\/\([^/]+\)/g, '')
	const trimmed = withoutGroups.replace(/\/+$/, '')
	return trimmed === '' ? '/' : trimmed
}

/**
 * Maps a router pathname to a coarse banner placement, or null when ads
 * must not render (medical forms, unknown routes, bootstrap).
 */
export function resolveBannerPlacementForPathname (
	pathname: string | null | undefined,
): BannerPlacement | null {
	const path = normalizeAppPathname(pathname)

	if (path === '/' || path === '/index') {
		return 'today'
	}
	if (path === '/cabinet') {
		return 'cabinet'
	}
	if (path === '/shopping') {
		return 'shopping'
	}
	if (path === '/more') {
		return 'more'
	}

	// Medical / form / management routes stay ad-free.
	if (
		path.startsWith('/medicines') ||
		path.startsWith('/scan') ||
		path.startsWith('/courses') ||
		path.startsWith('/family') ||
		path.startsWith('/settings') ||
		path.startsWith('/cabinets') ||
		path === '/intake' ||
		path.startsWith('/intake/')
	) {
		return null
	}

	// Unknown routes never show a banner.
	return null
}
