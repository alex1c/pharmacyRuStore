import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { colors, spacing, typography } from '@/constants/theme'
import { Card } from './Card'

interface EmptyStateProps {
	title: string
	description?: string
	icon?: keyof typeof Ionicons.glyphMap
}

/**
 * Friendly empty placeholder for unfinished or empty feature areas.
 */
export function EmptyState ({
	title,
	description,
	icon = 'leaf-outline',
}: EmptyStateProps) {
	return (
		<Card style={styles.card}>
			<View style={styles.iconWrap} accessibilityElementsHidden>
				<Ionicons name={icon} size={36} color={colors.primary} />
			</View>
			<Text style={styles.title}>{title}</Text>
			{description ? (
				<Text style={styles.description}>{description}</Text>
			) : null}
		</Card>
	)
}

const styles = StyleSheet.create({
	card: {
		alignItems: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.xl,
		paddingHorizontal: spacing.lg,
	},
	iconWrap: {
		width: 64,
		height: 64,
		borderRadius: 32,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.primarySoft,
		marginBottom: spacing.xs,
	},
	title: {
		...typography.section,
		textAlign: 'center',
		color: colors.text,
	},
	description: {
		...typography.bodySmall,
		textAlign: 'center',
		color: colors.textSecondary,
	},
})
