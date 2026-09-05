import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from 'react'

import { InitializedDatabase } from '@/db/database'
import { ensureFirstRunDefaults, FirstRunSeedResult } from '@/db/seed'
import { SqlExecutor } from '@/db/sqlExecutor'

interface DatabaseContextValue {
	executor: SqlExecutor
	schemaVersion: number
	seed: FirstRunSeedResult
	/** Reload household/person/cabinet pointers after restore. */
	refreshSeed: () => Promise<FirstRunSeedResult>
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

interface DatabaseProviderProps {
	value: InitializedDatabase
	children: ReactNode
}

export function DatabaseProvider ({ value, children }: DatabaseProviderProps) {
	const [seed, setSeed] = useState(value.seed)

	const refreshSeed = useCallback(async () => {
		const next = await ensureFirstRunDefaults(value.executor)
		setSeed(next)
		return next
	}, [value.executor])

	const memo = useMemo(
		() => ({
			executor: value.executor,
			schemaVersion: value.schemaVersion,
			seed,
			refreshSeed,
		}),
		[refreshSeed, seed, value.executor, value.schemaVersion],
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
