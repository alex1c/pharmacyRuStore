import { useCallback, useEffect, useState } from 'react'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'

import { initializeDatabase, InitializedDatabase } from '@/db/database'
import { analytics } from '@/services/analytics'
import { logger } from '@/services/logging'
import {
	configureForegroundNotificationHandler,
	safeSyncMedicationReminders,
} from '@/services/notifications'

type BootstrapStatus = 'loading' | 'ready' | 'error'

interface BootstrapState {
	status: BootstrapStatus
	database: InitializedDatabase | null
	errorMessage: string | null
	retry: () => void
}

/**
 * Controls startup: open DB → migrations → first-run seed → ready.
 * Notification channel + reminder reconcile run after DB is ready (non-fatal).
 */
export function useAppBootstrap (): BootstrapState {
	const [status, setStatus] = useState<BootstrapStatus>('loading')
	const [database, setDatabase] = useState<InitializedDatabase | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [attempt, setAttempt] = useState(0)

	const retry = useCallback(() => {
		setStatus('loading')
		setErrorMessage(null)
		setAttempt((value) => value + 1)
	}, [])

	useEffect(() => {
		let cancelled = false

		async function run () {
			try {
				logger.info('Starting database bootstrap')
				const initialized = await initializeDatabase()
				if (cancelled) {
					return
				}
				setDatabase(initialized)
				setStatus('ready')
				analytics.trackEvent('app_bootstrap_ok', {
					schemaVersion: initialized.schemaVersion,
					seeded: initialized.seed.seeded,
				})
				logger.info('Database bootstrap complete', {
					schemaVersion: initialized.schemaVersion,
					seeded: initialized.seed.seeded,
				})

				// Notification init must never fail app startup.
				try {
					configureForegroundNotificationHandler()
					await safeSyncMedicationReminders(
						initialized.executor,
						initialized.seed.household.id,
						{ defaultPersonName: initialized.seed.person.name },
					)
				} catch (error) {
					logger.error('Notification bootstrap failed', error)
					analytics.reportError(error, {
						source: 'useAppBootstrap.notifications',
					})
				}
			} catch (error) {
				if (cancelled) {
					return
				}
				logger.error('Database bootstrap failed', error)
				analytics.reportError(error, { source: 'useAppBootstrap' })
				setDatabase(null)
				setErrorMessage(
					error instanceof Error ? error.message : 'unknown_db_error',
				)
				setStatus('error')
			}
		}

		void run()

		return () => {
			cancelled = true
		}
	}, [attempt])

	// Tap on medication reminder → Today (safe fallback).
	useEffect(() => {
		const subscription = Notifications.addNotificationResponseReceivedListener(
			() => {
				try {
					router.push('/(tabs)')
				} catch (error) {
					analytics.reportError(error, {
						source: 'notificationResponse.navigate',
					})
				}
			},
		)
		return () => {
			subscription.remove()
		}
	}, [])

	return { status, database, errorMessage, retry }
}
