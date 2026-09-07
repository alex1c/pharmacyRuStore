/**
 * Generate production Android / splash / RuStore icons from the master artwork.
 * Does not modify assets/icon_gpt.png — only reads it.
 *
 * Usage: node scripts/generate-icons-from-master.js
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const MASTER = path.join(ROOT, 'assets', 'icon_gpt.png')
const IMAGES = path.join(ROOT, 'assets', 'images')
const RUSTORE = path.join(ROOT, 'release-artifacts', 'rustore')

async function ensureDir (dir) {
	await fs.promises.mkdir(dir, { recursive: true })
}

async function main () {
	if (!fs.existsSync(MASTER)) {
		throw new Error(`Master icon missing: ${MASTER}`)
	}

	const meta = await sharp(MASTER).metadata()
	if (meta.format !== 'png') {
		throw new Error(`Master must be PNG, got ${meta.format}`)
	}
	if (!meta.width || !meta.height || meta.width !== meta.height) {
		throw new Error(
			`Master must be square PNG, got ${meta.width}x${meta.height}`,
		)
	}
	if (meta.width < 1024) {
		throw new Error(`Master resolution too small: ${meta.width}`)
	}

	await ensureDir(IMAGES)
	await ensureDir(RUSTORE)
	await ensureDir(path.join(RUSTORE, 'screenshots'))

	// Expo / store square icon (no transparency needed).
	await sharp(MASTER)
		.resize(1024, 1024, { fit: 'cover' })
		.png()
		.toFile(path.join(IMAGES, 'icon.png'))

	// Adaptive: finished master as foreground; solid teal fill as background layer
	// matching the artwork so launcher masks keep visual consistency with RuStore.
	await sharp(MASTER)
		.resize(1024, 1024, { fit: 'cover' })
		.png()
		.toFile(path.join(IMAGES, 'android-icon-foreground.png'))

	await sharp({
		create: {
			width: 1024,
			height: 1024,
			channels: 3,
			background: { r: 42, g: 157, b: 143 }, // #2A9D8F brand teal
		},
	})
		.png()
		.toFile(path.join(IMAGES, 'android-icon-background.png'))

	// Notification small icon: white medical cross on transparent.
	const size = 96
	const thickness = 18
	const cross = Buffer.from(
		`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
			<rect x="${(size - thickness) / 2}" y="12" width="${thickness}" height="${size - 24}" fill="#ffffff" rx="4"/>
			<rect x="12" y="${(size - thickness) / 2}" width="${size - 24}" height="${thickness}" fill="#ffffff" rx="4"/>
		</svg>`,
	)
	await sharp(cross).png().toFile(path.join(IMAGES, 'notification-icon.png'))

	// Splash: centered master on brand background (smaller).
	const splashBg = await sharp({
		create: {
			width: 1284,
			height: 2778,
			channels: 3,
			background: { r: 232, g: 246, b: 243 }, // #E8F6F3
		},
	})
		.png()
		.toBuffer()
	const splashIcon = await sharp(MASTER).resize(512, 512).png().toBuffer()
	await sharp(splashBg)
		.composite([{ input: splashIcon, gravity: 'centre' }])
		.png()
		.toFile(path.join(IMAGES, 'splash-icon.png'))

	await sharp(MASTER)
		.resize(48, 48)
		.png()
		.toFile(path.join(IMAGES, 'favicon.png'))

	// RuStore storefront icon — same master artwork, 1024 square.
	await sharp(MASTER)
		.resize(1024, 1024, { fit: 'cover' })
		.png()
		.toFile(path.join(RUSTORE, 'icon.png'))

	console.log(
		JSON.stringify(
			{
				master: { width: meta.width, height: meta.height },
				generated: [
					'assets/images/icon.png',
					'assets/images/android-icon-foreground.png',
					'assets/images/android-icon-background.png',
					'assets/images/notification-icon.png',
					'assets/images/splash-icon.png',
					'assets/images/favicon.png',
					'release-artifacts/rustore/icon.png',
				],
				note: 'Monochrome adaptive layer omitted to avoid distorting finished master.',
			},
			null,
			2,
		),
	)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
