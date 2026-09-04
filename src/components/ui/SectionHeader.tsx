import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

interface SectionHeaderProps {
	title: string
	subtitle?: string
}

/**
 * Section title used above lists and grouped content.
 */
export function SectionHeader ({ title, subtitle }: SectionHeaderProps) {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>{title}</Text>
			{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		gap: spacing.xxs,
		marginBottom: spacing.sm,
		marginTop: spacing.md,
	},
	title: {
		...typography.section,
		color: colors.text,
	},
	subtitle: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
})
