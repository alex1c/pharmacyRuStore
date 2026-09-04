import { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'

import {
	AppHeader,
	Card,
	EmptyState,
	PrimaryButton,
	Screen,
	SecondaryButton,
} from '@/components/ui'
import { tabs } from '@/constants/copy'
import { getMedicineUnitShortLabel } from '@/constants/medicineUnits'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { buildMedicineAttentionState } from '@/domain/medicineSummary'
import {
	InventoryShortfallError,
	loadTodayOccurrences,
	markOccurrenceSkipped,
	markOccurrenceTaken,
	snoozeOccurrence,
	takeAllOccurrences,
	TodayOccurrenceView,
	undoIntake,
} from '@/domain/intakeService'
import {
	countActiveBatches,
	countActiveMedicines,
	listMedicineSummaries,
} from '@/db/repositories/medicines'
import { MedicineSummary, ScheduledOccurrence } from '@/db/types'
import { analytics } from '@/services/analytics'
import { formatInstantHm } from '@/utils/formatRu'
import { formatQuantityWithUnit } from '@/utils/quantity'
import { toDateOnlyLocal } from '@/utils/dates'
import { safeSyncMedicationReminders } from '@/services/notifications'

/**
 * «Сегодня» — scheduled intake for today + inventory attention.
 */
export default function TodayScreen () {
	const { executor, seed } = useDatabase()
	const [medicineCount, setMedicineCount] = useState(0)
	const [batchCount, setBatchCount] = useState(0)
	const [attentionItems, setAttentionItems] = useState<MedicineSummary[]>([])
	const [occurrences, setOccurrences] = useState<TodayOccurrenceView[]>([])
	const [busyKey, setBusyKey] = useState<string | null>(null)
	const actionLock = useRef(false)

	const reload = useCallback(async () => {
		const today = toDateOnlyLocal(new Date())
		const medicines = await countActiveMedicines(executor, seed.household.id)
		const batches = await countActiveBatches(executor, seed.household.id)
		const summaries = await listMedicineSummaries(executor, {
			householdId: seed.household.id,
			sort: 'attention',
			attentionFilter: 'attention',
		})
		const todayViews = await loadTodayOccurrences(
			executor,
			seed.household.id,
			today,
		)
		setMedicineCount(medicines)
		setBatchCount(batches)
		setAttentionItems(summaries)
		setOccurrences(todayViews)
		void safeSyncMedicationReminders(executor, seed.household.id, {
			defaultPersonName: seed.person.name,
		})
	}, [executor, seed.household.id, seed.person.name])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('today')
			void reload()
		}, [reload]),
	)

	const progress = useMemo(() => {
		const total = occurrences.length
		const done = occurrences.filter(
			(item) => item.status === 'taken' || item.status === 'skipped',
		).length
		return { total, done }
	}, [occurrences])

	const grouped = useMemo(() => {
		const map = new Map<string, TodayOccurrenceView[]>()
		for (const item of occurrences) {
			const key =
				item.status === 'snoozed' ? item.sortTime : item.occurrence.scheduledTime
			const list = map.get(key) ?? []
			list.push(item)
			map.set(key, list)
		}
		return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
	}, [occurrences])

	function occurrenceKey (occurrence: ScheduledOccurrence): string {
		return `${occurrence.scheduleId}:${occurrence.scheduledDate}:${occurrence.scheduledTime}`
	}

	async function withGuard (
		key: string,
		task: () => Promise<void>,
	): Promise<void> {
		if (actionLock.current) {
			return
		}
		actionLock.current = true
		setBusyKey(key)
		try {
			await task()
		} finally {
			actionLock.current = false
			setBusyKey(null)
		}
	}

	function showShortfallAlert (
		error: InventoryShortfallError,
		occurrence: ScheduledOccurrence,
		onAllow: () => void,
	) {
		const unit = getMedicineUnitShortLabel(occurrence.doseUnit)
		Alert.alert(
			'Недостаточно в запасах',
			`В приложении отмечено, что осталось только ${formatQuantityWithUnit(error.available, unit)}, а доза — ${formatQuantityWithUnit(error.requested, unit)}.`,
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Всё равно отметить приём',
					onPress: onAllow,
				},
			],
		)
	}

	function handleTaken (view: TodayOccurrenceView) {
		const key = occurrenceKey(view.occurrence)
		void withGuard(key, async () => {
			const run = async (allowShortfall: boolean) => {
				try {
					const record = await markOccurrenceTaken(
						executor,
						view.occurrence,
						{ allowShortfall },
					)
					await reload()
					Alert.alert(
						'Отмечено',
						`План: ${view.occurrence.scheduledTime} · принято в ${formatInstantHm(record.actualTakenAt ?? '')}`,
						[
							{ text: 'OK' },
							{
								text: 'Отменить',
								onPress: () => {
									void undoIntake(executor, record.id).then(() => reload())
								},
							},
						],
					)
				} catch (error) {
					if (error instanceof InventoryShortfallError) {
						showShortfallAlert(error, view.occurrence, () => {
							void withGuard(key, async () => {
								await run(true)
							})
						})
					} else {
						analytics.reportError(error, { source: 'Today.taken' })
						Alert.alert('Ошибка', 'Не удалось отметить приём.')
					}
				}
			}
			await run(false)
		})
	}

	function handleSkip (view: TodayOccurrenceView) {
		const key = occurrenceKey(view.occurrence)
		void withGuard(key, async () => {
			const record = await markOccurrenceSkipped(executor, view.occurrence)
			await reload()
			Alert.alert('Пропущено', 'Отметку можно отменить.', [
				{ text: 'OK' },
				{
					text: 'Отменить',
					onPress: () => {
						void undoIntake(executor, record.id).then(() => reload())
					},
				},
			])
		})
	}

	function handleSnooze (view: TodayOccurrenceView) {
		Alert.alert('Отложить', 'На сколько отложить по расписанию?', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: '+10 мин',
				onPress: () => {
					void withGuard(occurrenceKey(view.occurrence), async () => {
						await snoozeOccurrence(executor, view.occurrence, 10)
						await reload()
					})
				},
			},
			{
				text: '+30 мин',
				onPress: () => {
					void withGuard(occurrenceKey(view.occurrence), async () => {
						await snoozeOccurrence(executor, view.occurrence, 30)
						await reload()
					})
				},
			},
			{
				text: '+1 час',
				onPress: () => {
					void withGuard(occurrenceKey(view.occurrence), async () => {
						await snoozeOccurrence(executor, view.occurrence, 60)
						await reload()
					})
				},
			},
		])
	}

	function handleTakeAll (time: string, views: TodayOccurrenceView[]) {
		const pending = views.filter(
			(item) => item.status === 'pending' || item.status === 'snoozed',
		)
		if (pending.length < 2) {
			return
		}
		void withGuard(`all:${time}`, async () => {
			const result = await takeAllOccurrences(
				executor,
				pending.map((item) => item.occurrence),
			)
			await reload()

			if (result.shortfalls.length > 0) {
				const first = result.shortfalls[0]
				if (!first) {
					return
				}
				showShortfallAlert(first.error, first.occurrence, () => {
					void withGuard(`all:${time}:sf`, async () => {
						await takeAllOccurrences(
							executor,
							result.shortfalls.map((item) => item.occurrence),
							{ allowShortfall: true },
						)
						await reload()
					})
				})
			} else if (result.errors.length > 0) {
				Alert.alert('Частично', 'Не все приёмы удалось отметить.')
			}
		})
	}

	return (
		<Screen scroll>
			<AppHeader title={tabs.today.title} />

			<Card style={styles.stats}>
				<Text style={styles.statsLine}>Лекарств: {medicineCount}</Text>
				<Text style={styles.statsLine}>Упаковок: {batchCount}</Text>
				<Text style={styles.statsLine}>
					Требуют внимания: {attentionItems.length}
				</Text>
			</Card>

			<Text style={styles.sectionTitle}>Приём сегодня</Text>
			{progress.total > 0 ? (
				<Text style={styles.progress}>
					Принято сегодня: {progress.done} из {progress.total}
				</Text>
			) : null}

			{occurrences.length === 0 ? (
				<EmptyState
					title="На сегодня приёмов по расписанию нет"
					description={tabs.today.empty}
					icon="sunny-outline"
				/>
			) : (
				grouped.map(([time, views]) => {
					const pendingCount = views.filter(
						(item) =>
							item.status === 'pending' || item.status === 'snoozed',
					).length
					return (
						<View key={time} style={styles.timeGroup}>
							<View style={styles.timeHeader}>
								<Text style={styles.timeLabel}>{time}</Text>
								{pendingCount > 1 ? (
									<SecondaryButton
										label="Принять всё"
										onPress={() => handleTakeAll(time, views)}
										disabled={busyKey !== null}
									/>
								) : null}
							</View>
							{views.map((view) => {
								const unit = getMedicineUnitShortLabel(
									view.occurrence.doseUnit,
								)
								const dose = formatQuantityWithUnit(
									view.occurrence.doseQuantity,
									unit,
								)
								const key = occurrenceKey(view.occurrence)
								const done =
									view.status === 'taken' || view.status === 'skipped'
								return (
									<Card
										key={key}
										style={[
											styles.occurrenceCard,
											done ? styles.occurrenceDone : null,
										]}
									>
										<Text style={styles.occurrenceTitle}>
											{view.medicineName}
										</Text>
										<Text style={styles.occurrenceMeta}>{dose}</Text>
										<Text style={styles.occurrenceMeta}>
											{view.personName}
										</Text>
										{view.status === 'taken' ? (
											<Text style={styles.statusOk}>
												Принято
												{view.intake?.actualTakenAt
													? ` в ${formatInstantHm(view.intake.actualTakenAt)}`
													: ''}
											</Text>
										) : null}
										{view.status === 'skipped' ? (
											<Text style={styles.statusMuted}>Пропущено</Text>
										) : null}
										{view.status === 'snoozed' ? (
											<Text style={styles.statusWarn}>
												Отложено до {view.sortTime}
											</Text>
										) : null}
										{view.status === 'pending' ||
										view.status === 'snoozed' ? (
											<View style={styles.actions}>
												<PrimaryButton
													label="Принял"
													onPress={() => handleTaken(view)}
													disabled={busyKey !== null}
													style={styles.actionBtn}
												/>
												<SecondaryButton
													label="Отложить"
													onPress={() => handleSnooze(view)}
													disabled={busyKey !== null}
													style={styles.actionBtn}
												/>
												<SecondaryButton
													label="Пропустить"
													onPress={() => handleSkip(view)}
													disabled={busyKey !== null}
													style={styles.actionBtn}
												/>
											</View>
										) : view.intake ? (
											<SecondaryButton
												label="Отменить отметку"
												onPress={() => {
													void undoIntake(executor, view.intake!.id).then(
														() => reload(),
													)
												}}
												style={styles.undoBtn}
											/>
										) : null}
									</Card>
								)
							})}
						</View>
					)
				})
			)}

			<Text style={[styles.sectionTitle, styles.attentionSection]}>
				Требует внимания
			</Text>

			{attentionItems.length === 0 ? (
				<Card style={styles.okCard}>
					<Text style={styles.okTitle}>С аптечкой всё в порядке</Text>
					<Text style={styles.okText}>
						Нет просроченных или заканчивающихся лекарств.
					</Text>
				</Card>
			) : (
				attentionItems.map((summary) => {
					const attention = buildMedicineAttentionState(summary)
					if (!attention) {
						return null
					}
					const unit = summary.unit
						? getMedicineUnitShortLabel(summary.unit)
						: ''
					const qty = formatQuantityWithUnit(summary.totalQuantity, unit)
					return (
						<Pressable
							key={summary.medicine.id}
							onPress={() =>
								router.push(`/medicines/${summary.medicine.id}`)
							}
							style={({ pressed }) => [
								styles.attentionPress,
								pressed && styles.pressed,
							]}
						>
							<Card
								style={[
									styles.attentionCard,
									attention.kind === 'expired' || attention.kind === 'empty'
										? styles.attentionDanger
										: styles.attentionWarn,
								]}
							>
								<Text style={styles.attentionTitle}>{attention.title}</Text>
								<Text style={styles.attentionDetail}>{attention.detail}</Text>
								<Text style={styles.attentionQty}>{qty}</Text>
								<Text style={styles.attentionAction}>
									{attention.actionLabel}
								</Text>
							</Card>
						</Pressable>
					)
				})
			)}
		</Screen>
	)
}

