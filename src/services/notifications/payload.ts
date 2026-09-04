import { formatQuantityWithUnit } from '@/utils/quantity'
import { getMedicineUnitShortLabel } from '@/constants/medicineUnits'
import { MedicineUnit } from '@/db/types'
import {
	APP_NOTIFICATION_TITLE,
	MedicationReminderPayload,
} from './types'
import { buildOccurrenceKey } from './occurrenceKey'

/**
 * Builds safe local notification content and data payload.
 */
export function buildReminderContent (input: {
	medicineName: string
	personName: string
	isDefaultPerson: boolean
	doseQuantity: number
	doseUnit: MedicineUnit
	courseId: string
	scheduleId: string
	medicineId: string
	personId: string
	scheduledDate: string
	scheduledTime: string
}): { title: string; body: string; payload: MedicationReminderPayload } {
	const dose = formatQuantityWithUnit(
		input.doseQuantity,
		getMedicineUnitShortLabel(input.doseUnit),
	)
	const body = input.isDefaultPerson
		? `${input.medicineName} · ${dose}`
		: `${input.personName} · ${input.medicineName} · ${dose}`

	const occurrenceKey = buildOccurrenceKey(
		input.scheduleId,
		input.scheduledDate,
		input.scheduledTime,
	)

	return {
		title: APP_NOTIFICATION_TITLE,
		body,
		payload: {
			kind: 'medication_reminder',
			courseId: input.courseId,
			scheduleId: input.scheduleId,
			medicineId: input.medicineId,
			personId: input.personId,
			scheduledDate: input.scheduledDate,
			scheduledTime: input.scheduledTime,
			occurrenceKey,
		},
	}
}

export function payloadToData (
	payload: MedicationReminderPayload,
): Record<string, string> {
	return {
		kind: payload.kind,
		courseId: payload.courseId,
		scheduleId: payload.scheduleId,
		medicineId: payload.medicineId,
		personId: payload.personId,
		scheduledDate: payload.scheduledDate,
		scheduledTime: payload.scheduledTime,
		occurrenceKey: payload.occurrenceKey,
	}
}
