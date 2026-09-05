/**
 * Duplicate scan callback guard for CameraView.onBarcodeScanned.
 * Domain-level — no React Native dependency.
 */

export function createScanLock (cooldownMs = 1800) {
	let locked = false
	let lastRaw: string | null = null
	let lastAt = 0

	return {
		/** Returns true when this detection should start a flow. */
		tryAcquire (rawData: string): boolean {
			const now = Date.now()
			if (locked) {
				return false
			}
			if (
				lastRaw === rawData &&
				now - lastAt < cooldownMs
			) {
				return false
			}
			locked = true
			lastRaw = rawData
			lastAt = now
			return true
		},
		release (): void {
			locked = false
		},
		reset (): void {
			locked = false
			lastRaw = null
			lastAt = 0
		},
		isLocked (): boolean {
			return locked
		},
	}
}

export type ScanLock = ReturnType<typeof createScanLock>
