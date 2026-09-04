import { Component, ErrorInfo, ReactNode } from 'react'

import { ErrorState } from '@/components/ui'
import { analytics } from '@/services/analytics'
import { logger } from '@/services/logging'

interface Props {
	children: ReactNode
}

interface State {
	hasError: boolean
}

/**
 * Top-level error boundary with Russian user-facing fallback.
 * Stack traces stay in logs / analytics abstraction only.
 */
export class AppErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false }

	static getDerivedStateFromError (): State {
		return { hasError: true }
	}

	componentDidCatch (error: Error, info: ErrorInfo) {
		logger.error('Unhandled UI error', error, {
			componentStack: info.componentStack ?? undefined,
		})
		analytics.reportError(error, {
			source: 'AppErrorBoundary',
		})
	}

	private handleRetry = () => {
		this.setState({ hasError: false })
	}

	render () {
		if (this.state.hasError) {
			return (
				<ErrorState
					title="Что-то пошло не так"
					message="Произошла непредвиденная ошибка. Попробуйте продолжить работу."
					actionLabel="Продолжить"
					onRetry={this.handleRetry}
				/>
			)
		}

		return this.props.children
	}
}
