/**
 * After `expo prebuild`, wire the pharmacy-specific release keystore into Gradle.
 * Secrets stay under gitignored `keystore/`; android/ is also gitignored.
 *
 * Usage: node scripts/configure-android-signing.js
 */

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const androidApp = path.join(root, 'android', 'app')
const gradlePath = path.join(androidApp, 'build.gradle')
const propsSrc = path.join(root, 'keystore', 'keystore.properties')
const propsDest = path.join(androidApp, 'keystore.properties')
const storeSrc = path.join(root, 'keystore', 'pharmacy-release.jks')
const storeDest = path.join(androidApp, 'pharmacy-release.jks')

function fail (message) {
	console.error(message)
	process.exit(1)
}

if (!fs.existsSync(gradlePath)) {
	fail('android/app/build.gradle missing — run expo prebuild first')
}
if (!fs.existsSync(propsSrc) || !fs.existsSync(storeSrc)) {
	fail('Missing keystore/keystore.properties or pharmacy-release.jks')
}

fs.copyFileSync(propsSrc, propsDest)
fs.copyFileSync(storeSrc, storeDest)

let gradle = fs.readFileSync(gradlePath, 'utf8')

if (!gradle.includes('keystorePropertiesFile')) {
	const inject = `
// Phase 9 — production signing (local keystore files; not committed).
def keystorePropertiesFile = rootProject.file("app/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

`
	gradle = gradle.replace(
		/\nandroid \{/,
		`\n${inject}android {`,
	)
}

if (!gradle.includes("signingConfigs {\n        debug {") && !gradle.includes('signingConfigs {\r\n        debug {')) {
	fail('Unexpected build.gradle signingConfigs layout')
}

if (!gradle.includes('keyAlias keystoreProperties')) {
	gradle = gradle.replace(
		/signingConfigs \{\s*debug \{[\s\S]*?keyPassword 'android'\s*\}\s*\}/,
		(match) => {
			const withoutClose = match.replace(/\}\s*$/, '')
			return `${withoutClose}
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }`
		},
	)
}

// Prefer production release signing over the Expo debug placeholder.
gradle = gradle.replace(
	/release \{\s*\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
	`release {
            // Production pharmacy keystore (local keystore.properties; not committed).
            signingConfig signingConfigs.release`,
)

if (!gradle.includes('signingConfig signingConfigs.release')) {
	fail('Failed to set release signingConfig')
}

fs.writeFileSync(gradlePath, gradle)
console.log('Android release signing configured from keystore/')
