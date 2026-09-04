import { useCallback, useState } from 'react'
import {
	Alert,
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import {
	AppHeader,
	Card,
	ChoiceChip,
	ChipGroup,
	EmptyState,
	IconButton,
	PrimaryButton,
	Screen,
	TextField,
} from '@/components/ui'
import { getMedicineFormLabel } from '@/constants/medicineForms'
import { getMedicineUnitShortLabel } from '@/constants/medicineUnits'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	listCabinetsByHousehold,
} from '@/db/repositories/medicineCabinets'
import {
	listMedicineSummaries,
	MedicineSort,
} from '@/db/repositories/medicines'
import { MedicineCabinet, MedicineSummary } from '@/db/types'
import { analytics } from '@/services/analytics'
import { formatNearestExpiryLabel } from '@/utils/expiry'
import { formatQuantityWithUnit } from '@/utils/quantity'

/**
 * Main inventory tab — searchable list of medicines with cabinet filter.
 */
export default function CabinetScreen () {
	const { executor, seed } = useDatabase()
	const [query, setQuery] = useState('')
	const [cabinetId, setCabinetId] = useState<string | null>(null)
	const [sort, setSort] = useState<MedicineSort>('name')
	const [cabinets, setCabinets] = useState<MedicineCabinet[]>([])
	const [items, setItems] = useState<MedicineSummary[]>([])
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const nextCabinets = await listCabinetsByHousehold(
				executor,
				seed.household.id,
			)
			const summaries = await listMedicineSummaries(executor, {
				householdId: seed.household.id,
				cabinetId,
				query,
				sort,
			})
			setCabinets(nextCabinets)
			setItems(summaries)
		} catch (error) {
			analytics.reportError(error, { source: 'CabinetScreen.load' })
			Alert.alert('Ошибка', 'Не удалось загрузить аптечку.')
		} finally {
			setLoading(false)
		}
	}, [cabinetId, executor, query, seed.household.id, sort])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('cabinet')
			void load()
		}, [load]),
	)

	const isEmptyInventory = !loading && items.length === 0 && !query && !cabinetId
	const isEmptySearch = !loading && items.length === 0 && Boolean(query)

	return (
		<Screen>
			<View style={styles.headerRow}>
				<View style={styles.headerText}>
					<AppHeader title="Моя аптечка" />
				</View>
				<IconButton
					accessibilityLabel="Управление аптечками"
					onPress={() => router.push('/cabinets')}
				>
					<Ionicons name="settings-outline" size={22} color={colors.text} />
				</IconButton>
			</View>

			<TextField
				label="Поиск"
				value={query}
				onChangeText={setQuery}
				placeholder="Название, дозировка или заметка"
				autoCorrect={false}
				returnKeyType="search"
			/>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.filterRow}
			>
				<ChoiceChip
					label="Все"
					selected={cabinetId === null}
					onPress={() => setCabinetId(null)}
				/>
				{cabinets.map((cabinet) => (
					<ChoiceChip
						key={cabinet.id}
						label={cabinet.name}
						selected={cabinetId === cabinet.id}
						onPress={() => setCabinetId(cabinet.id)}
					/>
				))}
			</ScrollView>

			<ChipGroup label="Сортировка">
				<ChoiceChip
					label="По названию"
					selected={sort === 'name'}
					onPress={() => setSort('name')}
				/>
				<ChoiceChip
					label="По сроку"
					selected={sort === 'nearestExpiry'}
					onPress={() => setSort('nearestExpiry')}
				/>
				<ChoiceChip
					label="По дате добавления"
					selected={sort === 'createdAt'}
					onPress={() => setSort('createdAt')}
				/>
			</ChipGroup>

			{isEmptyInventory ? (
				<EmptyState
					title="В аптечке пока ничего нет"
					description="Добавьте лекарства, чтобы видеть остатки и сроки годности."
					icon="medkit-outline"
				/>
			) : null}

			{isEmptySearch ? (
				<EmptyState title="Ничего не найдено" icon="search-outline" />
			) : null}

			{!isEmptyInventory && !isEmptySearch ? (
				<ScrollView
					style={styles.list}
					contentContainerStyle={styles.listContent}
					keyboardShouldPersistTaps="handled"
				>
					{items.map((item) => (
						<MedicineListCard key={item.medicine.id} item={item} />
					))}
				</ScrollView>
			) : null}

			<PrimaryButton
				label="+ Добавить лекарство"
				onPress={() => router.push('/medicines/add')}
				style={styles.fab}
			/>
		</Screen>
	)
}

function MedicineListCard ({ item }: { item: MedicineSummary }) {
	const unitLabel = item.unit ? getMedicineUnitShortLabel(item.unit) : ''
	const quantityLabel = formatQuantityWithUnit(item.totalQuantity, unitLabel)
	const expiryLabel = formatNearestExpiryLabel(item.nearestExpiry)
	const formLabel = getMedicineFormLabel(item.medicine.form)
	const meta = [item.medicine.strengthText, formLabel.toLowerCase()]
		.filter(Boolean)
		.join(' · ')

	return (
		<Pressable
			onPress={() => router.push(`/medicines/${item.medicine.id}`)}
			style={({ pressed }) => [styles.cardPress, pressed && styles.cardPressed]}
		>
			<Card style={styles.card}>
				<View style={styles.cardRow}>
					{item.medicine.photoUri ? (
						<Image
							source={{ uri: item.medicine.photoUri }}
							style={styles.photo}
						/>
					) : (
						<View style={styles.photoPlaceholder}>
							<Ionicons name="medkit-outline" size={22} color={colors.primary} />
						</View>
					)}
					<View style={styles.cardBody}>
						<Text style={styles.cardTitle}>{item.medicine.name}</Text>
						{meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
						<Text style={styles.cardQty}>{quantityLabel}</Text>
						{expiryLabel ? (
							<Text style={styles.cardExpiry}>{expiryLabel}</Text>
						) : null}
						{item.primaryCabinetName ? (
							<Text style={styles.cardCabinet}>{item.primaryCabinetName}</Text>
						) : null}
					</View>
					<Ionicons name="chevron-forward" size={18} color={colors.muted} />
				</View>
			</Card>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	headerRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: spacing.sm,
	},
	headerText: {
		flex: 1,
	},
	filterRow: {
		gap: spacing.xs,
		paddingBottom: spacing.sm,
	},
	list: {
		flex: 1,
	},
	listContent: {
		gap: spacing.sm,
		paddingBottom: spacing.xl,
	},
	fab: {
		marginTop: spacing.sm,
	},
	cardPress: {
		borderRadius: radii.lg,
	},
	cardPressed: {
		opacity: 0.92,
	},
	card: {
		padding: spacing.md,
	},
	cardRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	photo: {
		width: 56,
		height: 56,
		borderRadius: radii.md,
		backgroundColor: colors.surfaceMuted,
	},
	photoPlaceholder: {
		width: 56,
		height: 56,
		borderRadius: radii.md,
		backgroundColor: colors.primarySoft,
		alignItems: 'center',
		justifyContent: 'center',
	},
	cardBody: {
		flex: 1,
		gap: 2,
	},
	cardTitle: {
		...typography.section,
		fontSize: 17,
		color: colors.text,
	},
	cardMeta: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	cardQty: {
		...typography.body,
		fontWeight: '600',
		color: colors.text,
		marginTop: 4,
	},
	cardExpiry: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	cardCabinet: {
		...typography.caption,
		color: colors.muted,
		marginTop: 2,
	},
})
