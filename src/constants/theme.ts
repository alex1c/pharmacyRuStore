/**
 * Design tokens for «Моя аптечка».
 * Calm medical-friendly palette with soft teal accents.
 */

export const colors = {
	primary: '#2A9D8F',
	primaryDark: '#1F7A70',
	primarySoft: '#D8F3EF',
	secondary: '#4A90A4',
	background: '#F7FBFA',
	surface: '#FFFFFF',
	surfaceMuted: '#EEF5F3',
	border: '#D5E5E1',
	text: '#1A2B28',
	textSecondary: '#5C726D',
	textInverse: '#FFFFFF',
	success: '#2F9E6B',
	warning: '#D4A017',
	danger: '#C45C5C',
	muted: '#8A9E99',
	overlay: 'rgba(26, 43, 40, 0.45)',
	focus: '#2A9D8F',
} as const

export const semanticColors = {
	primary: colors.primary,
	success: colors.success,
	warning: colors.warning,
	danger: colors.danger,
	muted: colors.muted,
	surface: colors.surface,
	/** Expiry / stock status mappings for later phases. */
	expiryOk: colors.success,
	expirySoon: colors.warning,
	expiryExpired: colors.danger,
	stockLow: colors.warning,
} as const

export const spacing = {
	xxs: 4,
	xs: 8,
	sm: 12,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 48,
} as const

export const radii = {
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	full: 999,
} as const

export const typography = {
	title: {
		fontSize: 28,
		lineHeight: 34,
		fontWeight: '700' as const,
		color: colors.text,
	},
	subtitle: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: '500' as const,
		color: colors.textSecondary,
	},
	section: {
		fontSize: 18,
		lineHeight: 24,
		fontWeight: '600' as const,
		color: colors.text,
	},
	body: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: '400' as const,
		color: colors.text,
	},
	bodySmall: {
		fontSize: 14,
		lineHeight: 20,
		fontWeight: '400' as const,
		color: colors.textSecondary,
	},
	caption: {
		fontSize: 12,
		lineHeight: 16,
		fontWeight: '500' as const,
		color: colors.muted,
	},
	button: {
		fontSize: 16,
		lineHeight: 20,
		fontWeight: '600' as const,
	},
} as const

/** Minimum comfortable touch target size (Android accessibility). */
export const touchTarget = {
	min: 48,
} as const

export const shadows = {
	card: {
		shadowColor: '#1A2B28',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 4,
		elevation: 1,
	},
} as const

export type AppColors = typeof colors
export type SemanticColors = typeof semanticColors