const styles = StyleSheet.create({
	stats: {
		marginBottom: spacing.md,
		gap: spacing.xs,
	},
	statsLine: {
		...typography.body,
		color: colors.textSecondary,
	},
	sectionTitle: {
		...typography.section,
		marginBottom: spacing.sm,
		color: colors.text,
	},
	attentionSection: {
		marginTop: spacing.lg,
	},
	progress: {
		...typography.bodySmall,
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	timeGroup: {
		marginBottom: spacing.md,
	},
	timeHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: spacing.sm,
		gap: spacing.sm,
	},
	timeLabel: {
		...typography.section,
		color: colors.primaryDark,
	},
	occurrenceCard: {
		marginBottom: spacing.sm,
		gap: 4,
	},
	occurrenceDone: {
		opacity: 0.72,
	},
	occurrenceTitle: {
		...typography.section,
	},
	occurrenceMeta: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	statusOk: {
		...typography.bodySmall,
		color: colors.success,
		fontWeight: '700',
	},
	statusMuted: {
		...typography.bodySmall,
		color: colors.muted,
		fontWeight: '700',
	},
	statusWarn: {
		...typography.bodySmall,
		color: '#8A6A0A',
		fontWeight: '700',
	},
	actions: {
		marginTop: spacing.sm,
		gap: spacing.xs,
	},
	actionBtn: {
		marginTop: 0,
	},
	undoBtn: {
		marginTop: spacing.sm,
	},
	okCard: {
		marginBottom: spacing.lg,
		gap: spacing.xs,
	},
	okTitle: {
		...typography.section,
		color: colors.success,
	},
	okText: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	attentionPress: {
		marginBottom: spacing.sm,
		borderRadius: radii.lg,
	},
	pressed: {
		opacity: 0.92,
	},
	attentionCard: {
		gap: 4,
	},
	attentionDanger: {
		borderColor: '#E8C4C4',
		backgroundColor: '#FFF8F8',
	},
	attentionWarn: {
		borderColor: '#E8D9A8',
		backgroundColor: '#FFFCF3',
	},
	attentionTitle: {
		...typography.section,
		color: colors.text,
	},
	attentionDetail: {
		...typography.body,
		color: colors.textSecondary,
	},
	attentionQty: {
		...typography.bodySmall,
		color: colors.muted,
	},
	attentionAction: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.primaryDark,
		marginTop: spacing.xs,
	},
})
