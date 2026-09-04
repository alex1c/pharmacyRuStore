import { migration001Initial } from './001_initial'

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
]

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0
