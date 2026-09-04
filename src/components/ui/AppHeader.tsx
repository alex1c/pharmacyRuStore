import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

interface AppHeaderProps {
	title: string
	subtitle?: string
}

/**
 * Top-of-screen title block used by tab placeholders and future feature screens.
 */
export function AppHeader ({ title, subtitle }: AppHeaderProps) {
	return (
		<View style={styles.container}>
			<Text style={styles.title} accessibilityRole="header">
				{title}
			</Text>
			{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		paddingTop: spacing.sm,
		paddingBottom: spacing.md,
		gap: spacing.xs,
	},
	title: {
		...typography.title,
		color: colors.text,
	},
	subtitle: {
		...typography.subtitle,
		color: colors.textSecondary,
	},
})
