/**
 * Central Russian copy used across Phase 0 screens and shared UI.
 * Keep user-facing strings out of generic reusable components when possible.
 */

export const APP_NAME = 'Моя аптечка'

export const HEALTH_DISCLAIMER =
	'Приложение помогает вести домашний учёт лекарств и расписание приёма. Оно не ставит диагнозы и не заменяет консультацию врача или фармацевта.'

export const tabs = {
	today: {
		title: 'Сегодня',
		empty: 'Здесь появятся лекарства, которые нужно принять сегодня.',
	},
	cabinet: {
		title: 'Аптечка',
		empty: 'Здесь будут храниться ваши лекарства и домашние аптечки.',
	},
	intake: {
		title: 'Приём',
		empty: 'Расписание и история приёма лекарств.',
	},
	shopping: {
		title: 'Покупки',
		empty: 'Здесь появятся лекарства, которые заканчиваются или требуют покупки.',
	},
	more: {
		title: 'Ещё',
		subtitle: 'Настройки, семья, резервная копия и сведения о приложении.',
	},
} as const

/** Legacy placeholder ids — all shipped features use explicit rows on More. */
export const moreRows = [] as const

export const bootstrapCopy = {
	loading: 'Подготавливаем аптечку…',
	errorTitle: 'Не удалось открыть данные',
	errorMessage:
		'Произошла ошибка при подготовке локальной базы данных. Попробуйте ещё раз.',
	retry: 'Повторить',
} as const

export const defaultSeed = {
	personName: 'Я',
	cabinetName: 'Дом',
	householdName: 'Моя семья',
} as const
