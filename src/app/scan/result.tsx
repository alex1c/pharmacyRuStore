import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'

import {
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
} from '@/components/ui'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { findMedicineCodeByValue } from '@/db/repositories/medicineCodes'
import { getMedicineById } from '@/db/repositories/medicines'
import { Medicine } from '@/db/types'
import { attachScanCodesToMedicine } from '@/domain/scanService'
import { peekPendingScan, PendingScanSession } from '@/domain/scanSession'
import { analytics } from '@/services/analytics'
import { formatExpiryDisplay } from '@/utils/expiry'

type ResultStatus = 'found' | 'unknown' | 'archived' | 'invalid' | 'loading'

/**
 * Compact post-scan result — known medicine vs unknown code paths.
 */
export default function ScanResultScreen () {
	const { executor } = useDatabase()
	const initial = peekPendingScan()
	const [session] = useState<PendingScanSession | null>(initial)
	const [medicine, setMedicine] = useState<Medicine | null>(null)
	const [status, setStatus] = useState<ResultStatus>(
		initial ? 'loading' : 'invalid',
	)

	useEffect(() => {
		analytics.trackScreen('scan_result')
		if (!session) {
			return
		}

		let cancelled = false
		void (async () => {
			// Prefer target medicine from purchase/scan context.
			if (session.targetMedicineId) {
				const target = await getMedicineById(
					executor,
					session.targetMedicineId,
				)
				if (cancelled) {
					return
				}
				if (target && !target.archivedAt) {
					setMedicine(target)
					setStatus('found')
					return
				}
			}

			const candidates = [
				session.lookupCode,
				session.parsed.gtin,
			].filter(Boolean) as string[]

			for (const code of candidates) {
				const link = await findMedicineCodeByValue(executor, code)
				if (!link) {
					continue
				}
				const found = await getMedicineById(executor, link.medicineId)
				if (!found || cancelled) {
					continue
				}
				if (found.archivedAt) {
					setMedicine(found)
					setStatus('archived')
					return
				}
				setMedicine(found)
				setStatus('found')
				return
			}
			if (!cancelled) {
				setStatus('unknown')
			}
		})()

		return () => {
			cancelled = true
		}
	}, [executor, session])

	function openAddBatch (medicineId: string) {
		if (!session) {
			return
		}
		router.replace({
			pathname: '/medicines/[id]/batches/add',
			params: {
				id: medicineId,
				attachScan: '1',
				scannedCodeRaw: session.scanned.rawData,
				...(session.shoppingItemId
					? { shoppingItemId: session.shoppingItemId }
					: {}),
				...(session.parsed.expiryDate
					? { prefillExpiry: session.parsed.expiryDate }
					: {}),
				...(session.parsed.lot ? { prefillLot: session.parsed.lot } : {}),
				...(session.parsed.serial
					? { prefillSerial: session.parsed.serial }
					: {}),
			},
		})
	}

	async function handleAddPack () {
		if (!medicine || !session) {
			return
		}
		try {
			await attachScanCodesToMedicine(executor, session, medicine.id)
		} catch (error) {
			if (error instanceof Error && error.name === 'CODE_CONFLICT') {
				Alert.alert(
					'Код уже связан',
					'Этот код уже привязан к другому лекарству.',
				)
				return
			}
			analytics.reportError(error, { source: 'ScanResult.attach' })
		}
		openAddBatch(medicine.id)
	}

	function handleCreateNew () {
		if (!session) {
			return
		}
		router.replace({
			pathname: '/medicines/add',
			params: {
				attachScan: '1',
				prefillExpiry: session.parsed.expiryDate ?? '',
				prefillLot: session.parsed.lot ?? '',
				prefillSerial: session.parsed.serial ?? '',
				scannedCodeRaw: session.scanned.rawData,
				shoppingItemId: session.shoppingItemId ?? '',
			},
		})
	}

	function handleSelectExisting () {
		router.push('/scan/select-medicine')
	}

	if (status === 'invalid' || !session) {
		return (
			<Screen>
				<ScreenTopBar title="Результат сканирования" />
				<Text style={styles.body}>Код не найден в вашей аптечке</Text>
				<PrimaryButton
					label="Сканировать снова"
					onPress={() => router.replace('/scan/index')}
				/>
				<SecondaryButton
					label="Ввести данные вручную"
					onPress={() => router.replace('/medicines/add')}
					style={styles.gap}
				/>
			</Screen>
		)
	}

	if (status === 'loading') {
		return (
			<Screen>
				<ScreenTopBar title="Результат сканирования" />
				<Text style={styles.body}>Обработка кода…</Text>
			</Screen>
		)
	}

	const expiryLabel = session.parsed.expiryDate
		? formatExpiryDisplay(session.parsed.expiryDate)
		: null

	if (status === 'archived') {
		return (
			<Screen scroll>
				<ScreenTopBar title="Результат сканирования" />
				<Text style={styles.title}>Код связан с архивным лекарством</Text>
				<Text style={styles.body}>
					{medicine?.name ?? 'Лекарство в архиве'}
				</Text>
				<Text style={styles.meta}>
					Код не найден среди активных лекарств. Выберите другое или создайте новое.
				</Text>
				<PrimaryButton label="Выбрать из аптечки" onPress={handleSelectExisting} />
				<SecondaryButton
					label="Добавить новое"
					onPress={handleCreateNew}
					style={styles.gap}
				/>
				<SecondaryButton
					label="Сканировать снова"
					onPress={() => router.replace('/scan/index')}
					style={styles.gap}
				/>
			</Screen>
		)
	}

	if (status === 'found' && medicine) {
		return (
			<Screen scroll>
				<ScreenTopBar title="Результат сканирования" />
				<Text style={styles.kicker}>Найдено</Text>
				<Text style={styles.title}>{medicine.name}</Text>
				{medicine.strengthText ? (
					<Text style={styles.meta}>{medicine.strengthText}</Text>
				) : null}
				<Text style={styles.body}>Код распознан</Text>
				{session.parsed.gtin ? (
					<Text style={styles.meta}>GTIN: {session.parsed.gtin}</Text>
				) : null}
				{expiryLabel ? (
					<Text style={styles.meta}>Срок: {expiryLabel}</Text>
				) : null}
				<PrimaryButton
					label="Добавить упаковку"
					onPress={() => {
						void handleAddPack()
					}}
					style={styles.gap}
				/>
				<SecondaryButton
					label="Сканировать снова"
					onPress={() => router.replace('/scan/index')}
				/>
			</Screen>
		)
	}

	return (
		<Screen scroll>
			<ScreenTopBar title="Результат сканирования" />
			<Text style={styles.title}>Этот код ещё не связан с лекарством</Text>
			<Text style={styles.body}>Код распознан</Text>
			{session.parsed.gtin ? (
				<Text style={styles.meta}>GTIN: {session.parsed.gtin}</Text>
			) : null}
			{expiryLabel ? (
				<Text style={styles.meta}>Срок: {expiryLabel}</Text>
			) : null}
			<View style={styles.actions}>
				<PrimaryButton label="Добавить новое лекарство" onPress={handleCreateNew} />
				<SecondaryButton
					label="Выбрать из аптечки"
					onPress={handleSelectExisting}
					style={styles.gap}
				/>
				<SecondaryButton
					label="Сканировать снова"
					onPress={() => router.replace('/scan/index')}
					style={styles.gap}
				/>
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	kicker: {
		...typography.caption,
		color: colors.textSecondary,
		marginBottom: spacing.xs,
	},
	title: {
		...typography.title,
		color: colors.text,
		marginBottom: spacing.sm,
	},
	body: {
		...typography.body,
		color: colors.text,
		marginBottom: spacing.sm,
	},
	meta: {
		...typography.caption,
		color: colors.textSecondary,
		marginBottom: spacing.xs,
	},
	gap: {
		marginTop: spacing.sm,
	},
	actions: {
		marginTop: spacing.md,
	},
})
