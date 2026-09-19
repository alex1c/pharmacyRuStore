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
	'intake',
	'cabinets',
	'family',
	'settings',
	'backup',
	'medicine',
	'course',
] as const

export type BannerPlacement = (typeof BannerPlacements)[number]

/**
 * Flows where banners must never appear (camera / fatal shells).
 * Form screens may show a docked banner while the keyboard is closed;
 * Screen hides the dock when the keyboard opens.
 */
export const BANNER_BLOCKED_SCREENS = [
	'scanner',
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
 * must not render (live camera, unknown routes, bootstrap).
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
	if (path === '/intake' || path.startsWith('/intake/')) {
		return 'intake'
	}

	if (path === '/cabinets' || path.startsWith('/cabinets/')) {
		return 'cabinets'
	}
	if (path === '/family' || path.startsWith('/family/')) {
		return 'family'
	}
	if (path === '/settings/backup' || path.startsWith('/settings/backup/')) {
		return 'backup'
	}
	if (path.startsWith('/settings')) {
		return 'settings'
	}

	if (path.startsWith('/medicines')) {
		return 'medicine'
	}
	if (path.startsWith('/courses')) {
		return 'course'
	}

	// Non-camera scan helpers (result / pick medicine) — coarse medicine bucket.
	if (path === '/scan/result' || path === '/scan/select-medicine') {
		return 'medicine'
	}

	// Live scanner / camera route — never dock a banner here.
	if (path === '/scan' || path.startsWith('/scan/')) {
		return null
	}

	// Unknown routes never show a banner.
	return null
}
