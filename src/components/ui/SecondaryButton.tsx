import {
	Pressable,
	StyleSheet,
	Text,
	ViewStyle,
	StyleProp,
} from 'react-native'

import { colors, radii, spacing, touchTarget, typography } from '@/constants/theme'

interface SecondaryButtonProps {
	label: string
	onPress: () => void
	disabled?: boolean
	style?: StyleProp<ViewStyle>
	accessibilityLabel?: string
}

/**
 * Outlined secondary action button.
 */
export function SecondaryButton ({
	label,
	onPress,
	disabled = false,
	style,
	accessibilityLabel,
}: SecondaryButtonProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				pressed && !disabled ? styles.pressed : null,
				disabled ? styles.disabled : null,
				style,
			]}
		>
			<Text style={styles.label}>{label}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	button: {
		minHeight: touchTarget.min,
		borderRadius: radii.md,
		borderWidth: 1.5,
		borderColor: colors.primary,
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
	},
	pressed: {
		backgroundColor: colors.primarySoft,
	},
	disabled: {
		opacity: 0.5,
	},
	label: {
		...typography.button,
		color: colors.primary,
	},
})
