import { SqlExecutor } from '@/db/sqlExecutor'
import { analytics } from '@/services/analytics'
import { logger } from '@/services/logging'
import {
	getNotificationClient,
	syncMedicationReminders,
} from '@/services/notifications'

/**
 * Fire-and-forget safe reminder reconciliation after DB mutations / startup.
 * Never throws to callers — notification failures must not break app flows.
 */
export async function safeSyncMedicationReminders (
	db: SqlExecutor,
	householdId: string,
	options?: { now?: Date; defaultPersonName?: string },
): Promise<void> {
	try {
		await syncMedicationReminders(db, householdId, {
			client: getNotificationClient(),
			now: options?.now,
			defaultPersonName: options?.defaultPersonName,
		})
	} catch (error) {
		logger.error('Medication reminder sync failed', error)
		analytics.reportError(error, { source: 'safeSyncMedicationReminders' })
	}
}
