import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import * as Linking from 'expo-linking'

import {
	MEDICATION_REMINDER_CHANNEL_DESCRIPTION,
	MEDICATION_REMINDER_CHANNEL_ID,
	MEDICATION_REMINDER_CHANNEL_NAME,
	NotificationNativeClient,
	NotificationPermissionState,
} from './types'

/**
 * Production Expo Notifications client (local only — no push tokens).
 */
export function createExpoNotificationClient (): NotificationNativeClient {
	return {
		async ensureChannel () {
			if (Platform.OS !== 'android') {
				return
			}
			await Notifications.setNotificationChannelAsync(
				MEDICATION_REMINDER_CHANNEL_ID,
				{
					name: MEDICATION_REMINDER_CHANNEL_NAME,
					description: MEDICATION_REMINDER_CHANNEL_DESCRIPTION,
					importance: Notifications.AndroidImportance.HIGH,
					vibrationPattern: [0, 250, 250, 250],
					sound: 'default',
					enableVibrate: true,
				},
			)
		},

		async getPermissionState () {
			const settings = await Notifications.getPermissionsAsync()
			return mapPermission(settings)
		},

		async requestPermissions () {
			const settings = await Notifications.requestPermissionsAsync()
			return mapPermission(settings)
		},

		async scheduleReminder (input) {
			const identifier = await Notifications.scheduleNotificationAsync({
				identifier: input.identifier,
				content: {
					title: input.title,
					body: input.body,
					data: input.data,
					sound: true,
				},
				trigger: {
					type: Notifications.SchedulableTriggerInputTypes.DATE,
					date: input.triggerAt,
					channelId: input.channelId,
				},
			})
			return identifier
		},

		async cancelReminder (nativeNotificationId) {
			await Notifications.cancelScheduledNotificationAsync(
				nativeNotificationId,
			)
		},

		async getScheduledIds () {
			const items = await Notifications.getAllScheduledNotificationsAsync()
			return items.map((item) => item.identifier)
		},

		async openSystemSettings () {
			await Linking.openSettings()
		},
	}
}

function mapPermission (
	settings: Notifications.NotificationPermissionsStatus,
): NotificationPermissionState {
	const status =
		settings.granted || settings.status === 'granted'
			? 'granted'
			: settings.status === 'undetermined'
				? 'undetermined'
				: 'denied'

	return {
		status,
		canAskAgain: settings.canAskAgain !== false,
	}
}

/**
 * Foreground presentation — show banner/list/sound for local medication reminders.
 */
export function configureForegroundNotificationHandler (): void {
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowBanner: true,
			shouldShowList: true,
			shouldPlaySound: true,
			shouldSetBadge: false,
		}),
	})
}
