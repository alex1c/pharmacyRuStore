import { ReactNode } from 'react'
import {
	Pressable,
	StyleSheet,
	Text,
	View,
	ViewStyle,
	StyleProp,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { colors, spacing, touchTarget, typography } from '@/constants/theme'

interface ListRowProps {
	title: string
	subtitle?: string
	left?: ReactNode
	right?: ReactNode
	onPress?: () => void
	disabled?: boolean
	showChevron?: boolean
	style?: StyleProp<ViewStyle>
	accessibilityLabel?: string
}

/**
 * Standard list row for settings-like screens and entity lists.
 */
export function ListRow ({
	title,
	subtitle,
	left,
	right,
	onPress,
	disabled = false,
	showChevron = false,
	style,
	accessibilityLabel,
}: ListRowProps) {
	const content = (
		<>
			{left ? <View style={styles.left}>{left}</View> : null}
			<View style={styles.textBlock}>
				<Text style={[styles.title, disabled && styles.disabledText]}>
					{title}
				</Text>
				{subtitle ? (
					<Text style={[styles.subtitle, disabled && styles.disabledText]}>
						{subtitle}
					</Text>
				) : null}
			</View>
			{right}
			{showChevron ? (
				<Ionicons
					name="chevron-forward"
					size={18}
					color={disabled ? colors.muted : colors.textSecondary}
				/>
			) : null}
		</>
	)

	if (onPress) {
		return (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel ?? title}
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={onPress}
				style={({ pressed }) => [
					styles.row,
					pressed && !disabled ? styles.pressed : null,
					disabled ? styles.disabled : null,
					style,
				]}
			>
				{content}
			</Pressable>
		)
	}

	return (
		<View
			accessibilityLabel={accessibilityLabel ?? title}
			style={[styles.row, disabled ? styles.disabled : null, style]}
		>
			{content}
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		minHeight: touchTarget.min,
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	pressed: {
		backgroundColor: colors.surfaceMuted,
	},
	disabled: {
		opacity: 0.55,
	},
	left: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	textBlock: {
		flex: 1,
		gap: 2,
	},
	title: {
		...typography.body,
		color: colors.text,
	},
	subtitle: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	disabledText: {
		color: colors.muted,
	},
})
