import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

interface LoadingStateProps {
	message?: string
}

/**
 * Full-screen-ish loading placeholder used during bootstrap and async waits.
 */
export function LoadingState ({
	message = 'Загрузка…',
}: LoadingStateProps) {
	return (
		<View style={styles.container} accessibilityRole="progressbar">
			<ActivityIndicator size="large" color={colors.primary} />
			<Text style={styles.message}>{message}</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.md,
		backgroundColor: colors.background,
		padding: spacing.lg,
	},
	message: {
		...typography.body,
		color: colors.textSecondary,
		textAlign: 'center',
	},
})
