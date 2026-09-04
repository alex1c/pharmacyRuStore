import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	ViewStyle,
	StyleProp,
} from 'react-native'

import { colors, radii, spacing, touchTarget, typography } from '@/constants/theme'

interface PrimaryButtonProps {
	label: string
	onPress: () => void
	disabled?: boolean
	loading?: boolean
	style?: StyleProp<ViewStyle>
	accessibilityLabel?: string
}

/**
 * Primary call-to-action with a large touch target.
 */
export function PrimaryButton ({
	label,
	onPress,
	disabled = false,
	loading = false,
	style,
	accessibilityLabel,
}: PrimaryButtonProps) {
	const isDisabled = disabled || loading

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={{ disabled: isDisabled, busy: loading }}
			disabled={isDisabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				pressed && !isDisabled ? styles.pressed : null,
				isDisabled ? styles.disabled : null,
				style,
			]}
		>
			{loading ? (
				<ActivityIndicator color={colors.textInverse} />
			) : (
				<Text style={styles.label}>{label}</Text>
			)}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	button: {
		minHeight: touchTarget.min,
		borderRadius: radii.md,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
	},
	pressed: {
		backgroundColor: colors.primaryDark,
	},
	disabled: {
		opacity: 0.5,
	},
	label: {
		...typography.button,
		color: colors.textInverse,
	},
})
