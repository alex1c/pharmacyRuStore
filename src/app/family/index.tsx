import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'

import {
	Card,
	PrimaryButton,
	Screen,
	ScreenTopBar,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	archivePerson,
	countActiveCoursesForPeople,
	createPerson,
	listPeopleByHousehold,
	updatePerson,
} from '@/db/repositories/people'
import { Person } from '@/db/types'
import { analytics } from '@/services/analytics'
import { safeSyncMedicationReminders } from '@/services/notifications'

interface PersonRow {
	person: Person
	courseCount: number
}

/**
 * Family members management — simple CRUD without medical PII.
 */
export default function FamilyScreen () {
	const { executor, seed } = useDatabase()
	const [rows, setRows] = useState<PersonRow[]>([])
	const [adding, setAdding] = useState(false)
	const [editId, setEditId] = useState<string | null>(null)
	const [name, setName] = useState('')
	const [note, setNote] = useState('')
	const [saving, setSaving] = useState(false)

	const load = useCallback(async () => {
		const people = await listPeopleByHousehold(executor, seed.household.id)
		const counts = await countActiveCoursesForPeople(
			executor,
			seed.household.id,
		)
		setRows(
			people.map((person) => ({
				person,
				courseCount: counts.get(person.id) ?? 0,
			})),
		)
	}, [executor, seed.household.id])

	useFocusEffect(
		useCallback(() => {
			analytics.trackScreen('family')
			void load()
		}, [load]),
	)

	function startAdd () {
		setEditId(null)
		setName('')
		setNote('')
		setAdding(true)
	}

	function startEdit (person: Person) {
		setEditId(person.id)
		setName(person.name)
		setNote(person.note ?? '')
		setAdding(true)
	}

	async function handleSave () {
		if (!name.trim()) {
			Alert.alert('Имя', 'Укажите имя.')
			return
		}
		setSaving(true)
		try {
			if (editId) {
				await updatePerson(executor, editId, { name, note })
			} else {
				await createPerson(executor, {
					householdId: seed.household.id,
					name,
					note,
				})
			}
			setAdding(false)
			await load()
		} catch (error) {
			analytics.reportError(error, { source: 'Family.save' })
			Alert.alert('Ошибка', 'Не удалось сохранить.')
		} finally {
			setSaving(false)
		}
	}

	function handleArchive (row: PersonRow) {
		if (row.person.id === seed.person.id) {
			Alert.alert(
				'Нельзя скрыть',
				'Профиль «Я» — основной. Его нельзя архивировать.',
			)
			return
		}

		const message =
			row.courseCount > 0
				? `У этого человека есть активные курсы (${row.courseCount}). Завершить их и скрыть профиль? История приёма сохранится.`
				: 'Скрыть профиль? История приёма сохранится.'

		Alert.alert('Скрыть профиль?', message, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Скрыть',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						try {
							await archivePerson(executor, row.person.id, {
								defaultPersonId: seed.person.id,
								finishActiveCourses: row.courseCount > 0,
							})
							await safeSyncMedicationReminders(
								executor,
								seed.household.id,
								{ defaultPersonName: seed.person.name },
							)
							await load()
						} catch (error) {
							analytics.reportError(error, { source: 'Family.archive' })
							Alert.alert('Ошибка', 'Не удалось скрыть профиль.')
						}
					})()
				},
			},
		])
	}

	return (
		<Screen scroll>
			<ScreenTopBar title="Члены семьи" />

			{!adding ? (
				<PrimaryButton
					label="Добавить человека"
					onPress={startAdd}
					style={styles.add}
				/>
			) : (
				<Card style={styles.form}>
					<TextField
						label="Имя"
						value={name}
						onChangeText={setName}
						placeholder="Анна"
					/>
					<TextField
						label="Заметка"
						value={note}
						onChangeText={setNote}
						placeholder="Необязательно"
					/>
					<PrimaryButton
						label={saving ? 'Сохранение…' : 'Сохранить'}
						onPress={() => {
							void handleSave()
						}}
						disabled={saving}
					/>
					<SecondaryButton
						label="Отмена"
						onPress={() => setAdding(false)}
						style={styles.cancel}
					/>
				</Card>
			)}

			{rows.map((row) => (
				<Card key={row.person.id} style={styles.card}>
					<Text style={styles.name}>{row.person.name}</Text>
					{row.person.note ? (
						<Text style={styles.note}>{row.person.note}</Text>
					) : null}
					<Text style={styles.meta}>
						{row.courseCount} акт. курс
						{row.courseCount === 1 ? '' : row.courseCount >= 2 && row.courseCount <= 4 ? 'а' : 'ов'}
					</Text>
					<View style={styles.actions}>
						<SecondaryButton
							label="Изменить"
							onPress={() => startEdit(row.person)}
							style={styles.flex}
						/>
						<SecondaryButton
							label="Курс"
							onPress={() =>
								router.push({
									pathname: '/courses/form',
									params: { personId: row.person.id },
								})
							}
							style={styles.flex}
						/>
						{row.person.id !== seed.person.id ? (
							<SecondaryButton
								label="Скрыть"
								onPress={() => handleArchive(row)}
								style={styles.flex}
							/>
						) : null}
					</View>
				</Card>
			))}
		</Screen>
	)
}

const styles = StyleSheet.create({
	add: {
		marginBottom: spacing.md,
	},
	form: {
		marginBottom: spacing.md,
		gap: spacing.sm,
	},
	cancel: {
		marginTop: spacing.xs,
	},
	card: {
		marginBottom: spacing.sm,
		gap: 4,
	},
	name: {
		...typography.section,
		color: colors.text,
	},
	note: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	meta: {
		...typography.caption,
		color: colors.muted,
	},
	actions: {
		flexDirection: 'row',
		gap: spacing.xs,
		marginTop: spacing.sm,
	},
	flex: {
		flex: 1,
	},
})
