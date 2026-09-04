/**
 * Minimal SQL executor surface shared by Expo SQLite and Node test runner.
 */
export interface SqlExecutor {
	execAsync (source: string): Promise<void>
	runAsync (source: string, params?: SqlParams): Promise<RunResult>
	getFirstAsync<T> (source: string, params?: SqlParams): Promise<T | null>
	getAllAsync<T> (source: string, params?: SqlParams): Promise<T[]>
	withTransactionAsync?<T> (task: () => Promise<T>): Promise<T>
}

export type SqlParams = (string | number | null)[]

export interface RunResult {
	changes: number
	lastInsertRowId: number
}
