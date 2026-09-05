import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AppErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorState, LoadingState } from '@/components/ui'
import { bootstrapCopy } from '@/constants/copy'
import { colors } from '@/constants/theme'
import { DatabaseProvider } from '@/context/DatabaseContext'
import { useAppBootstrap } from '@/hooks/useAppBootstrap'
SplashScreen.preventAutoHideAsync().catch(() => {
	// Splash may already be hidden in some environments.
})

/**
 * Root layout: controlled DB startup before any tab UI mounts.
 */
export default function RootLayout () {
	const bootstrap = useAppBootstrap()

	useEffect(() => {
		if (bootstrap.status !== 'loading') {
			SplashScreen.hideAsync().catch(() => undefined)
		}
	}, [bootstrap.status])

	if (bootstrap.status === 'loading') {
		return (
			<SafeAreaProvider>
				<View style={styles.fill}>
					<StatusBar style="dark" />
					<LoadingState message={bootstrapCopy.loading} />
				</View>
			</SafeAreaProvider>
		)
	}

	if (bootstrap.status === 'error' || !bootstrap.database) {
		return (
			<SafeAreaProvider>
				<View style={styles.fill}>
					<StatusBar style="dark" />
					<ErrorState
						title={bootstrapCopy.errorTitle}
						message={bootstrapCopy.errorMessage}
						actionLabel={bootstrapCopy.retry}
						onRetry={bootstrap.retry}
					/>
				</View>
			</SafeAreaProvider>
		)
	}

	return (
		<SafeAreaProvider>
			<AppErrorBoundary>
				<DatabaseProvider value={bootstrap.database}>
					<StatusBar style="dark" />
					<Stack screenOptions={{ headerShown: false }}>
					<Stack.Screen name="(tabs)" />
					<Stack.Screen name="cabinets/index" options={{ headerShown: false }} />
					<Stack.Screen
						name="cabinets/[cabinetId]/locations"
						options={{ headerShown: false }}
					/>
					<Stack.Screen name="medicines/add" options={{ headerShown: false }} />
					<Stack.Screen
						name="medicines/[id]/index"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="medicines/[id]/edit"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="medicines/[id]/batches/add"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="medicines/[id]/batches/[batchId]"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="settings/stock-control"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="settings/reminders"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="settings/backup"
						options={{ headerShown: false }}
					/>
					<Stack.Screen name="family/index" options={{ headerShown: false }} />
					<Stack.Screen name="courses/form" options={{ headerShown: false }} />
					<Stack.Screen name="scan/index" options={{ headerShown: false }} />
					<Stack.Screen name="scan/result" options={{ headerShown: false }} />
					<Stack.Screen
						name="scan/select-medicine"
						options={{ headerShown: false }}
					/>
				</Stack>
				</DatabaseProvider>
			</AppErrorBoundary>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	fill: {
		flex: 1,
		backgroundColor: colors.background,
	},
})
