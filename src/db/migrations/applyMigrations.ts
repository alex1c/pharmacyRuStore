import { SqlExecutor } from '../sqlExecutor'
import { LATEST_SCHEMA_VERSION, migrations } from './index'

/**
 * Applies pending migrations in a transaction-friendly order.
 * Records each applied version in schema_migrations.
 */
export async function applyMigrations (db: SqlExecutor): Promise<number> {
	await db.execAsync(`
		PRAGMA foreign_keys = ON;
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY NOT NULL,
			applied_at TEXT NOT NULL
		);
	`)

	const current = await getSchemaVersion(db)

	for (const migration of migrations) {
		if (migration.version <= current) {
			continue
		}

		const apply = async () => {
			await db.execAsync(migration.sql)
			await db.runAsync(
				`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
				[migration.version, new Date().toISOString()],
			)
		}

		if (db.withTransactionAsync) {
			await db.withTransactionAsync(apply)
		} else {
			await apply()
		}
	}

	return getSchemaVersion(db)
}

export async function getSchemaVersion (db: SqlExecutor): Promise<number> {
	const row = await db.getFirstAsync<{ version: number }>(
		`SELECT MAX(version) AS version FROM schema_migrations`,
	)
	return row?.version ?? 0
}

export function getLatestSchemaVersion (): number {
	return LATEST_SCHEMA_VERSION
}
