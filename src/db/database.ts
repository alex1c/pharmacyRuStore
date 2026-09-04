import * as SQLite from 'expo-sqlite'

import { applyMigrations, getSchemaVersion } from './migrations/applyMigrations'
import { ensureFirstRunDefaults, FirstRunSeedResult } from './seed'
import { SqlExecutor, SqlParams } from './sqlExecutor'

const DATABASE_NAME = 'pharmacy.db'

export interface InitializedDatabase {
	db: SQLite.SQLiteDatabase
	executor: SqlExecutor
	schemaVersion: number
	seed: FirstRunSeedResult
}

/**
 * Opens SQLite, enables foreign keys + WAL, applies migrations, seeds defaults.
 * Call once during controlled app startup before rendering main UI.
 */
export async function initializeDatabase (): Promise<InitializedDatabase> {
	const db = await SQLite.openDatabaseAsync(DATABASE_NAME)
	const executor = createExpoSqlExecutor(db)

	await executor.execAsync(`
		PRAGMA foreign_keys = ON;
		PRAGMA journal_mode = WAL;
	`)

	const schemaVersion = await applyMigrations(executor)
	const { ensureAppSettings } = await import('./repositories/settings')
	await ensureAppSettings(executor)
	const seed = await ensureFirstRunDefaults(executor)

	return { db, executor, schemaVersion, seed }
}

/**
 * Test / recovery helper — closes and deletes the on-device database file.
 * Not used by production UI paths.
 */
export async function deleteDatabaseForTests (): Promise<void> {
	await SQLite.deleteDatabaseAsync(DATABASE_NAME)
}

export function createExpoSqlExecutor (
	db: SQLite.SQLiteDatabase,
): SqlExecutor {
	// Expo's regular async transaction is not exclusive. Serialize all transaction
	// entry points on this connection so two UI actions cannot interleave their
	// read/plan/write sequences (notably medication intake double-taps).
	let transactionTail: Promise<void> = Promise.resolve()
	const executor: SqlExecutor = {
		execAsync: (source) => db.execAsync(source),
		runAsync: async (source, params = []) => {
			const result = await db.runAsync(source, params)
			return {
				changes: result.changes,
				lastInsertRowId: result.lastInsertRowId,
			}
		},
		getFirstAsync: <T>(source: string, params: SqlParams = []) =>
			db.getFirstAsync<T>(source, params),
		getAllAsync: <T>(source: string, params: SqlParams = []) =>
			db.getAllAsync<T>(source, params),
		// Expo's withTransactionAsync returns Promise<void>; capture task result manually.
		withTransactionAsync: <T>(task: () => Promise<T>): Promise<T> => {
			const transaction = transactionTail.then(async () => {
				let result!: T
				await db.withTransactionAsync(async () => {
					result = await task()
				})
				return result
			})
			transactionTail = transaction.then(() => undefined, () => undefined)
			return transaction
		},
	}
	return executor
}

export { getSchemaVersion }
export type { SqlExecutor }
