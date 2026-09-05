import { useCallback, useMemo, useState } from 'react'
import {
	Alert,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'

import {
	AppHeader,
	Card,
	EmptyState,
	PrimaryButton,
	Screen,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { tabs } from '@/constants/copy'
import { getMedicineUnitShortLabel } from '@/constants/medicineUnits'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	getMedicineById,
	getMedicineSummary,
	listMedicines,
} from '@/db/repositories/medicines'
import {
	listActiveShoppingItems,
	listCompletedShoppingItems,
} from '@/db/repositories/shoppingItems'
import {
	addCustomShoppingItem,
	addMedicineToShopping,
	markPurchasedSimple,
	restoreManualShoppingItem,
} from '@/domain/purchaseService'
import { safeSyncAutomaticShoppingItems } from '@/domain/shoppingService'
import { Medicine, ShoppingItem } from '@/db/types'
import { analytics } from '@/services/analytics'
import { formatQuantityWithUnit } from '@/utils/quantity'
import { AppBannerAd } from '@/components/ads/AppBannerAd'
import { adsService } from '@/services/ads'

interface ShoppingView {
	item: ShoppingItem
	title: string
	subtitle: string
	reasonLabel: string
	sortRank: number
}

function reasonLabel (reason: ShoppingItem['reason']): string {
	if (reason === 'empty') {
		return 'Закончился'
	}
	if (reason === 'low_stock') {
		return 'Мало осталось'
	}
	return 'Добавлено вручную'
}

function sortRank (reason: ShoppingItem['reason']): number {
	if (reason === 'empty') {
		return 0
	}
	if (reason === 'low_stock') {
		return 1
	}
	return 2
}

/**
 * «Покупки» — automatic low/empty stock + manual list and purchase flows.
 */
export default function ShoppingScreen () {
	const { executor, seed } = useDatabase()
	const [active, setActive] = useState<ShoppingView[]>([])
	const [completed, setCompleted] = useState<ShoppingView[]>([])
	const [showCompleted, setShowCompleted] = useState(false)
	const [adding, setAdding] = useState(false)
	const [medicines, setMedicines] = useState<Medicine[]>([])
	const [customName, setCustomName] = useState('')
	const [busyId, setBusyId] = useState<string | null>(null)

	const load = useCallback(async () => {
		await safeSyncAutomaticShoppingItems(executor, seed.household.id)
		const activeRows = await listActiveShoppingItems(
			executor,
			seed.household.id,
		)
		const completedRows = await listCompletedShoppingItems(
			executor,
			seed.household.id,
			30,
		)

		async function enrich (items: ShoppingItem[]): Promise<ShoppingView[]> {
			const views: ShoppingView[] = []
			for (const item of items) {
				if (item.medicineId) {
					const medicine = await getMedicineById(executor, item.medicineId)
					const summary = await getMedicineSummary(executor, item.medicineId)
					const unit = summary?.unit
						? getMedicineUnitShortLabel(summary.unit)
						: ''
					const qty = summary
						? formatQuantityWithUnit(summary.totalQuantity, unit)
						: ''
					views.push({
						item,
						title: medicine?.name ?? 'Лекарство',
						subtitle:
							item.status === 'active' && qty
								? `Осталось ${qty}`
								: item.source === 'manual'
									? 'Вручную'
									: '',
						reasonLabel: reasonLabel(item.reason),
						sortRank: sortRank(item.reason),
					})
				} else {
					views.push({
						item,
						title: item.customName ?? 'Покупка',
						subtitle: 'Добавлено вручную',
						reasonLabel: reasonLabel(item.reason),
						sortRank: sortRank(item.reason),
					})
				}
			}
			return views.sort((a, b) => {
				if (a.sortRank !== b.sortRank) {
					return a.sortRank - b.sortRank
				}
				return a.title.localeCompare(b.title, 'ru')
			})
		}

		setActive(await enrich(activeRows))
		setCompleted(await enrich(completedRows))
	}, [executor, seed.household.id])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('shopping')
			adsService.recordMeaningfulAction('screen_browse')
			void load()
		}, [load]),
	)

	async function openAdd () {
		const list = await listMedicines(executor, {
			householdId: seed.household.id,
		})
		setMedicines(list)
		setAdding(true)
	}

	async function handleAddMedicine (medicine: Medicine) {
		setBusyId(medicine.id)
		try {
			const result = await addMedicineToShopping(executor, {
				householdId: seed.household.id,
				medicineId: medicine.id,
			})
			if (!result.created) {
				Alert.alert('Уже в покупках', 'Это лекарство уже есть в списке.')
			}
			setAdding(false)
			await load()
		} finally {
			setBusyId(null)
		}
	}

	async function handleAddCustom () {
		if (!customName.trim()) {
			Alert.alert('Имя', 'Укажите название.')
			return
		}
		await addCustomShoppingItem(executor, {
			householdId: seed.household.id,
			customName,
		})
		setCustomName('')
		setAdding(false)
		await load()
	}

	function handleBought (view: ShoppingView) {
		if (view.item.medicineId) {
			Alert.alert('Куплено', view.title, [
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Сканировать упаковку',
					onPress: () => {
						router.push({
							pathname: '/scan/index',
							params: {
								medicineId: view.item.medicineId!,
								shoppingItemId: view.item.id,
							},
						})
					},
				},
				{
					text: 'Ввести данные',
					onPress: () => {
						router.push({
							pathname: '/medicines/[id]/batches/add',
							params: {
								id: view.item.medicineId!,
								shoppingItemId: view.item.id,
							},
						})
					},
				},
			])
			return
		}
		Alert.alert('Куплено', view.title, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Просто отметить купленным',
				onPress: () => {
					void markPurchasedSimple(executor, view.item.id).then(() => {
						void load()
						adsService.maybeShowInterstitial('shopping_completed')
					})
				},
			},
			{
				text: 'Добавить в аптечку',
				onPress: () => {
					router.push({
						pathname: '/medicines/add',
						params: {
							prefillName: view.title,
							shoppingItemId: view.item.id,
						},
					})
				},
			},
		])
	}

	const activeCount = useMemo(() => active.length, [active])

	return (
		<Screen scroll>
			<AppHeader title={tabs.shopping.title} />

			{activeCount > 0 ? (
				<Text style={styles.count}>Нужно купить: {activeCount}</Text>
			) : null}

			<PrimaryButton
				label="+ Добавить"
				onPress={() => {
					void openAdd()
				}}
				style={styles.addBtn}
			/>

			{adding ? (
				<Card style={styles.addCard}>
					<Text style={styles.section}>Выберите лекарство</Text>
					{medicines.map((medicine) => (
						<SecondaryButton
							key={medicine.id}
							label={medicine.name}
							onPress={() => {
								void handleAddMedicine(medicine)
							}}
							disabled={busyId !== null}
							style={styles.medBtn}
						/>
					))}
					<TextField
						label="Или свой текст"
						value={customName}
						onChangeText={setCustomName}
						placeholder="Бинт стерильный"
					/>
					<PrimaryButton
						label="Добавить текст"
						onPress={() => {
							void handleAddCustom()
						}}
					/>
					<SecondaryButton
						label="Отмена"
						onPress={() => setAdding(false)}
						style={styles.cancel}
					/>
				</Card>
			) : null}

			<Text style={styles.section}>Нужно купить</Text>
			{active.length === 0 ? (
				<EmptyState
					title={tabs.shopping.empty}
					description="Когда остаток станет низким, лекарство появится здесь автоматически."
					icon="cart-outline"
				/>
			) : (
				active.map((view) => (
					<Card key={view.item.id} style={styles.row}>
						<Text style={styles.title}>{view.title}</Text>
						{view.subtitle ? (
							<Text style={styles.meta}>{view.subtitle}</Text>
						) : null}
						<Text
							style={
								view.item.reason === 'empty'
									? styles.reasonDanger
									: styles.reasonWarn
							}
						>
							{view.reasonLabel}
						</Text>
						<View style={styles.actions}>
							<PrimaryButton
								label="Куплено"
								onPress={() => handleBought(view)}
								style={styles.flex}
							/>
							{view.item.medicineId ? (
								<SecondaryButton
									label="Открыть"
									onPress={() =>
										router.push(`/medicines/${view.item.medicineId}`)
									}
									style={styles.flex}
								/>
							) : null}
						</View>
					</Card>
				))
			)}

			<Pressable onPress={() => setShowCompleted((value) => !value)}>
				<Text style={styles.completedToggle}>
					{showCompleted ? 'Скрыть купленное' : 'Куплено недавно'}
				</Text>
			</Pressable>

			{showCompleted
				? completed.map((view) => (
					<Card key={view.item.id} style={styles.rowDone}>
						<Text style={styles.title}>{view.title}</Text>
						<Text style={styles.meta}>{view.reasonLabel}</Text>
						{view.item.source === 'manual' ? (
							<SecondaryButton
								label="Вернуть в список"
								onPress={() => {
									void restoreManualShoppingItem(
										executor,
										view.item.id,
									).then(() => load())
								}}
							/>
						) : null}
					</Card>
				))
				: null}
			<AppBannerAd placement="shopping" />
		</Screen>
	)
}

const styles = StyleSheet.create({
	count: {
		...typography.bodySmall,
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	addBtn: {
		marginBottom: spacing.md,
	},
	addCard: {
		marginBottom: spacing.md,
		gap: spacing.sm,
	},
	section: {
		...typography.section,
		marginBottom: spacing.sm,
	},
	medBtn: {
		marginBottom: spacing.xs,
	},
	cancel: {
		marginTop: spacing.xs,
	},
	row: {
		marginBottom: spacing.sm,
		gap: 4,
	},
	rowDone: {
		marginBottom: spacing.sm,
		opacity: 0.75,
		gap: 4,
	},
	title: {
		...typography.section,
	},
	meta: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	reasonWarn: {
		...typography.bodySmall,
		fontWeight: '700',
		color: '#8A6A0A',
	},
	reasonDanger: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.danger,
	},
	actions: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	flex: {
		flex: 1,
	},
	completedToggle: {
		...typography.section,
		color: colors.primaryDark,
		marginTop: spacing.lg,
		marginBottom: spacing.sm,
	},
})
