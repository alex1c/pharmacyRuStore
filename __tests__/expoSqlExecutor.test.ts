/**
 * Serial SQL executor + scoped transaction semantics (mirrors Expo queue).
 */

import { createTestSqlExecutor } from './helpers/testDatabase'

describe('expoSqlExecutor queue semantics', () => {
	it('runs transaction work on the scoped executor connection', async () => {
		const db = createTestSqlExecutor()
		await db.execAsync(`
			CREATE TABLE items (
				id INTEGER PRIMARY KEY NOT NULL,
				name TEXT NOT NULL
			);
		`)

		let scopedSawWrite = false
		await db.withTransactionAsync!(async (tx) => {
			await tx.runAsync(`INSERT INTO items (id, name) VALUES (1, 'inside')`)
			const row = await tx.getFirstAsync<{ name: string }>(
				`SELECT name FROM items WHERE id = 1`,
			)
			scopedSawWrite = row?.name === 'inside'
		})

		expect(scopedSawWrite).toBe(true)
		const committed = await db.getFirstAsync<{ name: string }>(
			`SELECT name FROM items WHERE id = 1`,
		)
		expect(committed?.name).toBe('inside')
	})

	it('waits for an open transaction before running an external query', async () => {
		const db = createTestSqlExecutor()
		await db.execAsync(`
			CREATE TABLE counter (
				id INTEGER PRIMARY KEY NOT NULL,
				value INTEGER NOT NULL
			);
		`)
		await db.runAsync(`INSERT INTO counter (id, value) VALUES (1, 0)`)

		const order: string[] = []
		let releaseTransaction!: () => void
		const gate = new Promise<void>((resolve) => {
			releaseTransaction = resolve
		})

		const transaction = db.withTransactionAsync!(async (tx) => {
			order.push('txn-start')
			await tx.runAsync(`UPDATE counter SET value = 10 WHERE id = 1`)
			await gate
			order.push('txn-end')
		})

		const external = db.getFirstAsync<{ value: number }>(
			`SELECT value FROM counter WHERE id = 1`,
		).then((row) => {
			order.push(`external-${row?.value}`)
			return row
		})

		// External must still be pending while the transaction holds the queue.
		await Promise.resolve()
		expect(order).toEqual(['txn-start'])

		releaseTransaction()
		const row = await external
		await transaction

		expect(row?.value).toBe(10)
		expect(order).toEqual(['txn-start', 'txn-end', 'external-10'])
	})

	it('keeps the queue alive after a rolled-back transaction', async () => {
		const db = createTestSqlExecutor()
		await db.execAsync(`
			CREATE TABLE notes (
				id INTEGER PRIMARY KEY NOT NULL,
				body TEXT NOT NULL
			);
		`)

		await expect(
			db.withTransactionAsync!(async (tx) => {
				await tx.runAsync(
					`INSERT INTO notes (id, body) VALUES (1, 'will-rollback')`,
				)
				throw new Error('forced_rollback')
			}),
		).rejects.toThrow('forced_rollback')

		const rolledBack = await db.getFirstAsync<{ body: string }>(
			`SELECT body FROM notes WHERE id = 1`,
		)
		expect(rolledBack).toBeNull()

		await db.runAsync(`INSERT INTO notes (id, body) VALUES (2, 'after')`)
		const after = await db.getFirstAsync<{ body: string }>(
			`SELECT body FROM notes WHERE id = 2`,
		)
		expect(after?.body).toBe('after')
	})
})
