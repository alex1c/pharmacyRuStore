import { useEffect } from 'react'
import { Linking, StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'

import {
	AppHeader,
	Card,
	ListRow,
	Screen,
	SectionHeader,
} from '@/components/ui'
import { AppBannerAd } from '@/components/ads/AppBannerAd'
import { APP_NAME, HEALTH_DISCLAIMER, tabs } from '@/constants/copy'
import { colors, typography } from '@/constants/theme'
import { analytics } from '@/services/analytics'

const SUPPORT_EMAIL =
	(Constants.expoConfig?.extra?.supportEmail as string | undefined) ??
	'rustore-alex1c@yandex.ru'
const PRIVACY_URL =
	(Constants.expoConfig?.extra?.privacyUrl as string | undefined) ??
	'https://alex1c.github.io/pharmacyRuStore/privacy.html'

/**
 * «Ещё» — settings entry points and disclaimer.
 */
export default function MoreScreen () {
	useEffect(() => {
		analytics.trackScreen('more')
	}, [])

	return (
		<Screen scroll>
			<AppHeader
				title={tabs.more.title}
				subtitle={tabs.more.subtitle}
			/>

			<SectionHeader title="Разделы" />
			<Card style={styles.listCard}>
				<ListRow
					title="Аптечки и места хранения"
					subtitle="Управление"
					showChevron
					onPress={() => router.push('/cabinets')}
				/>
				<ListRow
					title="Контроль запасов"
					subtitle="Сроки и низкий остаток"
					showChevron
					onPress={() => router.push('/settings/stock-control')}
				/>
				<ListRow
					title="Напоминания"
					subtitle="Уведомления о приёме"
					showChevron
					onPress={() => router.push('/settings/reminders')}
				/>
				<ListRow
					title="Члены семьи"
					subtitle="Профили для курсов"
					showChevron
					onPress={() => router.push('/family/index')}
				/>
				<ListRow
					title="Резервная копия"
					subtitle="Сохранить и восстановить данные"
					showChevron
					style={styles.rowLast}
					onPress={() => router.push('/settings/backup' as never)}
				/>
			</Card>

			<SectionHeader title="О приложении" />
			<Card style={styles.listCard}>
				<ListRow
					title={APP_NAME}
					subtitle={`Версия ${Constants.expoConfig?.version ?? '1.0.0'}`}
				/>
				<ListRow
					title="Поддержка"
					subtitle={SUPPORT_EMAIL}
					showChevron
					onPress={() => {
						void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)
					}}
				/>
				<ListRow
					title="Политика конфиденциальности"
					subtitle="Открыть в браузере"
					showChevron
					style={styles.rowLast}
					onPress={() => {
						void Linking.openURL(PRIVACY_URL)
					}}
				/>
			</Card>

			<SectionHeader title="Важно" />
			<Card>
				<Text style={styles.disclaimer}>{HEALTH_DISCLAIMER}</Text>
			</Card>
			<AppBannerAd placement="more" />
		</Screen>
	)
}

const styles = StyleSheet.create({
	listCard: {
		padding: 0,
		overflow: 'hidden',
	},
	rowLast: {
		borderBottomWidth: 0,
	},
	disclaimer: {
		...typography.bodySmall,
		color: colors.textSecondary,
		lineHeight: 20,
	},
})
