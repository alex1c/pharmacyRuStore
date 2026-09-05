import { useCallback, useState } from 'react'
import { Tabs, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { tabs } from '@/constants/copy'
import { colors, touchTarget } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { countActiveShoppingItems } from '@/db/repositories/shoppingItems'
import { safeSyncAutomaticShoppingItems } from '@/domain/shoppingService'

/**
 * Five primary sections of «Моя аптечка».
 */
export default function TabsLayout () {
	const { executor, seed } = useDatabase()
	const [shoppingBadge, setShoppingBadge] = useState<number | undefined>()

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				await safeSyncAutomaticShoppingItems(executor, seed.household.id)
				const count = await countActiveShoppingItems(
					executor,
					seed.household.id,
				)
				setShoppingBadge(count > 0 ? count : undefined)
			})()
		}, [executor, seed.household.id]),
	)

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.muted,
				tabBarStyle: {
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
					minHeight: touchTarget.min + 8,
					paddingBottom: 6,
					paddingTop: 6,
				},
				tabBarLabelStyle: {
					fontSize: 12,
					fontWeight: '600',
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: tabs.today.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="today-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="cabinet"
				options={{
					title: tabs.cabinet.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="medkit-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="intake"
				options={{
					title: tabs.intake.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="checkbox-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="shopping"
				options={{
					title: tabs.shopping.title,
					tabBarBadge: shoppingBadge,
					tabBarBadgeStyle: {
						backgroundColor: colors.danger,
						fontSize: 11,
					},
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="cart-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="more"
				options={{
					title: tabs.more.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	)
}
