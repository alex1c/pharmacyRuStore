import Database from 'better-sqlite3'

import { SqlExecutor, SqlParams } from '../../src/db/sqlExecutor'

/**
 * Node/Jest SQLite adapter mirroring the Expo SQL executor surface.
 *
 * Matches production semantics:
 * - serial operation queue for all public methods
 * - scoped transaction executor (no queue re-entry)
 * - queue continues after rejected / rolled-back operations
 */
export function createTestSqlExecutor (filename = ':memory:'): SqlExecutor {
	const db = new Database(filename)
	db.pragma('foreign_keys = ON')

	let operationTail: Promise<void> = Promise.resolve()

	function enqueue<T> (operation: () => Promise<T>): Promise<T> {
		const run = operationTail.then(operation)
		operationTail = run.then(
			() => undefined,
			() => undefined,
		)
		return run
	}

	function createDirectExecutor (): SqlExecutor {
		return {
			async execAsync (source: string) {
				db.exec(source)
			},
			async runAsync (source: string, params: SqlParams = []) {
				const result = db.prepare(source).run(...params)
				return {
					changes: result.changes,
					lastInsertRowId: Number(result.lastInsertRowid),
				}
			},
			async getFirstAsync<T> (source: string, params: SqlParams = []) {
				const row = db.prepare(source).get(...params)
				return (row as T) ?? null
			},
			async getAllAsync<T> (source: string, params: SqlParams = []) {
				return db.prepare(source).all(...params) as T[]
			},
		}
	}

	const direct = createDirectExecutor()

	return {
		execAsync: (source) => enqueue(() => direct.execAsync(source)),
		runAsync: (source, params = []) =>
			enqueue(() => direct.runAsync(source, params)),
		getFirstAsync: <T>(source: string, params: SqlParams = []) =>
			enqueue(() => direct.getFirstAsync<T>(source, params)),
		getAllAsync: <T>(source: string, params: SqlParams = []) =>
			enqueue(() => direct.getAllAsync<T>(source, params)),
		withTransactionAsync: <T>(task: (tx: SqlExecutor) => Promise<T>) =>
			enqueue(async () => {
				db.exec('BEGIN')
				try {
					const value = await task(direct)
					db.exec('COMMIT')
					return value
				} catch (error) {
					db.exec('ROLLBACK')
					throw error
				}
			}),
	}
}
