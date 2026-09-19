import { ReactNode, useEffect, useState } from 'react'
import {
	Keyboard,
	ScrollView,
	StyleSheet,
	View,
	ViewStyle,
	StyleProp,
} from 'react-native'
import { usePathname, useSegments } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppBannerAd } from '@/components/ads/AppBannerAd'
import { colors, spacing } from '@/constants/theme'
import { resolveBannerPlacementForPathname } from '@/services/ads/placements'
import {
	resolveScreenSafeAreaEdges,
	shouldShowBannerDock,
} from '@/components/ui/screenLayout'

interface ScreenProps {
	children: ReactNode
	/** When true, content scrolls vertically. */
	scroll?: boolean
	/**
	 * When false, suppress the docked banner even if the route allows it
	 * (bootstrap / fatal DB error shells).
	 */
	showBanner?: boolean
	style?: StyleProp<ViewStyle>
	contentStyle?: StyleProp<ViewStyle>
	testID?: string
}

/**
 * Standard screen shell with safe-area padding and calm background.
 *
 * Layout (flex column):
 *   content (flex:1) — ScrollView or View
 *   banner dock (flexShrink:0) — outside ScrollView, collapses when empty
 *
 * Tab scenes omit bottom safe-area edges so the dock sits directly above the
 * tab bar (no large empty gap). Stack scenes keep bottom inset so the dock
 * clears the Android system navigation bar.
 */
export function Screen ({
	children,
	scroll = false,
	showBanner = true,
	style,
	contentStyle,
	testID,
}: ScreenProps) {
	const pathname = usePathname()
	const segments = useSegments()
	const inTabs = segments[0] === '(tabs)'
	const placement = showBanner
		? resolveBannerPlacementForPathname(pathname)
		: null
	const [keyboardVisible, setKeyboardVisible] = useState(false)

	useEffect(() => {
		const show = Keyboard.addListener('keyboardDidShow', () => {
			setKeyboardVisible(true)
		})
		const hide = Keyboard.addListener('keyboardDidHide', () => {
			setKeyboardVisible(false)
		})
		return () => {
			show.remove()
			hide.remove()
		}
	}, [])

	const body = scroll ? (
		<ScrollView
			style={styles.flex}
			contentContainerStyle={[styles.content, contentStyle]}
			keyboardShouldPersistTaps="handled"
			showsVerticalScrollIndicator={false}
		>
			{children}
		</ScrollView>
	) : (
		<View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
	)

	const showDock = shouldShowBannerDock({
		placementAllowed: Boolean(placement),
		showBannerProp: showBanner,
		keyboardVisible,
	})
	const edges = resolveScreenSafeAreaEdges(inTabs)

	return (
		<SafeAreaView
			style={[styles.safe, style]}
			edges={edges}
			testID={testID}
		>
			<View style={styles.column}>
				{body}
				{showDock && placement ? (
					<View style={styles.bannerDock} pointerEvents="box-none">
						<AppBannerAd placement={placement} />
					</View>
				) : null}
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	column: {
		flex: 1,
	},
	flex: {
		flex: 1,
	},
	content: {
		flexGrow: 1,
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.lg,
	},
	/**
	 * Fixed footer slot — no reserved empty height when the ad collapses.
	 * Horizontal / vertical padding lives inside AppBannerAd only when loaded.
	 */
	bannerDock: {
		flexShrink: 0,
	},
})
