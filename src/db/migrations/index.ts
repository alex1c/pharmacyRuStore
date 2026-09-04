import { migration001Initial } from './001_initial'
import { migration002Inventory } from './002_inventory'
import { migration003Monitoring } from './003_monitoring'

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
]

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0
