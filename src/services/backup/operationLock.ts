/**
 * Global lock so backup/restore cannot interleave with each other.
 */

let locked = false

export function isBackupOperationBusy (): boolean {
	return locked
}

export async function withBackupOperationLock<T> (
	task: () => Promise<T>,
): Promise<T> {
	if (locked) {
		const error = new Error('BACKUP_BUSY')
		error.name = 'BACKUP_BUSY'
		throw error
	}
	locked = true
	try {
		return await task()
	} finally {
		locked = false
	}
}

/** Test helper — force-clear the lock between suites. */
export function resetBackupOperationLockForTests (): void {
	locked = false
}
