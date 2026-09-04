import { ReactNode } from 'react'
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native'

import { colors, radii, shadows, spacing } from '@/constants/theme'

interface CardProps {
	children: ReactNode
	style?: StyleProp<ViewStyle>
}

/**
 * Lightweight surface card — soft border, minimal elevation.
 */
export function Card ({ children, style }: CardProps) {
	return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surface,
		borderRadius: radii.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		padding: spacing.md,
		...shadows.card,
	},
})
