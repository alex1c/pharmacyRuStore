/**
 * Builds a stable occurrence identity shared by intake records and native reminders.
 * Format: scheduleId|YYYY-MM-DD|HH:mm
 */
export function buildOccurrenceKey (
	scheduleId: string,
	scheduledDate: string,
	scheduledTime: string,
): string {
	return `${scheduleId}|${scheduledDate}|${scheduledTime}`
}

export function parseOccurrenceKey (key: string): {
	scheduleId: string
	scheduledDate: string
	scheduledTime: string
} | null {
	const parts = key.split('|')
	if (parts.length !== 3) {
		return null
	}
	const [scheduleId, scheduledDate, scheduledTime] = parts
	if (!scheduleId || !scheduledDate || !scheduledTime) {
		return null
	}
	return { scheduleId, scheduledDate, scheduledTime }
}
