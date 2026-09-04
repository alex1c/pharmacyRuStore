import { ReactNode } from 'react'
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native'

import { colors, radii, touchTarget } from '@/constants/theme'

interface IconButtonProps {
	children: ReactNode
	onPress: () => void
	accessibilityLabel: string
	disabled?: boolean
	style?: StyleProp<ViewStyle>
}

/**
 * Icon-only control. accessibilityLabel is required because the visual alone is insufficient.
 */
export function IconButton ({
	children,
	onPress,
	accessibilityLabel,
	disabled = false,
	style,
}: IconButtonProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			hitSlop={8}
			style={({ pressed }) => [
				styles.button,
				pressed && !disabled ? styles.pressed : null,
				disabled ? styles.disabled : null,
				style,
			]}
		>
			{children}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	button: {
		minWidth: touchTarget.min,
		minHeight: touchTarget.min,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.surfaceMuted,
	},
	pressed: {
		backgroundColor: colors.primarySoft,
	},
	disabled: {
		opacity: 0.45,
	},
})
