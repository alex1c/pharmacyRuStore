/**
 * Reusable sticky banner — hides itself on load failure (no empty hole).
 */

import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'

import { spacing } from '@/constants/theme'
import { AnalyticsEvents, analytics } from '@/services/analytics'
import {
	BannerPlacement,
	adsService,
	getAdsRuntimeConfig,
	getBannerUnitIdForPlacement,
} from '@/services/ads'
import { getYandexAdsModule } from '@/services/ads/yandexAdapter'
import { logger } from '@/services/logging'

interface AppBannerAdProps {
	placement: BannerPlacement
}

/**
 * Bottom sticky banner for approved placements only.
 */
export function AppBannerAd ({ placement }: AppBannerAdProps) {
	const { width: windowWidth } = useWindowDimensions()
	const unitId = useMemo(
		() => getBannerUnitIdForPlacement(placement),
		[placement],
	)
	const stickyWidth = Math.max(320, Math.floor(windowWidth - spacing.md * 2))

	if (!unitId || !adsService.isEnabled()) {
		return null
	}

	// Remount when unit/size inputs change — avoids sync setState resets in effects.
	return (
		<AppBannerAdInner
			key={`${placement}:${unitId}:${stickyWidth}`}
			placement={placement}
			unitId={unitId}
			stickyWidth={stickyWidth}
		/>
	)
}

function AppBannerAdInner ({
	placement,
	unitId,
	stickyWidth,
}: {
	placement: BannerPlacement
	unitId: string
	stickyWidth: number
}) {
	const [adSize, setAdSize] = useState<{
		width: number
		height: number
		native: unknown
	} | null>(null)
	const [visible, setVisible] = useState(false)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		let cancelled = false
		const sdk = getYandexAdsModule()
		if (!sdk) {
			queueMicrotask(() => {
				if (!cancelled) {
					setFailed(true)
				}
			})
			return () => {
				cancelled = true
			}
		}

		void sdk.BannerAdSize.stickySize(stickyWidth)
			.then((next) => {
				if (!cancelled) {
					setAdSize({
						width: next.width,
						height: next.height,
						native: next,
					})
				}
			})
			.catch((error) => {
				logger.debug('Banner size resolve failed', {
					message: error instanceof Error ? error.message : 'unknown',
				})
				if (!cancelled) {
					setFailed(true)
				}
			})

		return () => {
			cancelled = true
		}
	}, [stickyWidth])

	if (failed || !adSize) {
		return null
	}

	const sdk = getYandexAdsModule()
	if (!sdk) {
		return null
	}

	const BannerView = sdk.BannerView
	const config = getAdsRuntimeConfig()

	return (
		<View
			style={[
				styles.wrap,
				visible ? { minHeight: adSize.height } : styles.collapsed,
			]}
			pointerEvents={visible ? 'auto' : 'none'}
			accessibilityElementsHidden={!visible}
			importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
		>
			{/* Native ad content — do not overlay fake labels. */}
			<BannerView
				size={adSize.native}
				adRequest={{ adUnitId: unitId }}
				style={{ width: adSize.width, height: adSize.height }}
				onAdLoaded={() => {
					setVisible(true)
					analytics.trackEvent(AnalyticsEvents.AD_BANNER_LOADED, {
						placement,
						format: 'banner',
					})
					if (config.useDemoUnits) {
						logger.debug('Demo banner loaded', { placement })
					}
				}}
				onAdFailedToLoad={() => {
					setFailed(true)
					setVisible(false)
					analytics.trackEvent(AnalyticsEvents.AD_BANNER_FAILED, {
						placement,
						format: 'banner',
					})
				}}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: spacing.md,
		marginBottom: spacing.sm,
	},
	collapsed: {
		minHeight: 0,
		height: 0,
		overflow: 'hidden',
		marginTop: 0,
		marginBottom: 0,
	},
})
