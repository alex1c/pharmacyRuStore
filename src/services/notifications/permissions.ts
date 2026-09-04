import { NotificationNativeClient, NotificationPermissionState } from './types'
import { createExpoNotificationClient } from './nativeClient'

let clientOverride: NotificationNativeClient | null = null
let cachedClient: NotificationNativeClient | null = null

/**
 * Returns the active notification client (injectable for tests).
 */
export function getNotificationClient (): NotificationNativeClient {
	if (clientOverride) {
		return clientOverride
	}
	if (!cachedClient) {
		cachedClient = createExpoNotificationClient()
	}
	return cachedClient
}

/** Test helper — inject a mock native client. */
export function setNotificationClientForTests (
	client: NotificationNativeClient | null,
): void {
	clientOverride = client
}

export async function getNotificationPermissionState (): Promise<NotificationPermissionState> {
	return getNotificationClient().getPermissionState()
}

export async function requestNotificationPermissions (): Promise<NotificationPermissionState> {
	return getNotificationClient().requestPermissions()
}

export async function openNotificationSystemSettings (): Promise<void> {
	return getNotificationClient().openSystemSettings()
}

/**
 * Explains reminders then optionally requests system permission.
 * Never blocks course creation — caller decides UX.
 */
export async function ensureReminderPermissionInteractive (): Promise<NotificationPermissionState> {
	const current = await getNotificationPermissionState()
	if (current.status === 'granted') {
		return current
	}
	if (current.status === 'denied' && !current.canAskAgain) {
		return current
	}
	return requestNotificationPermissions()
}
