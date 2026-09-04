import { ReactNode } from 'react'
import {
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TextInputProps,
	View,
} from 'react-native'

import { colors, radii, spacing, touchTarget, typography } from '@/constants/theme'

interface TextFieldProps extends TextInputProps {
	label: string
	error?: string | null
	hint?: string
}

/**
 * Labeled text input with optional validation message.
 */
export function TextField ({
	label,
	error,
	hint,
	style,
	...rest
}: TextFieldProps) {
	return (
		<View style={styles.wrap}>
			<Text style={styles.label}>{label}</Text>
			<TextInput
				placeholderTextColor={colors.muted}
				style={[styles.input, error ? styles.inputError : null, style]}
				{...rest}
			/>
			{error ? <Text style={styles.error}>{error}</Text> : null}
			{!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
		</View>
	)
}

interface ChoiceChipProps {
	label: string
	selected: boolean
	onPress: () => void
}

export function ChoiceChip ({ label, selected, onPress }: ChoiceChipProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[styles.chip, selected ? styles.chipSelected : null]}
		>
			<Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
				{label}
			</Text>
		</Pressable>
	)
}

interface ChipGroupProps {
	label: string
	children: ReactNode
	error?: string | null
}

export function ChipGroup ({ label, children, error }: ChipGroupProps) {
	return (
		<View style={styles.wrap}>
			<Text style={styles.label}>{label}</Text>
			<View style={styles.chips}>{children}</View>
			{error ? <Text style={styles.error}>{error}</Text> : null}
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		gap: spacing.xs,
		marginBottom: spacing.md,
	},
	label: {
		...typography.bodySmall,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	input: {
		minHeight: touchTarget.min,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.surface,
		color: colors.text,
		fontSize: 16,
	},
	inputError: {
		borderColor: colors.danger,
	},
	error: {
		...typography.caption,
		color: colors.danger,
	},
	hint: {
		...typography.caption,
		color: colors.muted,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		borderRadius: radii.full,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		minHeight: 40,
		justifyContent: 'center',
		backgroundColor: colors.surface,
	},
	chipSelected: {
		borderColor: colors.primary,
		backgroundColor: colors.primarySoft,
	},
	chipText: {
		color: colors.textSecondary,
		fontSize: 14,
		fontWeight: '600',
	},
	chipTextSelected: {
		color: colors.primaryDark,
	},
})
