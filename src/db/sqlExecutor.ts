/**
 * Minimal SQL executor surface shared by Expo SQLite and Node test runner.
 *
 * Transaction callbacks receive a scoped executor so all reads/writes inside
 * the transaction use the exclusive connection (native) and never re-enter
 * the outer serial queue (which would deadlock).
 */
export interface SqlExecutor {
	execAsync (source: string): Promise<void>
	runAsync (source: string, params?: SqlParams): Promise<RunResult>
	getFirstAsync<T> (source: string, params?: SqlParams): Promise<T | null>
	getAllAsync<T> (source: string, params?: SqlParams): Promise<T[]>
	/**
	 * Runs `task` inside a transaction. Prefer exclusive transactions on
	 * native. The scoped `tx` must be used for every query inside `task`.
	 */
	withTransactionAsync?<T> (task: (tx: SqlExecutor) => Promise<T>): Promise<T>
}

export type SqlParams = (string | number | null)[]

export interface RunResult {
	changes: number
	lastInsertRowId: number
}
