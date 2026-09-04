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
	ChoiceChip,
	ChipGroup,
	EmptyState,
	PrimaryButton,
	Screen,
	SecondaryButton,
} from '@/components/ui'
import { tabs } from '@/constants/copy'
import { getMedicineUnitShortLabel } from '@/constants/medicineUnits'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { formatScheduleSummary } from '@/domain/scheduleEngine'
import {
	InventoryShortfallError,
	takePrnDose,
	undoIntake,
} from '@/domain/intakeService'
import {
	finishCourse,
	listActiveCourses,
} from '@/db/repositories/medicationCourses'
import { listSchedulesForCourse } from '@/db/repositories/medicationSchedules'
import { listHistoryIntakes } from '@/db/repositories/intakeRecords'
import { getMedicineById } from '@/db/repositories/medicines'
import { listPeopleByHousehold } from '@/db/repositories/people'
import {
	IntakeRecord,
	MedicationCourse,
} from '@/db/types'
import { analytics } from '@/services/analytics'
import { formatDateRu, formatInstantHm, historyDateLabel } from '@/utils/formatRu'
import { formatQuantityWithUnit } from '@/utils/quantity'
import { toDateOnlyLocal } from '@/utils/dates'
import { safeSyncMedicationReminders } from '@/services/notifications'

type Segment = 'courses' | 'history'

interface CourseListItem {
	course: MedicationCourse
	medicineName: string
	personName: string
	scheduleLabel: string
}

interface HistoryItem {
	intake: IntakeRecord
	medicineName: string
	personName: string
	groupDate: string
}

/**
 * «Приём» — active courses, PRN quick action, and intake history.
 */
