/**
 * Validate RuStore screenshot assets: PNG, 1080×1920, portrait, plausible size.
 *
 * Usage: node scripts/validate-store-screenshots.js
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const DIR = path.resolve(
	__dirname,
	'..',
	'release-artifacts',
	'rustore',
	'screenshots',
)
const REQUIRED = [
	'01-today.png',
	'02-cabinet.png',
	'03-medicine.png',
	'04-expiry-stock.png',
	'05-intake.png',
	'06-shopping.png',
	'07-family.png',
	'08-scanner.png',
]
const W = 1080
const H = 1920
const MIN_BYTES = 8_000
const MAX_BYTES = 8_000_000

async function main () {
	const rows = []
	let failed = false
	for (const name of REQUIRED) {
		const file = path.join(DIR, name)
		if (!fs.existsSync(file)) {
			rows.push({ file: name, ok: false, error: 'missing' })
			failed = true
			continue
		}
		const size = fs.statSync(file).size
		const meta = await sharp(file).metadata()
		const ok =
			meta.format === 'png' &&
			meta.width === W &&
			meta.height === H &&
			meta.width < meta.height &&
			size >= MIN_BYTES &&
			size <= MAX_BYTES
		if (!ok) failed = true
		rows.push({
			file: name,
			ok,
			format: meta.format,
			width: meta.width,
			height: meta.height,
			bytes: size,
			ratio: meta.height ? (meta.width / meta.height).toFixed(4) : null,
		})
	}
	const optional = path.join(DIR, '09-backup.png')
	if (fs.existsSync(optional)) {
		const meta = await sharp(optional).metadata()
		rows.push({
			file: '09-backup.png',
			ok: meta.width === W && meta.height === H,
			optional: true,
			width: meta.width,
			height: meta.height,
			bytes: fs.statSync(optional).size,
		})
	}
	console.log(JSON.stringify(rows, null, 2))
	if (failed) process.exit(1)
	console.log('Screenshot validation PASS')
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
