import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { colors, spacing, typography } from '@/constants/theme'
import { PrimaryButton } from './PrimaryButton'
import { Card } from './Card'

interface ErrorStateProps {
	title: string
	message: string
	actionLabel?: string
	onRetry?: () => void
}

/**
 * User-friendly error fallback without stack traces.
 */
export function ErrorState ({
	title,
	message,
	actionLabel = 'Повторить',
	onRetry,
}: ErrorStateProps) {
	return (
		<View style={styles.container}>
			<Card style={styles.card}>
				<View style={styles.iconWrap} accessibilityElementsHidden>
					<Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
				</View>
				<Text style={styles.title}>{title}</Text>
				<Text style={styles.message}>{message}</Text>
				{onRetry ? (
					<PrimaryButton
						label={actionLabel}
						onPress={onRetry}
						style={styles.button}
					/>
				) : null}
			</Card>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		padding: spacing.lg,
		backgroundColor: colors.background,
	},
	card: {
		alignItems: 'center',
		gap: spacing.sm,
	},
	iconWrap: {
		marginBottom: spacing.xs,
	},
	title: {
		...typography.section,
		textAlign: 'center',
		color: colors.text,
	},
	message: {
		...typography.bodySmall,
		textAlign: 'center',
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	button: {
		alignSelf: 'stretch',
		marginTop: spacing.xs,
	},
})
