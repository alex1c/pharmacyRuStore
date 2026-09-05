/**
 * ZIP encode/decode for pharmacy backup packages (JSZip — pure JS).
 */

import JSZip from 'jszip'

import { assertSafeMediaZipPath } from './media'
import { BackupPackage } from './types'
import {
	BackupValidationError,
	migrateBackupFormat,
	validateBackupPackage,
	validateManifest,
} from './validator'

export async function encodeBackupZip (pack: BackupPackage): Promise<Uint8Array> {
	validateBackupPackage(pack)
	const zip = new JSZip()
	zip.file('manifest.json', JSON.stringify(pack.manifest, null, 2))
	zip.file('data.json', JSON.stringify(pack.data, null, 2))
	for (const file of pack.media) {
		assertSafeMediaZipPath(file.zipPath)
		zip.file(file.zipPath, file.bytes)
	}
	const output = await zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
	})
	return output
}

export async function decodeBackupZip (bytes: Uint8Array): Promise<BackupPackage> {
	let zip: JSZip
	try {
		zip = await JSZip.loadAsync(bytes)
	} catch {
		throw new BackupValidationError('Unreadable ZIP', 'INVALID_MANIFEST')
	}

	const manifestFile = zip.file('manifest.json')
	const dataFile = zip.file('data.json')
	if (!manifestFile || !dataFile) {
		throw new BackupValidationError(
			'Это не резервная копия «Моей аптечки».',
			'UNSUPPORTED_FORMAT',
		)
	}

	let manifestRaw: unknown
	let dataRaw: unknown
	try {
		manifestRaw = JSON.parse(await manifestFile.async('string'))
		dataRaw = JSON.parse(await dataFile.async('string'))
	} catch {
		throw new BackupValidationError('Invalid JSON in backup', 'INVALID_DATA')
	}

	validateManifest(manifestRaw)

	const media: BackupPackage['media'] = []
	const mediaFolder = zip.folder('media')
	if (mediaFolder) {
		const files = Object.keys(zip.files).filter(
			(path) => path.startsWith('media/medicine/') && !path.endsWith('/'),
		)
		for (const path of files) {
			assertSafeMediaZipPath(path)
			const entry = zip.file(path)
			if (!entry) {
				continue
			}
			const bytes = await entry.async('uint8array')
			const name = path.slice('media/medicine/'.length)
			media.push({
				zipPath: path,
				logicalRef: `media://medicine/${name}`,
				bytes,
			})
		}
	}

	const pack: BackupPackage = migrateBackupFormat({
		manifest: manifestRaw,
		data: dataRaw as BackupPackage['data'],
		media,
	})
	validateBackupPackage(pack)
	return pack
}
