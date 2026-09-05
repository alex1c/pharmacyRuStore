import { useCallback, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text } from 'react-native'
import { router, useFocusEffect } from 'expo-router'

import {
	Card,
	EmptyState,
	Screen,
	ScreenTopBar,
	TextField,
} from '@/components/ui'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { listMedicines } from '@/db/repositories/medicines'
import { Medicine } from '@/db/types'
import { attachScanCodesToMedicine } from '@/domain/scanService'
import { peekPendingScan } from '@/domain/scanSession'
import { analytics } from '@/services/analytics'

/**
 * Pick an existing medicine to attach the pending scanned code.
 */
export default function SelectMedicineForScanScreen () {
	const { executor, seed } = useDatabase()
	const [query, setQuery] = useState('')
	const [items, setItems] = useState<Medicine[]>([])

	const load = useCallback(async () => {
		const list = await listMedicines(executor, {
			householdId: seed.household.id,
		})
		setItems(list.filter((item) => !item.archivedAt))
	}, [executor, seed.household.id])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('scan_select_medicine')
			void load()
		}, [load]),
	)

	const filtered = items.filter((item) => {
		if (!query.trim()) {
			return true
		}
		const q = query.trim().toLowerCase()
		return (
			item.name.toLowerCase().includes(q) ||
			(item.strengthText ?? '').toLowerCase().includes(q)
		)
	})

	async function handleSelect (medicine: Medicine) {
		const session = peekPendingScan()
		if (!session) {
			Alert.alert('Сессия истекла', 'Отсканируйте код снова.')
			router.replace('/scan/index')
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
			analytics.reportError(error, { source: 'ScanSelect.attach' })
			Alert.alert('Ошибка', 'Не удалось сохранить код.')
			return
		}

		router.replace({
			pathname: '/medicines/[id]/batches/add',
			params: {
				id: medicine.id,
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

	return (
		<Screen scroll>
			<ScreenTopBar title="Выбрать из аптечки" />
			<TextField
				label="Поиск"
				value={query}
				onChangeText={setQuery}
				placeholder="Название"
				autoCorrect={false}
			/>
			{filtered.length === 0 ? (
				<EmptyState title="Нет лекарств" icon="medkit-outline" />
			) : (
				filtered.map((item) => (
					<Pressable
						key={item.id}
						onPress={() => {
							void handleSelect(item)
						}}
						style={styles.row}
					>
						<Card>
							<Text style={styles.title}>{item.name}</Text>
							{item.strengthText ? (
								<Text style={styles.meta}>{item.strengthText}</Text>
							) : null}
						</Card>
					</Pressable>
				))
			)}
		</Screen>
	)
}

const styles = StyleSheet.create({
	row: {
		marginBottom: spacing.sm,
	},
	title: {
		...typography.body,
		color: colors.text,
		fontWeight: '600',
	},
	meta: {
		...typography.caption,
		color: colors.textSecondary,
		marginTop: 2,
	},
})
