import { ReactNode } from 'react'
import {
	ScrollView,
	StyleSheet,
	View,
	ViewStyle,
	StyleProp,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, spacing } from '@/constants/theme'

interface ScreenProps {
	children: ReactNode
	/** When true, content scrolls vertically. */
	scroll?: boolean
	style?: StyleProp<ViewStyle>
	contentStyle?: StyleProp<ViewStyle>
	testID?: string
}

/**
 * Standard screen shell with safe-area padding and calm background.
 */
export function Screen ({
	children,
	scroll = false,
	style,
	contentStyle,
	testID,
}: ScreenProps) {
	const body = scroll ? (
		<ScrollView
			contentContainerStyle={[styles.content, contentStyle]}
			keyboardShouldPersistTaps="handled"
			showsVerticalScrollIndicator={false}
		>
			{children}
		</ScrollView>
	) : (
		<View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
	)

	return (
		<SafeAreaView style={[styles.safe, style]} edges={['top']} testID={testID}>
			{body}
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	flex: {
		flex: 1,
	},
	content: {
		flexGrow: 1,
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.lg,
	},
})
