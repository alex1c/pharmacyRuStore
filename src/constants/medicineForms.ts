import { MedicineForm } from '@/db/types'

export interface MedicineFormOption {
	code: MedicineForm
	label: string
}

/** User-facing Russian labels for medicine forms. */
export const MEDICINE_FORMS: MedicineFormOption[] = [
	{ code: 'tablet', label: 'Таблетки' },
	{ code: 'capsule', label: 'Капсулы' },
	{ code: 'drops', label: 'Капли' },
	{ code: 'syrup', label: 'Сироп' },
	{ code: 'solution', label: 'Раствор' },
	{ code: 'ointment', label: 'Мазь' },
	{ code: 'cream', label: 'Крем' },
	{ code: 'gel', label: 'Гель' },
	{ code: 'spray', label: 'Спрей' },
	{ code: 'powder', label: 'Порошок' },
	{ code: 'ampoule', label: 'Ампулы' },
	{ code: 'suppository', label: 'Свечи' },
	{ code: 'patch', label: 'Пластырь' },
	{ code: 'other', label: 'Другое' },
]

export function getMedicineFormLabel (code: MedicineForm): string {
	return MEDICINE_FORMS.find((item) => item.code === code)?.label ?? 'Другое'
}
