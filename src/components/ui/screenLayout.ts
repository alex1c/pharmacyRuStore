/**
 * Layout helpers for the shared Screen shell (no React Native imports).
 */

/**
 * Safe-area edges for Screen: tabs omit bottom (tab bar owns inset);
 * stack screens keep bottom so the banner clears system navigation.
 */
export function resolveScreenSafeAreaEdges (
	inTabs: boolean,
): readonly ('top' | 'bottom')[] {
	return inTabs ? ['top'] : ['top', 'bottom']
}

/**
 * Whether a docked banner should render for the current UI state.
 * Keyboard open → hide dock entirely (no reserved empty space).
 */
export function shouldShowBannerDock (options: {
	placementAllowed: boolean
	showBannerProp: boolean
	keyboardVisible: boolean
}): boolean {
	return (
		options.showBannerProp &&
		options.placementAllowed &&
		!options.keyboardVisible
	)
}
