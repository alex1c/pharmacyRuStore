import { Platform } from 'react-native'
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

/**
 * Builds a direct (non-queued) executor around Expo SQLite callables.
 * Used for transaction-scoped work so nested calls do not re-enter the queue.
 */
function createDirectExecutor (native: {
	execAsync: (source: string) => Promise<void>
	runAsync: (
		source: string,
		params: SqlParams,
	) => Promise<{ changes: number; lastInsertRowId: number }>
	getFirstAsync: <T>(
		source: string,
		params: SqlParams,
	) => Promise<T | null>
	getAllAsync: <T>(
		source: string,
		params: SqlParams,
	) => Promise<T[]>
}): SqlExecutor {
	return {
		execAsync: (source) => native.execAsync(source),
		runAsync: async (source, params = []) => {
			const result = await native.runAsync(source, params)
			return {
				changes: result.changes,
				lastInsertRowId: result.lastInsertRowId,
			}
		},
		getFirstAsync: <T>(source: string, params: SqlParams = []) =>
			native.getFirstAsync<T>(source, params),
		getAllAsync: <T>(source: string, params: SqlParams = []) =>
			native.getAllAsync<T>(source, params),
	}
}

/**
 * Adapts Expo SQLiteDatabase / exclusive Transaction to SqlParams calls.
 * Wrapping avoids overload incompatibility with optional params.
 */
function adaptNativeClient (native: {
	execAsync: (source: string) => Promise<void>
	runAsync: (
		source: string,
		params: SqlParams,
	) => Promise<{ changes: number; lastInsertRowId: number }>
	getFirstAsync: <T>(
		source: string,
		params: SqlParams,
	) => Promise<T | null>
	getAllAsync: <T>(
		source: string,
		params: SqlParams,
	) => Promise<T[]>
}): SqlExecutor {
	return createDirectExecutor({
		execAsync: (source) => native.execAsync(source),
		runAsync: (source, params) => native.runAsync(source, params),
		getFirstAsync: <T>(source: string, params: SqlParams) =>
			native.getFirstAsync<T>(source, params),
		getAllAsync: <T>(source: string, params: SqlParams) =>
			native.getAllAsync<T>(source, params),
	})
}

/**
 * Creates a serializing Expo SQL executor.
 *
 * Why this exists:
 * - Expo's non-exclusive `withTransactionAsync` absorbs unrelated concurrent
 *   queries into the open transaction (see SDK 57 docs). That caused mass
 *   save failures (cabinets, medicines, shopping, settings, family).
 * - All public operations share one queue so they never interleave.
 * - Native uses `withExclusiveTransactionAsync` with a scoped executor.
 * - Web falls back to queued non-exclusive transactions (exclusive API is
 *   unsupported on web).
 * - After a rejected / rolled-back operation the queue continues.
 */
export function createExpoSqlExecutor (
	db: SQLite.SQLiteDatabase,
): SqlExecutor {
	// Serial chain — always advanced even when an operation rejects.
	let operationTail: Promise<void> = Promise.resolve()

	function enqueue<T> (operation: () => Promise<T>): Promise<T> {
		const run = operationTail.then(operation)
		operationTail = run.then(
			() => undefined,
			() => undefined,
		)
		return run
	}

	const supportsExclusive =
		Platform.OS !== 'web' &&
		typeof db.withExclusiveTransactionAsync === 'function'

	const executor: SqlExecutor = {
		execAsync: (source) => enqueue(() => db.execAsync(source)),
		runAsync: (source, params = []) =>
			enqueue(async () => {
				const result = await db.runAsync(source, params)
				return {
					changes: result.changes,
					lastInsertRowId: result.lastInsertRowId,
				}
			}),
		getFirstAsync: <T>(source: string, params: SqlParams = []) =>
			enqueue(() => db.getFirstAsync<T>(source, params)),
		getAllAsync: <T>(source: string, params: SqlParams = []) =>
			enqueue(() => db.getAllAsync<T>(source, params)),
		withTransactionAsync: <T>(
			task: (tx: SqlExecutor) => Promise<T>,
		): Promise<T> =>
			enqueue(async () => {
				if (supportsExclusive) {
					let result!: T
					await db.withExclusiveTransactionAsync(async (txn) => {
						// Exclusive connections do not inherit connection PRAGMAs.
						await txn.execAsync('PRAGMA foreign_keys = ON')
						const scoped = adaptNativeClient({
							execAsync: (source) => txn.execAsync(source),
							runAsync: (source, params) =>
								txn.runAsync(source, params),
							getFirstAsync: <TRow>(
								source: string,
								params: SqlParams,
							) => txn.getFirstAsync<TRow>(source, params),
							getAllAsync: <TRow>(
								source: string,
								params: SqlParams,
							) => txn.getAllAsync<TRow>(source, params),
						})
						result = await task(scoped)
					})
					return result
				}

				// Web / environments without exclusive transactions: still
				// serialized by the outer queue, and the task must use the
				// scoped (direct) executor so it cannot re-enter the queue.
				let result!: T
				await db.withTransactionAsync(async () => {
					const scoped = adaptNativeClient({
						execAsync: (source) => db.execAsync(source),
						runAsync: (source, params) =>
							db.runAsync(source, params),
						getFirstAsync: <TRow>(
							source: string,
							params: SqlParams,
						) => db.getFirstAsync<TRow>(source, params),
						getAllAsync: <TRow>(
							source: string,
							params: SqlParams,
						) => db.getAllAsync<TRow>(source, params),
					})
					result = await task(scoped)
				})
				return result
			}),
	}

	return executor
}

export { getSchemaVersion }
export type { SqlExecutor }
