/**
 * Inventory CSV export for household use (not a restore format).
 */

import { SqlExecutor } from '@/db/sqlExecutor'
import { getMedicineFormLabel } from '@/constants/medicineForms'
import { getAfterOpeningUnitLabel, getMedicineUnitShortLabel } from '@/constants/medicineUnits'
import { formatExpiryDisplay } from '@/utils/expiry'
import { formatQuantity } from '@/utils/quantity'

const BOM = '\uFEFF'
const SEPARATOR = ';'

const HEADERS = [
	'Лекарство',
	'Форма',
	'Дозировка',
	'Аптечка',
	'Место',
	'Остаток',
	'Единица',
	'Срок годности',
	'Дата вскрытия',
	'Срок после вскрытия',
	'Партия',
	'Заметка',
] as const

/**
 * Builds UTF-8 BOM CSV with `;` separators — one row per active batch.
 */
export async function buildInventoryCsv (db: SqlExecutor): Promise<string> {
	const rows = await db.getAllAsync<{
		medicine_name: string
		form: string
		strength_text: string | null
		cabinet_name: string
		location_name: string | null
		quantity: number
		unit: string
		expiry_date: string | null
		opened_at: string | null
		after_opening_value: number | null
		after_opening_unit: string | null
		lot_number: string | null
		notes: string | null
	}>(
		`SELECT
			m.name AS medicine_name,
			m.form AS form,
			m.strength_text AS strength_text,
			c.name AS cabinet_name,
			l.name AS location_name,
			b.quantity AS quantity,
			b.unit AS unit,
			b.expiry_date AS expiry_date,
			b.opened_at AS opened_at,
			b.after_opening_value AS after_opening_value,
			b.after_opening_unit AS after_opening_unit,
			b.lot_number AS lot_number,
			COALESCE(b.notes, m.notes) AS notes
		 FROM medicine_batches b
		 INNER JOIN medicines m ON m.id = b.medicine_id
		 INNER JOIN medicine_cabinets c ON c.id = b.cabinet_id
		 LEFT JOIN storage_locations l ON l.id = b.storage_location_id
		 WHERE b.archived_at IS NULL
			 AND m.archived_at IS NULL
		 ORDER BY m.name COLLATE NOCASE, b.created_at ASC`,
	)

	const lines = [HEADERS.map(escapeCsvField).join(SEPARATOR)]
	for (const row of rows) {
		const afterOpening =
			row.after_opening_value != null && row.after_opening_unit
				? `${formatQuantity(row.after_opening_value)} ${getAfterOpeningUnitLabel(row.after_opening_unit as 'days' | 'weeks' | 'months')}`
				: ''
		const line = [
			row.medicine_name,
			getMedicineFormLabel(row.form as never),
			row.strength_text ?? '',
			row.cabinet_name,
			row.location_name ?? '',
			formatQuantity(row.quantity),
			getMedicineUnitShortLabel(row.unit as never),
			formatExpiryDisplay(row.expiry_date) ?? '',
			formatOpenedDate(row.opened_at),
			afterOpening,
			row.lot_number ?? '',
			row.notes ?? '',
		]
			.map(escapeCsvField)
			.join(SEPARATOR)
		lines.push(line)
	}

	return BOM + lines.join('\r\n') + '\r\n'
}

export function escapeCsvField (value: string): string {
	const text = value ?? ''
	if (
		text.includes('"') ||
		text.includes(';') ||
		text.includes('\n') ||
		text.includes('\r')
	) {
		return `"${text.replace(/"/g, '""')}"`
	}
	return text
}

function formatOpenedDate (value: string | null): string {
	if (!value) {
		return ''
	}
	// Prefer DD.MM.YYYY for date-only values.
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (match) {
		return `${match[3]}.${match[2]}.${match[1]}`
	}
	return value
}
