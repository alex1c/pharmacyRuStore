import {
	createContext,
	ReactNode,
	useContext,
	useMemo,
} from 'react'

import { InitializedDatabase } from '@/db/database'
import { FirstRunSeedResult } from '@/db/seed'
import { SqlExecutor } from '@/db/sqlExecutor'

interface DatabaseContextValue {
	executor: SqlExecutor
	schemaVersion: number
	seed: FirstRunSeedResult
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

interface DatabaseProviderProps {
	value: InitializedDatabase
	children: ReactNode
}

export function DatabaseProvider ({ value, children }: DatabaseProviderProps) {
	const memo = useMemo(
		() => ({
			executor: value.executor,
			schemaVersion: value.schemaVersion,
			seed: value.seed,
		}),
		[value],
	)

	return (
		<DatabaseContext.Provider value={memo}>{children}</DatabaseContext.Provider>
	)
}

export function useDatabase (): DatabaseContextValue {
	const ctx = useContext(DatabaseContext)
	if (!ctx) {
		throw new Error('useDatabase must be used within DatabaseProvider')
	}
	return ctx
}
