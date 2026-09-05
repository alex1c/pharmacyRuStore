/**
 * Expo config plugin: AppMetrica Android privacy hardening for Phase 8A.
 * Excludes the optional advertising-identifiers module (GAID) per AppMetrica docs
 * when the app does not need Advertising ID collection.
 */

const {
	withAppBuildGradle,
	createRunOncePlugin,
} = require('expo/config-plugins')

const EXCLUDE_SNIPPET = `
// @generated begin pharmacy-appmetrica-no-ad-id
configurations.configureEach {
    exclude group: 'io.appmetrica.analytics', module: 'analytics-identifiers'
}
// @generated end pharmacy-appmetrica-no-ad-id
`

function withAppMetricaNoAdId (config) {
	return withAppBuildGradle(config, (cfg) => {
		if (cfg.modResults.language !== 'groovy') {
			return cfg
		}
		if (cfg.modResults.contents.includes('pharmacy-appmetrica-no-ad-id')) {
			return cfg
		}
		cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${EXCLUDE_SNIPPET}\n`
		return cfg
	})
}

module.exports = createRunOncePlugin(
	withAppMetricaNoAdId,
	'pharmacy-appmetrica-no-ad-id',
	'1.0.0',
)
