/** @type {import('eslint').Linter.Config[]} */
const expoConfig = require('eslint-config-expo/flat')

module.exports = [
	...expoConfig,
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'.expo/**',
			'android/**',
			'ios/**',
			'scripts/**',
		],
	},
	{
		rules: {
			// Keep Phase 0 lean; screens intentionally use inline styles with tokens.
			'react/display-name': 'off',
		},
	},
]
