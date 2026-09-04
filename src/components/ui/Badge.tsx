import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native'

import { colors, radii, spacing, typography } from '@/constants/theme'

type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'muted'

interface BadgeProps {
	label: string
	tone?: BadgeTone
	style?: StyleProp<ViewStyle>
}

const toneStyles: Record<BadgeTone, { bg: string; text: string }> = {
	primary: { bg: colors.primarySoft, text: colors.primaryDark },
	success: { bg: '#E3F6EC', text: colors.success },
	warning: { bg: '#FBF0D0', text: '#8A6A0A' },
	danger: { bg: '#F8E4E4', text: colors.danger },
	muted: { bg: colors.surfaceMuted, text: colors.muted },
}

/**
 * Compact status badge for expiry / stock states in later phases.
 */
export function Badge ({ label, tone = 'primary', style }: BadgeProps) {
	const palette = toneStyles[tone]

	return (
		<View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
			<Text style={[styles.label, { color: palette.text }]}>{label}</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	badge: {
		alignSelf: 'flex-start',
		borderRadius: radii.full,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xxs,
	},
	label: {
		...typography.caption,
		fontWeight: '600',
	},
})
