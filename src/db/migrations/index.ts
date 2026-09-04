import { migration001Initial } from './001_initial'
import { migration002Inventory } from './002_inventory'
import { migration003Monitoring } from './003_monitoring'
import { migration004MedicationSchedules } from './004_medication_schedules'
import { migration005MedicationReminders } from './005_medication_reminders'

export interface Migration {
	version: number
	name: string
	sql: string
}

/**
 * Ordered list of schema migrations.
 * Append new migrations — never edit applied SQL in production.
 */
export const migrations: Migration[] = [
	{
		version: 1,
		name: '001_initial',
		sql: migration001Initial,
	},
	{
		version: 2,
		name: '002_inventory',
		sql: migration002Inventory,
	},
	{
		version: 3,
		name: '003_monitoring',
		sql: migration003Monitoring,
	},
	{
		version: 4,
		name: '004_medication_schedules',
		sql: migration004MedicationSchedules,
	},
	{
		version: 5,
		name: '005_medication_reminders',
		sql: migration005MedicationReminders,
	},
]

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0
