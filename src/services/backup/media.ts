/**
 * Medicine photo packaging for backups — logical refs, never absolute device paths.
 */

import { createId } from '@/utils/id'
import { MEDIA_PREFIX } from './constants'
import { BackupMediaFile } from './types'

/**
 * Rewrites medicine photo_uri to media:// refs and collects file bytes.
 * Missing files become warnings + null photo_uri (backup still succeeds).
 */
export async function collectMedicineMedia (
	medicines: Record<string, unknown>[],
	readMediaBytes?: (uri: string) => Promise<Uint8Array | null>,
): Promise<{
	medicines: Record<string, unknown>[]
	media: BackupMediaFile[]
	warnings: string[]
}> {
	const media: BackupMediaFile[] = []
	const warnings: string[] = []
	const nextMedicines: Record<string, unknown>[] = []

	for (const medicine of medicines) {
		const photoUri =
			typeof medicine.photo_uri === 'string' ? medicine.photo_uri : null
		if (!photoUri) {
			nextMedicines.push({ ...medicine, photo_uri: null })
			continue
		}

		if (!readMediaBytes) {
			warnings.push(`media_unavailable:${String(medicine.id)}`)
			nextMedicines.push({ ...medicine, photo_uri: null })
			continue
		}

		const bytes = await readMediaBytes(photoUri)
		if (!bytes || bytes.length === 0) {
			warnings.push(`missing_media:${String(medicine.id)}`)
			nextMedicines.push({ ...medicine, photo_uri: null })
			continue
		}

		const ext = guessExtension(photoUri)
		const fileId = createId('media')
		const fileName = `${fileId}.${ext}`
		const logicalRef = `${MEDIA_PREFIX}${fileName}`
		media.push({
			zipPath: `media/medicine/${fileName}`,
			logicalRef,
			bytes,
		})
		nextMedicines.push({ ...medicine, photo_uri: logicalRef })
	}

	return { medicines: nextMedicines, media, warnings }
}

/**
 * Reject path traversal / absolute paths in ZIP media entries.
 */
export function assertSafeMediaZipPath (zipPath: string): void {
	const normalized = zipPath.replace(/\\/g, '/')
	if (
		!normalized.startsWith('media/medicine/') ||
		normalized.includes('..') ||
		normalized.startsWith('/') ||
		normalized.includes(':') ||
		normalized.split('/').some((part) => part === '' || part === '.' || part === '..')
	) {
		const error = new Error('UNSAFE_MEDIA_PATH')
		error.name = 'UNSAFE_MEDIA_PATH'
		throw error
	}
}

export function logicalRefToZipPath (logicalRef: string): string | null {
	if (!logicalRef.startsWith(MEDIA_PREFIX)) {
		return null
	}
	const name = logicalRef.slice(MEDIA_PREFIX.length)
	if (!name || name.includes('/') || name.includes('..')) {
		return null
	}
	return `media/medicine/${name}`
}

function guessExtension (uri: string): string {
	const cleaned = uri.split('?')[0] ?? uri
	const match = cleaned.match(/\.([a-zA-Z0-9]+)$/)
	const ext = match?.[1]?.toLowerCase()
	if (ext && ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
		return ext === 'jpeg' ? 'jpg' : ext
	}
	return 'jpg'
}
