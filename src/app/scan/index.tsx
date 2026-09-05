import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	Alert,
	Linking,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import {
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { createScanLock } from '@/domain/scanLock'
import {
	buildScanSession,
	mapBarcodeTypeToCodeType,
	resolveScannedCode,
} from '@/domain/scanService'
import { AnalyticsEvents, analytics } from '@/services/analytics'
import type { ScanCodeTypeParam } from '@/services/analytics'

const BARCODE_TYPES = [
	'ean13',
	'ean8',
	'upc_a',
	'upc_e',
	'code128',
	'qr',
	'datamatrix',
] as const

/**
 * Camera barcode scanner — optional accelerator, always offers manual entry.
 */
export default function ScanScreen () {
	const params = useLocalSearchParams<{
		medicineId?: string
		shoppingItemId?: string
	}>()
	const { executor } = useDatabase()
	const [permission, requestPermission] = useCameraPermissions()
	const [torch, setTorch] = useState(false)
	const [manualOpen, setManualOpen] = useState(false)
	const [manualCode, setManualCode] = useState('')
	const [cameraReady, setCameraReady] = useState(true)
	const [screenFocused, setScreenFocused] = useState(true)
	const [flashFeedback, setFlashFeedback] = useState(false)
	const [busy, setBusy] = useState(false)
	const lockRef = useRef(createScanLock())

	useEffect(() => {
		analytics.trackScreen('scan')
		analytics.trackEvent(AnalyticsEvents.SCAN_STARTED)
	}, [])

	useFocusEffect(
		useCallback(() => {
			setScreenFocused(true)
			lockRef.current.reset()
			setBusy(false)
			setFlashFeedback(false)
			return () => {
				setScreenFocused(false)
				setTorch(false)
			}
		}, []),
	)

	const cameraActive = useMemo(
		() =>
			Boolean(permission?.granted) &&
			screenFocused &&
			!manualOpen &&
			cameraReady,
		[cameraReady, manualOpen, permission?.granted, screenFocused],
	)

	async function ensurePermission (): Promise<boolean> {
		if (permission?.granted) {
			return true
		}
		const next = await requestPermission()
		return Boolean(next.granted)
	}

	function promptForPermission () {
		Alert.alert(
			'Доступ к камере',
			'Камера нужна только для сканирования кода на упаковке.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Продолжить',
					onPress: () => {
						void ensurePermission()
					},
				},
			],
		)
	}

	async function handleDetected (rawData: string, barcodeType: string) {
		if (!lockRef.current.tryAcquire(rawData) || busy) {
			return
		}
		setBusy(true)
		setFlashFeedback(true)
		try {
			const session = buildScanSession({
				rawData,
				barcodeType,
				targetMedicineId: params.medicineId,
				shoppingItemId: params.shoppingItemId,
			})
			if (!session) {
				analytics.trackEvent(AnalyticsEvents.SCAN_FAILED)
				Alert.alert(
					'Не удалось распознать код',
					'Попробуйте поднести упаковку ближе или введите код вручную.',
				)
				lockRef.current.release()
				setBusy(false)
				setFlashFeedback(false)
				return
			}

			await resolveScannedCode(executor, session)
			// Generic success only — never include raw code / GTIN / serial.
			const mapped = mapBarcodeTypeToCodeType(session.scanned.barcodeType)
			const codeType: ScanCodeTypeParam =
				mapped === 'gtin' || mapped === 'unknown' ? 'other' : mapped
			analytics.trackEvent(AnalyticsEvents.SCAN_SUCCESS, {
				code_type: codeType,
			})
			router.replace('/scan/result')
		} catch (error) {
			analytics.reportError(error, { source: 'ScanScreen.detect' })
			analytics.trackEvent(AnalyticsEvents.SCAN_FAILED)
			Alert.alert('Ошибка', 'Не удалось обработать код. Введите данные вручную.')
			lockRef.current.release()
			setBusy(false)
			setFlashFeedback(false)
		}
	}

	async function handleManualSubmit () {
		await handleDetected(manualCode, 'unknown')
	}

	if (!permission) {
		return (
			<Screen>
				<ScreenTopBar title="Сканировать упаковку" />
			</Screen>
		)
	}

	if (!permission.granted) {
		return (
			<Screen scroll>
				<ScreenTopBar title="Сканировать упаковку" />
				<Text style={styles.hint}>
					Доступ к камере не разрешён
				</Text>
				<Text style={styles.subHint}>
					Камера нужна только для сканирования кода на упаковке.
				</Text>
				<PrimaryButton
					label="Разрешить камеру"
					onPress={promptForPermission}
					style={styles.action}
				/>
				<SecondaryButton
					label="Открыть настройки"
					onPress={() => {
						void Linking.openSettings()
					}}
					style={styles.action}
				/>
				<SecondaryButton
					label="Ввести код вручную"
					onPress={() => setManualOpen(true)}
					style={styles.action}
				/>
				<SecondaryButton
					label="Ввести вручную без кода"
					onPress={() => router.replace('/medicines/add')}
					style={styles.action}
				/>
				{manualOpen ? (
					<View style={styles.manualBox}>
						<TextField
							label="Код (EAN / GTIN)"
							value={manualCode}
							onChangeText={setManualCode}
							autoCapitalize="none"
							autoCorrect={false}
						/>
						<PrimaryButton
							label="Продолжить"
							onPress={() => {
								void handleManualSubmit()
							}}
							disabled={!manualCode.trim() || busy}
						/>
					</View>
				) : null}
			</Screen>
		)
	}

	return (
		<View style={styles.fill}>
			<View style={styles.topBar}>
				<ScreenTopBar title="Сканировать упаковку" />
				<Text style={styles.hintLight}>
					Наведите камеру на код на упаковке лекарства.
				</Text>
			</View>

			{cameraActive ? (
				<CameraView
					style={styles.camera}
					facing="back"
					enableTorch={torch}
					barcodeScannerSettings={{
						barcodeTypes: [...BARCODE_TYPES],
					}}
					onBarcodeScanned={(event) => {
						void handleDetected(event.data, event.type)
					}}
					onMountError={() => {
						setCameraReady(false)
						analytics.trackEvent(AnalyticsEvents.SCAN_FAILED)
					}}
				/>
			) : (
				<View style={styles.fallback}>
					<Text style={styles.hint}>Камера недоступна</Text>
					<Text style={styles.subHint}>
						Введите код вручную или добавьте лекарство без сканера.
					</Text>
				</View>
			)}

			<View style={[styles.overlay, StyleSheet.absoluteFill]} pointerEvents="none">
				<View style={[styles.frame, flashFeedback && styles.frameFlash]} />
			</View>

			<View style={styles.controls}>
				<Pressable
					accessibilityLabel={
						torch ? 'Выключить фонарик' : 'Включить фонарик'
					}
					onPress={() => setTorch((value) => !value)}
					style={styles.iconBtn}
				>
					<Ionicons
						name={torch ? 'flash' : 'flash-outline'}
						size={24}
						color={colors.text}
					/>
				</Pressable>
				<SecondaryButton
					label="Ввести код вручную"
					onPress={() => setManualOpen((value) => !value)}
					style={styles.controlBtn}
				/>
				<SecondaryButton
					label="Ввести вручную"
					onPress={() => router.replace('/medicines/add')}
					style={styles.controlBtn}
				/>
			</View>

			{manualOpen ? (
				<View style={styles.manualOverlay}>
					<TextField
						label="Код (EAN / GTIN)"
						value={manualCode}
						onChangeText={setManualCode}
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<PrimaryButton
						label="Продолжить"
						onPress={() => {
							void handleManualSubmit()
						}}
						disabled={!manualCode.trim() || busy}
					/>
				</View>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	fill: {
		flex: 1,
		backgroundColor: colors.background,
	},
	topBar: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
		zIndex: 2,
		backgroundColor: colors.background,
	},
	camera: {
		flex: 1,
	},
	fallback: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	overlay: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	frame: {
		width: 240,
		height: 240,
		borderRadius: radii.lg,
		borderWidth: 2,
		borderColor: colors.primary,
		backgroundColor: 'transparent',
	},
	frameFlash: {
		borderColor: colors.success ?? colors.primary,
		borderWidth: 3,
	},
	controls: {
		padding: spacing.md,
		gap: spacing.sm,
		backgroundColor: colors.background,
	},
	controlBtn: {
		alignSelf: 'stretch',
	},
	iconBtn: {
		alignSelf: 'flex-start',
		padding: spacing.sm,
		borderRadius: radii.md,
		backgroundColor: colors.surface,
	},
	hint: {
		...typography.body,
		color: colors.text,
		marginBottom: spacing.sm,
	},
	hintLight: {
		...typography.caption,
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	subHint: {
		...typography.caption,
		color: colors.textSecondary,
		marginBottom: spacing.md,
	},
	action: {
		marginBottom: spacing.sm,
	},
	manualBox: {
		marginTop: spacing.md,
		gap: spacing.sm,
	},
	manualOverlay: {
		position: 'absolute',
		left: spacing.md,
		right: spacing.md,
		bottom: 120,
		padding: spacing.md,
		borderRadius: radii.lg,
		backgroundColor: colors.surface,
		gap: spacing.sm,
	},
})
