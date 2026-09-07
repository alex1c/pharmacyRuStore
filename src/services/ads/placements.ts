/**
 * Banner placement allowlist — medical-critical screens stay ad-free.
 * v1: cabinet / shopping / more only. Today and Приём have no banners.
 */

export const BannerPlacements = [
	'cabinet',
	'shopping',
	'more',
] as const

export type BannerPlacement = (typeof BannerPlacements)[number]

/** Screens / flows where banners are forbidden. */
export const BANNER_BLOCKED_SCREENS = [
	'today',
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
] as const

export function isBannerPlacementAllowed (
	placement: string,
): placement is BannerPlacement {
	return (BannerPlacements as readonly string[]).includes(placement)
}
