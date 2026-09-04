/**
 * Lightweight logging abstraction — swap console for analytics later.
 */

type LogContext = Record<string, unknown>

function formatContext (context?: LogContext): string {
	if (!context || Object.keys(context).length === 0) {
		return ''
	}
	try {
		return ` ${JSON.stringify(context)}`
	} catch {
		return ' [unserializable-context]'
	}
}

export const logger = {
	debug (message: string, context?: LogContext) {
		if (__DEV__) {
			console.log(`[pharmacy:debug] ${message}${formatContext(context)}`)
		}
	},
	info (message: string, context?: LogContext) {
		if (__DEV__) {
			console.log(`[pharmacy:info] ${message}${formatContext(context)}`)
		}
	},
	warn (message: string, context?: LogContext) {
		console.warn(`[pharmacy:warn] ${message}${formatContext(context)}`)
	},
	error (message: string, error?: unknown, context?: LogContext) {
		const details =
			error instanceof Error
				? { name: error.name, message: error.message, ...context }
				: { error, ...context }
		console.error(`[pharmacy:error] ${message}${formatContext(details)}`)
	},
}
