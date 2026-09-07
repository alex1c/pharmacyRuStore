/**
 * Generate RuStore store-ready screenshots (1080×1920) matching app chrome/copy.
 * Ads disabled in these assets. Demo labels only — not first-run seed data.
 *
 * Usage: node scripts/generate-store-screenshots.js
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const OUT = path.resolve(
	__dirname,
	'..',
	'release-artifacts',
	'rustore',
	'screenshots',
)
const W = 1080
const H = 1920

const C = {
	bg: '#E8F6F3',
	surface: '#FFFFFF',
	primary: '#2A9D8F',
	primarySoft: '#D5EFEA',
	text: '#1A2B28',
	muted: '#5C726D',
	border: '#D5E5E1',
	danger: '#C45C5C',
	warn: '#B08900',
	tab: '#FFFFFF',
}

function esc (s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function phoneChrome (title, body, activeTab) {
	const tabs = [
		['today', 'Сегодня'],
		['cabinet', 'Аптечка'],
		['intake', 'Приём'],
		['shopping', 'Покупки'],
		['more', 'Ещё'],
	]
	const tabW = W / tabs.length
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect x="0" y="0" width="${W}" height="72" fill="${C.bg}"/>
  <text x="40" y="48" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="${C.muted}">9:41</text>
  <text x="${W - 40}" y="48" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="${C.muted}">LTE</text>
  <text x="40" y="130" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" fill="${C.text}">${esc(title)}</text>
  ${body}
  <rect x="0" y="${H - 140}" width="${W}" height="140" fill="${C.tab}" stroke="${C.border}"/>
  ${tabs
		.map(([id, label], i) => {
			const x = i * tabW + tabW / 2
			const color = id === activeTab ? C.primary : C.muted
			return `<circle cx="${x}" cy="${H - 95}" r="10" fill="${color}"/>
    <text x="${x}" y="${H - 55}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" fill="${color}">${esc(label)}</text>`
		})
		.join('\n')}
</svg>`
}

function card (x, y, w, h, lines) {
	const text = lines
		.map(
			(line, i) =>
				`<text x="${x + 28}" y="${y + 48 + i * 36}" font-family="Segoe UI, Arial, sans-serif" font-size="${i === 0 ? 30 : 24}" font-weight="${i === 0 ? 700 : 400}" fill="${i === 0 ? C.text : C.muted}">${esc(line)}</text>`,
		)
		.join('\n')
	return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${C.surface}" stroke="${C.border}"/>
  ${text}`
}

function button (x, y, w, label, primary = true) {
	return `<rect x="${x}" y="${y}" width="${w}" height="64" rx="16" fill="${primary ? C.primary : C.primarySoft}"/>
  <text x="${x + w / 2}" y="${y + 42}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="${primary ? '#fff' : C.primary}">${esc(label)}</text>`
}

const screens = {
	'01-today.png': phoneChrome(
		'Сегодня',
		`
  ${card(40, 170, 1000, 150, ['Требуют внимания', 'Лозартан — мало осталось', 'Глазные капли — срок скоро'])}
  ${card(40, 350, 1000, 220, ['08:00 · Я', 'Лозартан 50 мг — 1 таблетка', 'Ожидает приёма'])}
  ${button(70, 490, 280, 'Принял')}
  ${button(370, 490, 280, 'Пропустить', false)}
  ${button(670, 490, 320, 'Отложить', false)}
  ${card(40, 620, 1000, 200, ['13:00 · Анна', 'Нурофен 200 мг — 1 таблетка', 'Позже сегодня'])}
  ${card(40, 850, 1000, 180, ['21:00 · Я', 'Витамин D — 1 капсула', 'Вечерний приём'])}
  `,
		'today',
	),
	'02-cabinet.png': phoneChrome(
		'Аптечка',
		`
  <rect x="40" y="170" width="1000" height="72" rx="16" fill="${C.surface}" stroke="${C.border}"/>
  <text x="70" y="216" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="${C.muted}">Поиск лекарств</text>
  ${card(40, 270, 1000, 170, ['Нурофен 200 мг', '24 таблетки · Дом / Аптечка', 'Срок до 2027-03'])}
  ${card(40, 470, 1000, 170, ['Лозартан 50 мг', '8 таблеток · мало осталось', 'Срок до 2026-11'])}
  ${card(40, 670, 1000, 170, ['Витамин D', '56 капсул · Дом', 'Срок до 2027-08'])}
  ${card(40, 870, 1000, 170, ['Глазные капли', '1 флакон · Автомобиль', 'Срок скоро'])}
  ${button(40, 1080, 1000, '+ Добавить')}
  `,
		'cabinet',
	),
	'03-medicine.png': phoneChrome(
		'Нурофен 200 мг',
		`
  ${card(40, 170, 1000, 220, ['Общий остаток: 24 таблетки', 'Форма: таблетки', 'Место: Дом'])}
  <text x="40" y="450" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" fill="${C.text}">Упаковки</text>
  ${card(40, 480, 1000, 180, ['Упаковка A · 16 шт.', 'Срок 2027-03 · Дом / Аптечка'])}
  ${card(40, 690, 1000, 180, ['Упаковка B · 8 шт.', 'Срок 2026-12 · Дом / Аптечка'])}
  ${button(40, 920, 1000, 'Добавить упаковку', false)}
  `,
		'cabinet',
	),
	'04-expiry-stock.png': phoneChrome(
		'Контроль запасов',
		`
  ${card(40, 170, 1000, 160, ['Скоро истекает', 'Глазные капли — осталось меньше месяца'])}
  ${card(40, 360, 1000, 160, ['Мало осталось', 'Лозартан 50 мг — 8 таблеток'])}
  ${card(40, 550, 1000, 160, ['В наличии', 'Нурофен 200 мг — 24 таблетки'])}
  ${card(40, 740, 1000, 160, ['В наличии', 'Витамин D — 56 капсул'])}
  <text x="40" y="980" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="${C.muted}">Пороги и предупреждения настраиваются в Ещё.</text>
  `,
		'more',
	),
	'05-intake.png': phoneChrome(
		'Приём',
		`
  ${card(40, 170, 1000, 220, ['Лозартан · Я', 'Ежедневно · 08:00', 'Курс активен'])}
  ${card(40, 420, 1000, 220, ['Нурофен · Анна', 'По необходимости', 'PRN'])}
  ${card(40, 670, 1000, 220, ['Витамин D · Я', 'Ежедневно · 21:00', 'Курс активен'])}
  ${button(40, 930, 1000, 'Новый курс', false)}
  `,
		'intake',
	),
	'06-shopping.png': phoneChrome(
		'Покупки',
		`
  <text x="40" y="190" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="${C.muted}">Нужно купить: 3</text>
  ${card(40, 220, 1000, 180, ['Лозартан 50 мг', 'Мало осталось', 'Куплено →'])}
  ${card(40, 430, 1000, 180, ['Глазные капли', 'Закончился', 'Куплено →'])}
  ${card(40, 640, 1000, 180, ['Бинт стерильный', 'Добавлено вручную', 'Куплено →'])}
  ${button(40, 860, 1000, '+ Добавить')}
  `,
		'shopping',
	),
	'07-family.png': phoneChrome(
		'Члены семьи',
		`
  ${card(40, 170, 1000, 200, ['Я', 'Активных курсов: 2', 'Основной профиль'])}
  ${card(40, 400, 1000, 200, ['Анна', 'Активных курсов: 1', 'Семья'])}
  ${button(40, 640, 1000, 'Добавить человека', false)}
  <text x="40" y="760" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="${C.muted}">Имена хранятся только на устройстве.</text>
  `,
		'more',
	),
	'08-scanner.png': phoneChrome(
		'Сканер',
		`
  <rect x="90" y="200" width="900" height="900" rx="28" fill="#1A2B28"/>
  <rect x="190" y="420" width="700" height="420" rx="18" fill="none" stroke="${C.primary}" stroke-width="6"/>
  <text x="540" y="660" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#FFFFFF">Наведите на штрихкод</text>
  <text x="540" y="1180" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="${C.muted}">Или введите код вручную</text>
  ${button(190, 1240, 700, 'Ввести код вручную', false)}
  `,
		'cabinet',
	),
	'09-backup.png': phoneChrome(
		'Резервная копия',
		`
  ${card(40, 170, 1000, 220, ['Создать резервную копию', 'Локальный ZIP-файл', 'Сохраните в надёжном месте'])}
  ${button(70, 300, 940, 'Создать копию')}
  ${card(40, 480, 1000, 220, ['Восстановить из файла', 'Заменит текущие данные', 'Выберите ZIP через систему'])}
  ${button(70, 610, 940, 'Восстановить', false)}
  <text x="40" y="820" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="${C.muted}">Файл не загружается на сервер разработчика.</text>
  `,
		'more',
	),
}

async function main () {
	await fs.promises.mkdir(OUT, { recursive: true })
	const report = []
	for (const [name, svg] of Object.entries(screens)) {
		const file = path.join(OUT, name)
		await sharp(Buffer.from(svg)).png().toFile(file)
		const meta = await sharp(file).metadata()
		report.push({
			file: name,
			width: meta.width,
			height: meta.height,
			ok: meta.width === W && meta.height === H,
		})
	}
	console.log(JSON.stringify(report, null, 2))
	if (report.some((r) => !r.ok)) {
		process.exit(1)
	}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
