import { useCallback, useEffect, useState } from 'react'

import { initializeDatabase, InitializedDatabase } from '@/db/database'
import { analytics } from '@/services/analytics'
import { logger } from '@/services/logging'

type BootstrapStatus = 'loading' | 'ready' | 'error'

interface BootstrapState {
	status: BootstrapStatus
	database: InitializedDatabase | null
	errorMessage: string | null
	retry: () => void
}

/**
 * Controls startup: open DB → migrations → first-run seed → ready.
 * Prevents main UI from rendering until the database layer is safe.
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

	return { status, database, errorMessage, retry }
}
