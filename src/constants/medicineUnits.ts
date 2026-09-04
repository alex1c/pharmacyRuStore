import { AfterOpeningUnit, MedicineUnit } from '@/db/types'

export interface MedicineUnitOption {
	code: MedicineUnit
	label: string
	/** Short label for quantity summaries, e.g. «табл.» */
	shortLabel: string
}

export const MEDICINE_UNITS: MedicineUnitOption[] = [
	{ code: 'tablet', label: 'Таблетка', shortLabel: 'табл.' },
	{ code: 'capsule', label: 'Капсула', shortLabel: 'капс.' },
	{ code: 'ml', label: 'мл', shortLabel: 'мл' },
	{ code: 'g', label: 'г', shortLabel: 'г' },
	{ code: 'dose', label: 'Доза', shortLabel: 'доз' },
	{ code: 'ampoule', label: 'Ампула', shortLabel: 'амп.' },
	{ code: 'sachet', label: 'Пакет', shortLabel: 'пак.' },
	{ code: 'suppository', label: 'Свеча', shortLabel: 'свеч.' },
	{ code: 'drop', label: 'Капля', shortLabel: 'кап.' },
	{ code: 'pcs', label: 'шт.', shortLabel: 'шт.' },
	{ code: 'other', label: 'Другое', shortLabel: '' },
]

export const AFTER_OPENING_UNITS: { code: AfterOpeningUnit; label: string }[] = [
	{ code: 'days', label: 'дней' },
	{ code: 'weeks', label: 'недель' },
	{ code: 'months', label: 'месяцев' },
]

export function getMedicineUnitLabel (code: MedicineUnit): string {
	return MEDICINE_UNITS.find((item) => item.code === code)?.label ?? 'Другое'
}

export function getMedicineUnitShortLabel (code: MedicineUnit): string {
	return MEDICINE_UNITS.find((item) => item.code === code)?.shortLabel ?? ''
}

export function getAfterOpeningUnitLabel (code: AfterOpeningUnit): string {
	return AFTER_OPENING_UNITS.find((item) => item.code === code)?.label ?? ''
}