export default function IntakeScreen () {
	const { executor, seed } = useDatabase()
	const [segment, setSegment] = useState<Segment>('courses')
	const [courses, setCourses] = useState<CourseListItem[]>([])
	const [history, setHistory] = useState<HistoryItem[]>([])
	const [statusFilter, setStatusFilter] = useState<'all' | 'taken' | 'skipped'>(
		'all',
	)
	const [prnCourses, setPrnCourses] = useState<CourseListItem[]>([])
	const [busyId, setBusyId] = useState<string | null>(null)
	const [historyBefore, setHistoryBefore] = useState<string | null>(null)
	const [hasMoreHistory, setHasMoreHistory] = useState(false)

	const loadCourses = useCallback(async () => {
		const active = await listActiveCourses(executor, seed.household.id)
		const people = await listPeopleByHousehold(executor, seed.household.id)
		const peopleMap = new Map(people.map((p) => [p.id, p.name]))
		const items: CourseListItem[] = []
		for (const course of active) {
			const medicine = await getMedicineById(executor, course.medicineId)
			const schedules = await listSchedulesForCourse(executor, course.id)
			items.push({
				course,
				medicineName: medicine?.name ?? 'Лекарство',
				personName: peopleMap.get(course.personId) ?? 'Я',
				scheduleLabel: formatScheduleSummary(schedules, course.isPrn),
			})
		}
		setCourses(items)
		setPrnCourses(items.filter((item) => item.course.isPrn))
	}, [executor, seed.household.id])

	const loadHistory = useCallback(
		async (
			append: boolean,
			beforeCreatedAt: string | null = null,
			filter: 'all' | 'taken' | 'skipped' = statusFilter,
		) => {
			const before = append ? beforeCreatedAt : null
			const rows = await listHistoryIntakes(executor, seed.household.id, {
				statusFilter: filter,
				beforeCreatedAt: before,
				limit: 40,
			})
			const people = await listPeopleByHousehold(executor, seed.household.id)
			const peopleMap = new Map(people.map((p) => [p.id, p.name]))
			const mapped: HistoryItem[] = []
			for (const intake of rows) {
				const medicine = await getMedicineById(executor, intake.medicineId)
				const eventIso =
					intake.actualTakenAt ?? intake.skippedAt ?? intake.createdAt
				const groupDate = toDateOnlyLocal(new Date(eventIso))
				mapped.push({
					intake,
					medicineName: medicine?.name ?? 'Лекарство',
					personName: peopleMap.get(intake.personId) ?? 'Я',
					groupDate,
				})
			}
			setHistory((prev) => (append ? [...prev, ...mapped] : mapped))
			if (rows.length > 0) {
				setHistoryBefore(rows[rows.length - 1]?.createdAt ?? null)
			} else if (!append) {
				setHistoryBefore(null)
			}
			setHasMoreHistory(rows.length >= 40)
		},
		[executor, seed.household.id, statusFilter],
	)

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('intake')
			void loadCourses()
			if (segment === 'history') {
				void loadHistory(false, null)
			}
		}, [loadCourses, loadHistory, segment]),
	)

	async function handleFinish (courseId: string) {
		Alert.alert(
			'Завершить курс?',
			'Будущие приёмы по расписанию исчезнут. История сохранится.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Завершить',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await finishCourse(
								executor,
								courseId,
								toDateOnlyLocal(new Date()),
							)
							await safeSyncMedicationReminders(
								executor,
								seed.household.id,
								{ defaultPersonName: seed.person.name },
							)
							await loadCourses()
						})()
					},
				},
			],
		)
	}

	async function confirmAndTakePrn (item: CourseListItem) {
		const unit = getMedicineUnitShortLabel(item.course.doseUnit)
		const doseLabel = formatQuantityWithUnit(item.course.doseQuantity, unit)

		const run = async (allowShortfall: boolean) => {
			setBusyId(item.course.id)
			try {
				const record = await takePrnDose(executor, item.course, {
					allowShortfall,
				})
				await safeSyncMedicationReminders(executor, seed.household.id, {
					defaultPersonName: seed.person.name,
				})
				Alert.alert(
					'Отмечено',
					`Принято в ${formatInstantHm(record.actualTakenAt ?? '')}`,
					[
						{ text: 'OK' },
						{
							text: 'Отменить',
							onPress: () => {
								void undoIntake(executor, record.id).then(() =>
									loadCourses(),
								)
							},
						},
					],
				)
			} catch (error) {
				if (error instanceof InventoryShortfallError) {
					Alert.alert(
						'Недостаточно в запасах',
						`В приложении отмечено, что осталось только ${formatQuantityWithUnit(error.available, unit)}, а доза — ${doseLabel}.`,
						[
							{ text: 'Отмена', style: 'cancel' },
							{
								text: 'Всё равно отметить приём',
								onPress: () => {
									void run(true)
								},
							},
						],
					)
				} else {
					analytics.reportError(error, { source: 'Intake.prn' })
					Alert.alert('Ошибка', 'Не удалось отметить приём.')
				}
			} finally {
				setBusyId(null)
			}
		}

		Alert.alert(
			'Принять по необходимости',
			`${item.medicineName}\n${doseLabel}\n${item.personName}`,
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Принять',
					onPress: () => {
						void run(false)
					},
				},
			],
		)
	}

	function openPrnPicker () {
		if (prnCourses.length === 0) {
			Alert.alert(
				'Нет курсов «по необходимости»',
				'Создайте курс с типом «По необходимости».',
			)
			return
		}
		if (prnCourses.length === 1 && prnCourses[0]) {
			void confirmAndTakePrn(prnCourses[0])
			return
		}
		Alert.alert(
			'Принять по необходимости',
			'Выберите курс',
			[
				...prnCourses.map((item) => ({
					text: item.medicineName,
					onPress: () => {
						void confirmAndTakePrn(item)
					},
				})),
				{ text: 'Отмена', style: 'cancel' as const },
			],
		)
	}

	function handleHistoryItemPress (item: HistoryItem) {
		const planned =
			item.intake.scheduledTime != null
				? `по плану ${item.intake.scheduledTime}`
				: 'по необходимости'
		const actual = item.intake.actualTakenAt
			? `принято в ${formatInstantHm(item.intake.actualTakenAt)}`
			: item.intake.skippedAt
				? `пропущено в ${formatInstantHm(item.intake.skippedAt)}`
				: ''
		Alert.alert(
			item.medicineName,
			[
				item.intake.status === 'taken' ? 'Принято' : 'Пропущено',
				planned,
				actual,
				item.intake.inventoryShortfall
					? 'Списание неполное (недостаток запасов)'
					: '',
			]
				.filter(Boolean)
				.join('\n'),
			[
				{ text: 'Закрыть', style: 'cancel' },
				{
					text: 'Отменить запись',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await undoIntake(executor, item.intake.id)
							await safeSyncMedicationReminders(
								executor,
								seed.household.id,
								{ defaultPersonName: seed.person.name },
							)
							await loadHistory(false, null)
						})()
					},
				},
			],
		)
	}

	const today = toDateOnlyLocal(new Date())

	const historyGroups = useMemo(() => {
		const map = new Map<string, HistoryItem[]>()
		for (const item of history) {
			const list = map.get(item.groupDate) ?? []
			list.push(item)
			map.set(item.groupDate, list)
		}
		return [...map.entries()]
	}, [history])

	return (
		<Screen scroll>
			<AppHeader title={tabs.intake.title} />

			<ChipGroup label="">
				<ChoiceChip
					label="Активные курсы"
					selected={segment === 'courses'}
					onPress={() => setSegment('courses')}
				/>
				<ChoiceChip
					label="История"
					selected={segment === 'history'}
					onPress={() => {
						setSegment('history')
						void loadHistory(false, null)
					}}
				/>
			</ChipGroup>

			{segment === 'courses' ? (
				<>
					{prnCourses.length > 0 ? (
						<PrimaryButton
							label="Принять по необходимости"
							onPress={openPrnPicker}
							disabled={busyId !== null}
							style={styles.prnBtn}
						/>
					) : null}

					<PrimaryButton
						label="Добавить курс"
						onPress={() => router.push('/courses/form')}
						style={styles.addBtn}
					/>

					{courses.length === 0 ? (
						<EmptyState
							title="Курсов приёма пока нет"
							description="Добавьте лекарство в расписание, чтобы видеть его на экране «Сегодня»."
							icon="checkbox-outline"
						/>
					) : (
						courses.map((item) => {
							const unit = getMedicineUnitShortLabel(item.course.doseUnit)
							const dose = formatQuantityWithUnit(
								item.course.doseQuantity,
								unit,
							)
							return (
								<Card key={item.course.id} style={styles.courseCard}>
									<Text style={styles.courseTitle}>{item.medicineName}</Text>
									<Text style={styles.courseMeta}>{item.personName}</Text>
									<Text style={styles.courseMeta}>{dose}</Text>
									<Text style={styles.courseMeta}>{item.scheduleLabel}</Text>
									<Text style={styles.courseMeta}>
										с {formatDateRu(item.course.startDate)}
									</Text>
									<View style={styles.row}>
										<SecondaryButton
											label="Изменить"
											onPress={() =>
												router.push({
													pathname: '/courses/form',
													params: { courseId: item.course.id },
												})
											}
											style={styles.flexBtn}
										/>
										<SecondaryButton
											label="Завершить"
											onPress={() => {
												void handleFinish(item.course.id)
											}}
											style={styles.flexBtn}
										/>
									</View>
								</Card>
							)
						})
					)}
				</>
			) : (
				<>
					<ChipGroup label="Фильтр">
						{(
							[
								['all', 'Все'],
								['taken', 'Принято'],
								['skipped', 'Пропущено'],
							] as const
						).map(([value, label]) => (
							<ChoiceChip
								key={value}
								label={label}
								selected={statusFilter === value}
								onPress={() => {
									setStatusFilter(value)
									void loadHistory(false, null, value)
								}}
							/>
						))}
					</ChipGroup>

					{history.length === 0 ? (
						<EmptyState
							title="История приёма пока пуста"
							icon="time-outline"
						/>
					) : (
						historyGroups.map(([date, items]) => (
							<View key={date} style={styles.historyGroup}>
								<Text style={styles.historyDay}>
									{historyDateLabel(date, today)}
								</Text>
								{items.map((item) => {
									const unit = getMedicineUnitShortLabel(
										item.intake.doseUnit,
									)
									const dose = formatQuantityWithUnit(
										item.intake.doseQuantity,
										unit,
									)
									const timeIso =
										item.intake.actualTakenAt ??
										item.intake.skippedAt ??
										item.intake.createdAt
									return (
										<Pressable
											key={item.intake.id}
											onPress={() => handleHistoryItemPress(item)}
										>
											<Card style={styles.historyCard}>
												<Text style={styles.historyTime}>
													{formatInstantHm(timeIso)}
												</Text>
												<Text style={styles.courseTitle}>
													{item.medicineName}
												</Text>
												<Text style={styles.courseMeta}>{dose}</Text>
												<Text style={styles.courseMeta}>
													{item.intake.status === 'taken'
														? 'Принято'
														: 'Пропущено'}
													{item.intake.scheduledTime
														? ` · по плану ${item.intake.scheduledTime}`
														: ' · по необходимости'}
												</Text>
												<Text style={styles.courseMeta}>
													{item.personName}
												</Text>
											</Card>
										</Pressable>
									)
								})}
							</View>
						))
					)}

					{hasMoreHistory ? (
						<SecondaryButton
							label="Загрузить ещё"
							onPress={() => {
								void loadHistory(true, historyBefore)
							}}
							style={styles.moreBtn}
						/>
					) : null}
				</>
			)}
		</Screen>
	)
}

const styles = StyleSheet.create({
	prnBtn: {
		marginBottom: spacing.sm,
	},
	addBtn: {
		marginBottom: spacing.md,
	},
	courseCard: {
		marginBottom: spacing.sm,
		gap: 4,
	},
	courseTitle: {
		...typography.section,
		color: colors.text,
	},
	courseMeta: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	row: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	flexBtn: {
		flex: 1,
	},
	historyGroup: {
		marginBottom: spacing.md,
	},
	historyDay: {
		...typography.section,
		marginBottom: spacing.sm,
	},
	historyCard: {
		marginBottom: spacing.sm,
		gap: 2,
	},
	historyTime: {
		...typography.caption,
		color: colors.muted,
	},
	moreBtn: {
		marginBottom: spacing.xl,
	},
})
