import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'

import { createId } from '@/utils/id'
import { logger } from '@/services/logging'

/**
 * Persists medicine photos into app-controlled storage.
 * Temporary gallery URIs are copied so they survive restarts.
 */
export async function pickAndStoreMedicinePhoto (): Promise<string | null> {
	const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
	if (!permission.granted) {
		logger.warn('Medicine photo permission denied')
		return null
	}

	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ['images'],
		quality: 0.8,
		allowsEditing: true,
		aspect: [1, 1],
	})

	if (result.canceled || !result.assets?.[0]?.uri) {
		return null
	}

	return storeMedicinePhoto(result.assets[0].uri)
}

export async function storeMedicinePhoto (sourceUri: string): Promise<string> {
	const root = FileSystem.documentDirectory
	if (!root) {
		throw new Error('Document directory is unavailable')
	}

	const directory = `${root}medicine-photos/`
	const info = await FileSystem.getInfoAsync(directory)
	if (!info.exists) {
		await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
	}

	const extension = guessExtension(sourceUri)
	const target = `${directory}${createId('photo')}.${extension}`
	await FileSystem.copyAsync({ from: sourceUri, to: target })
	return target
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
