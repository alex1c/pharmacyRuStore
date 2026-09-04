import { useCallback, useMemo, useState } from 'react'
import {
	Alert,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'

import {
	ChoiceChip,
	ChipGroup,
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { getMedicineUnitShortLabel, MEDICINE_UNITS } from '@/constants/medicineUnits'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	createCourseWithSchedules,
	updateCourseWithSchedules,
} from '@/domain/courseService'
import { WEEKDAY_BITS, WEEKDAY_ORDER } from '@/domain/scheduleEngine'
import { getCourseById } from '@/db/repositories/medicationCourses'
import { listSchedulesForCourse } from '@/db/repositories/medicationSchedules'
import { getActiveUnitForMedicine } from '@/db/repositories/medicineBatches'
import { listMedicines } from '@/db/repositories/medicines'
import { listPeopleByHousehold } from '@/db/repositories/people'
import {
	Medicine,
	MedicineUnit,
	Person,
	ScheduleType,
} from '@/db/types'
import { analytics } from '@/services/analytics'
import { parseDoseInput } from '@/utils/dose'
import { isDateOnly, isLocalTimeHm, toDateOnlyLocal } from '@/utils/dates'
import { formatQuantity } from '@/utils/quantity'

type ScheduleMode = ScheduleType | 'prn'

/**
 * Create / edit medication course with schedule configuration.
 */
export default function CourseFormScreen () {
	const params = useLocalSearchParams<{
		courseId?: string
		medicineId?: string
	}>()
	const isEdit = Boolean(params.courseId)
	const { executor, seed } = useDatabase()

	const [people, setPeople] = useState<Person[]>([])
	const [medicines, setMedicines] = useState<Medicine[]>([])
	const [personId, setPersonId] = useState(seed.person.id)
	const [medicineId, setMedicineId] = useState(params.medicineId ?? '')
	const [doseText, setDoseText] = useState('1')
	const [doseUnit, setDoseUnit] = useState<MedicineUnit>('tablet')
	const [mode, setMode] = useState<ScheduleMode>('daily')
	const [times, setTimes] = useState<string[]>(['08:00'])
	const [weekdaysMask, setWeekdaysMask] = useState(
		WEEKDAY_BITS.mon |
			WEEKDAY_BITS.tue |
			WEEKDAY_BITS.wed |
			WEEKDAY_BITS.thu |
			WEEKDAY_BITS.fri,
	)
	const [intervalDays, setIntervalDays] = useState('2')
	const [oneTimeDate, setOneTimeDate] = useState(toDateOnlyLocal(new Date()))
	const [startDate, setStartDate] = useState(toDateOnlyLocal(new Date()))
	const [endDate, setEndDate] = useState('')
	const [noEndDate, setNoEndDate] = useState(true)
	const [instructions, setInstructions] = useState('')
	const [saving, setSaving] = useState(false)
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [loaded, setLoaded] = useState(!isEdit)

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen(isEdit ? 'course_edit' : 'course_add')
			void (async () => {
				const nextPeople = await listPeopleByHousehold(
					executor,
					seed.household.id,
				)
				const nextMedicines = await listMedicines(executor, {
					householdId: seed.household.id,
				})
				setPeople(nextPeople)
				setMedicines(nextMedicines)

				if (params.medicineId) {
					setMedicineId(params.medicineId)
					const unit = await getActiveUnitForMedicine(
						executor,
						params.medicineId,
					)
					if (unit) {
						setDoseUnit(unit)
					}
				}

				if (params.courseId) {
					const course = await getCourseById(executor, params.courseId)
					if (!course) {
						Alert.alert('Не найдено', 'Курс недоступен.', [
							{ text: 'OK', onPress: () => router.back() },
						])
						return
					}
					const schedules = await listSchedulesForCourse(
						executor,
						course.id,
					)
					setPersonId(course.personId)
					setMedicineId(course.medicineId)
					setDoseText(formatQuantity(course.doseQuantity))
					setDoseUnit(course.doseUnit)
					setStartDate(course.startDate)
					if (course.endDate) {
						setEndDate(course.endDate)
						setNoEndDate(false)
					} else {
						setNoEndDate(true)
						setEndDate('')
					}
					setInstructions(course.instructions ?? '')
					if (course.isPrn) {
						setMode('prn')
						setTimes([])
					} else if (schedules[0]) {
						const first = schedules[0]
						setMode(first.type)
						setTimes(
							schedules
								.map((item) => item.timeOfDay)
								.filter((value): value is string => Boolean(value)),
						)
						if (first.weekdaysMask) {
							setWeekdaysMask(first.weekdaysMask)
						}
						if (first.intervalDays) {
							setIntervalDays(String(first.intervalDays))
						}
						if (first.oneTimeDate) {
							setOneTimeDate(first.oneTimeDate)
						}
					}
					setLoaded(true)
				} else {
					setLoaded(true)
				}
			})()
		}, [
			executor,
			isEdit,
			params.courseId,
			params.medicineId,
			seed.household.id,
		]),
	)

	const showPersonPicker = people.length > 1

	const canSave = useMemo(
		() => medicineId.length > 0 && doseText.trim().length > 0,
		[doseText, medicineId],
	)

	function toggleWeekday (bit: number) {
		setWeekdaysMask((prev) =>
			(prev & bit) === bit ? prev & ~bit : prev | bit,
		)
	}

	function buildScheduleInputs () {
		if (mode === 'prn') {
			return []
		}
		const validTimes = times.filter((time) => isLocalTimeHm(time))
		if (validTimes.length === 0) {
			throw new Error('INVALID_TIMES')
		}

		if (mode === 'daily') {
			return validTimes.map((timeOfDay) => ({
				type: 'daily' as const,
				timeOfDay,
			}))
		}
		if (mode === 'weekdays') {
			if (weekdaysMask <= 0) {
				throw new Error('INVALID_WEEKDAYS')
			}
			return validTimes.map((timeOfDay) => ({
				type: 'weekdays' as const,
				timeOfDay,
				weekdaysMask,
			}))
		}
		if (mode === 'every_n_days') {
			const n = Number(intervalDays)
			if (!Number.isInteger(n) || n < 1) {
				throw new Error('INVALID_INTERVAL')
			}
			return validTimes.map((timeOfDay) => ({
				type: 'every_n_days' as const,
				timeOfDay,
				intervalDays: n,
			}))
		}
		if (mode === 'one_time') {
			if (!isDateOnly(oneTimeDate)) {
				throw new Error('INVALID_ONE_TIME_DATE')
			}
			return [
				{
					type: 'one_time' as const,
					timeOfDay: validTimes[0],
					oneTimeDate,
				},
			]
		}
		return []
	}

	async function handleSave () {
		const nextErrors: Record<string, string> = {}
		const dose = parseDoseInput(doseText)
		if (dose === null) {
			nextErrors.dose = 'Укажите дозу больше 0'
		}
		if (!medicineId) {
			nextErrors.medicine = 'Выберите лекарство'
		}
		if (!isDateOnly(startDate)) {
			nextErrors.startDate = 'Дата начала: ГГГГ-ММ-ДД'
		}
		if (!noEndDate) {
			if (!isDateOnly(endDate)) {
				nextErrors.endDate = 'Дата окончания: ГГГГ-ММ-ДД'
			} else if (isDateOnly(startDate) && endDate < startDate) {
				nextErrors.endDate = 'Окончание раньше начала'
			}
		}

		try {
			buildScheduleInputs()
		} catch {
			nextErrors.schedule = 'Проверьте расписание и времена (ЧЧ:ММ)'
		}

		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0 || dose === null) {
			return
		}

		setSaving(true)
		try {
			const schedules = buildScheduleInputs()
			const coursePayload = {
				personId,
				doseQuantity: dose,
				doseUnit,
				startDate,
				endDate: noEndDate ? null : endDate,
				instructions,
				isPrn: mode === 'prn',
			}

			if (isEdit && params.courseId) {
				await updateCourseWithSchedules(executor, params.courseId, {
					course: coursePayload,
					schedules,
				})
			} else {
				await createCourseWithSchedules(executor, {
					course: {
						householdId: seed.household.id,
						medicineId,
						...coursePayload,
					},
					schedules,
				})
			}
			router.back()
		} catch (error) {
			analytics.reportError(error, { source: 'CourseForm.save' })
			const message =
				error instanceof Error && error.name === 'INCOMPATIBLE_UNIT'
					? 'Единица дозы должна совпадать с единицей запасов.'
					: 'Не удалось сохранить курс.'
			Alert.alert('Ошибка', message)
		} finally {
			setSaving(false)
		}
	}

	if (!loaded) {
		return (
			<Screen>
				<ScreenTopBar title={isEdit ? 'Курс' : 'Новый курс'} />
			</Screen>
		)
	}

	return (
		<Screen scroll>
			<ScreenTopBar title={isEdit ? 'Изменить курс' : 'Новый курс'} />

			{showPersonPicker ? (
				<ChipGroup label="Кто принимает">
					{people.map((person) => (
						<ChoiceChip
							key={person.id}
							label={person.name}
							selected={personId === person.id}
							onPress={() => setPersonId(person.id)}
						/>
					))}
				</ChipGroup>
			) : null}

			{!isEdit ? (
				<ChipGroup label="Лекарство" error={errors.medicine}>
					{medicines.length === 0 ? (
						<Text style={styles.hint}>
							Сначала добавьте лекарство в аптечку.
						</Text>
					) : (
						medicines.map((medicine) => (
							<ChoiceChip
								key={medicine.id}
								label={medicine.name}
								selected={medicineId === medicine.id}
								onPress={() => {
									setMedicineId(medicine.id)
									void getActiveUnitForMedicine(executor, medicine.id).then(
										(unit) => {
											if (unit) {
												setDoseUnit(unit)
											}
										},
									)
								}}
							/>
						))
					)}
				</ChipGroup>
			) : (
				<Text style={styles.lockedMedicine}>
					{medicines.find((item) => item.id === medicineId)?.name ??
						'Лекарство'}
				</Text>
			)}

			<TextField
				label="Доза"
				value={doseText}
				onChangeText={setDoseText}
				keyboardType="decimal-pad"
				error={errors.dose}
				placeholder="1 или 0,5"
			/>

			<ChipGroup label="Единица дозы">
				{MEDICINE_UNITS.map((unit) => (
					<ChoiceChip
						key={unit.code}
						label={unit.shortLabel || unit.label}
						selected={doseUnit === unit.code}
						onPress={() => setDoseUnit(unit.code)}
					/>
				))}
			</ChipGroup>

			<ChipGroup label="Расписание" error={errors.schedule}>
				{(
					[
						['daily', 'Каждый день'],
						['weekdays', 'По дням недели'],
						['every_n_days', 'Каждые N дней'],
						['one_time', 'Один раз'],
						['prn', 'По необходимости'],
					] as const
				).map(([value, label]) => (
					<ChoiceChip
						key={value}
						label={label}
						selected={mode === value}
						onPress={() => {
							setMode(value)
							if (value === 'prn') {
								setTimes([])
							} else if (times.length === 0) {
								setTimes(['08:00'])
							}
						}}
					/>
				))}
			</ChipGroup>

			{mode === 'weekdays' ? (
				<View style={styles.weekdayRow}>
					{WEEKDAY_ORDER.map((day) => (
						<Pressable
							key={day.bit}
							onPress={() => toggleWeekday(day.bit)}
							style={[
								styles.weekdayChip,
								(weekdaysMask & day.bit) === day.bit &&
									styles.weekdayChipOn,
							]}
						>
							<Text
								style={[
									styles.weekdayText,
									(weekdaysMask & day.bit) === day.bit &&
										styles.weekdayTextOn,
								]}
							>
								{day.label}
							</Text>
						</Pressable>
					))}
				</View>
			) : null}

			{mode === 'every_n_days' ? (
				<TextField
					label="Каждые N дней"
					value={intervalDays}
					onChangeText={setIntervalDays}
					keyboardType="number-pad"
				/>
			) : null}

			{mode === 'one_time' ? (
				<TextField
					label="Дата (ГГГГ-ММ-ДД)"
					value={oneTimeDate}
					onChangeText={setOneTimeDate}
				/>
			) : null}

			{mode !== 'prn' ? (
				<View style={styles.timesBlock}>
					<Text style={styles.timesLabel}>Время</Text>
					{times.map((time, index) => (
						<TextField
							key={`time-${index}`}
							label={`Время ${index + 1}`}
							value={time}
							onChangeText={(value) => {
								setTimes((prev) =>
									prev.map((item, i) => (i === index ? value : item)),
								)
							}}
							placeholder="08:00"
						/>
					))}
					{mode !== 'one_time' ? (
						<SecondaryButton
							label="+ Добавить время"
							onPress={() => setTimes((prev) => [...prev, '20:00'])}
						/>
					) : null}
				</View>
			) : (
				<Text style={styles.hint}>
					Без фиксированного расписания. Приём отмечается вручную.
				</Text>
			)}

			<TextField
				label="Начало курса"
				value={startDate}
				onChangeText={setStartDate}
				error={errors.startDate}
				placeholder="ГГГГ-ММ-ДД"
			/>

			<ChipGroup label="Окончание">
				<ChoiceChip
					label="Без даты окончания"
					selected={noEndDate}
					onPress={() => setNoEndDate(true)}
				/>
				<ChoiceChip
					label="Указать дату"
					selected={!noEndDate}
					onPress={() => setNoEndDate(false)}
				/>
			</ChipGroup>

			{!noEndDate ? (
				<TextField
					label="Дата окончания"
					value={endDate}
					onChangeText={setEndDate}
					error={errors.endDate}
					placeholder="ГГГГ-ММ-ДД"
				/>
			) : null}

			<TextField
				label="Инструкция / заметка"
				value={instructions}
				onChangeText={setInstructions}
				multiline
			/>

			<PrimaryButton
				label={saving ? 'Сохранение…' : 'Сохранить'}
				onPress={() => {
					void handleSave()
				}}
				disabled={!canSave || saving}
				style={styles.save}
			/>
			<Text style={styles.unitHint}>
				Доза в {getMedicineUnitShortLabel(doseUnit) || 'единицах'} — без
				автоконвертации (табл. ≠ мл).
			</Text>
		</Screen>
	)
}

const styles = StyleSheet.create({
	hint: {
		...typography.bodySmall,
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	lockedMedicine: {
		...typography.section,
		marginBottom: spacing.md,
	},
	weekdayRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		marginBottom: spacing.md,
	},
	weekdayChip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: 8,
		backgroundColor: colors.surfaceMuted,
	},
	weekdayChipOn: {
		backgroundColor: colors.primary,
	},
	weekdayText: {
		...typography.bodySmall,
		color: colors.text,
	},
	weekdayTextOn: {
		color: colors.textInverse,
		fontWeight: '700',
	},
	timesBlock: {
		marginBottom: spacing.md,
		gap: spacing.xs,
	},
	timesLabel: {
		...typography.section,
		marginBottom: spacing.xs,
	},
	save: {
		marginTop: spacing.md,
		marginBottom: spacing.sm,
	},
	unitHint: {
		...typography.caption,
		color: colors.muted,
		marginBottom: spacing.xl,
	},
})
