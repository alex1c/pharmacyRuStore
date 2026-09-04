import { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

import { colors, spacing, typography } from '@/constants/theme'
import { IconButton } from './IconButton'

interface ScreenTopBarProps {
	title: string
	onBack?: () => void
	right?: ReactNode
}

/**
 * Stack-screen top bar with optional back navigation.
 */
export function ScreenTopBar ({ title, onBack, right }: ScreenTopBarProps) {
	const handleBack = onBack ?? (() => router.back())

	return (
		<View style={styles.bar}>
			<IconButton accessibilityLabel="Назад" onPress={handleBack}>
				<Ionicons name="chevron-back" size={22} color={colors.text} />
			</IconButton>
			<Text style={styles.title} numberOfLines={1}>
				{title}
			</Text>
			<View style={styles.right}>{right ?? <View style={styles.spacer} />}</View>
		</View>
	)
}

const styles = StyleSheet.create({
	bar: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingTop: spacing.xs,
		paddingBottom: spacing.sm,
	},
	title: {
		...typography.section,
		flex: 1,
		color: colors.text,
	},
	right: {
		minWidth: 48,
		alignItems: 'flex-end',
	},
	spacer: {
		width: 48,
		height: 48,
	},
})
