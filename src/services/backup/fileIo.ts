/**
 * Native file helpers for backup ZIP / CSV share & restore pick flows.
 */

import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

import { createId } from '@/utils/id'
import { logger } from '@/services/logging'

function requireCacheDir (): string {
	const root = FileSystem.cacheDirectory
	if (!root) {
		throw new Error('Cache directory unavailable')
	}
	return root
}

function requireDocDir (): string {
	const root = FileSystem.documentDirectory
	if (!root) {
		throw new Error('Document directory unavailable')
	}
	return root
}

export async function readLocalFileBytes (
	uri: string,
): Promise<Uint8Array | null> {
	try {
		const info = await FileSystem.getInfoAsync(uri)
		if (!info.exists || info.isDirectory) {
			return null
		}
		const base64 = await FileSystem.readAsStringAsync(uri, {
			encoding: FileSystem.EncodingType.Base64,
		})
		return base64ToBytes(base64)
	} catch (error) {
		logger.warn('readLocalFileBytes failed', { error: String(error) })
		return null
	}
}

export async function writeMedicinePhotoFromBackup (
	fileName: string,
	bytes: Uint8Array,
): Promise<string> {
	const directory = `${requireDocDir()}medicine-photos/`
	const info = await FileSystem.getInfoAsync(directory)
	if (!info.exists) {
		await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
	}
	const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
	const target = `${directory}${createId('photo')}_${safeName}`
	await FileSystem.writeAsStringAsync(target, bytesToBase64(bytes), {
		encoding: FileSystem.EncodingType.Base64,
	})
	return target
}

export async function writeTempBackupZip (
	filename: string,
	bytes: Uint8Array,
): Promise<string> {
	const dir = `${requireCacheDir()}backups/`
	const info = await FileSystem.getInfoAsync(dir)
	if (!info.exists) {
		await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
	}
	const path = `${dir}${filename}`
	await FileSystem.writeAsStringAsync(path, bytesToBase64(bytes), {
		encoding: FileSystem.EncodingType.Base64,
	})
	return path
}

export async function writeTempCsv (
	filename: string,
	text: string,
): Promise<string> {
	const dir = `${requireCacheDir()}exports/`
	const info = await FileSystem.getInfoAsync(dir)
	if (!info.exists) {
		await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
	}
	const path = `${dir}${filename}`
	await FileSystem.writeAsStringAsync(path, text, {
		encoding: FileSystem.EncodingType.UTF8,
	})
	return path
}

export async function shareFileUri (uri: string): Promise<void> {
	const available = await Sharing.isAvailableAsync()
	if (!available) {
		throw new Error('SHARING_UNAVAILABLE')
	}
	await Sharing.shareAsync(uri, {
		mimeType: uri.endsWith('.csv') ? 'text/csv' : 'application/zip',
		dialogTitle: 'Моя аптечка',
	})
}

export async function pickBackupZipUri (): Promise<string | null> {
	const result = await DocumentPicker.getDocumentAsync({
		type: ['application/zip', 'application/x-zip-compressed', '*/*'],
		copyToCacheDirectory: true,
		multiple: false,
	})
	if (result.canceled || !result.assets?.[0]?.uri) {
		return null
	}
	return result.assets[0].uri
}

export async function readFileBytesFromUri (
	uri: string,
): Promise<Uint8Array> {
	const base64 = await FileSystem.readAsStringAsync(uri, {
		encoding: FileSystem.EncodingType.Base64,
	})
	return base64ToBytes(base64)
}

export async function bestEffortDelete (uri: string): Promise<void> {
	try {
		await FileSystem.deleteAsync(uri, { idempotent: true })
	} catch {
		// ignore cleanup failures
	}
}

function bytesToBase64 (bytes: Uint8Array): string {
	let binary = ''
	const chunk = 0x8000
	for (let i = 0; i < bytes.length; i += chunk) {
		const slice = bytes.subarray(i, i + chunk)
		binary += String.fromCharCode(...slice)
	}
	return btoa(binary)
}

function base64ToBytes (base64: string): Uint8Array {
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}
