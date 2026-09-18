import { ReactNode, useEffect, useState } from 'react'
import {
	Keyboard,
	ScrollView,
	StyleSheet,
	View,
	ViewStyle,
	StyleProp,
} from 'react-native'
import { usePathname } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppBannerAd } from '@/components/ads/AppBannerAd'
import { colors, spacing } from '@/constants/theme'
import { resolveBannerPlacementForPathname } from '@/services/ads/placements'

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
 * Banner (when allowed) docks below content — outside ScrollView — and
 * collapses fully when the keyboard is open or the ad fails to load.
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

	const showDock = Boolean(placement) && !keyboardVisible

	// Include bottom inset so primary actions on stack screens (e.g. «Сохранить»
	// on pack forms) stay above the Android system navigation gesture bar.
	// Inside tab scenes the tab bar already consumes the inset, so bottom is
	// typically 0 and we do not double-pad above the tab bar.
	return (
		<SafeAreaView
			style={[styles.safe, style]}
			edges={['top', 'bottom']}
			testID={testID}
		>
			<View style={styles.flex}>
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
	flex: {
		flex: 1,
	},
	content: {
		flexGrow: 1,
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.lg,
	},
	bannerDock: {
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.sm,
		backgroundColor: colors.background,
	},
})
