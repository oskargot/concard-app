import { Tabs, useSegments } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { palette } from '@/theme/palette';
import { uiFont } from '@/theme/tokens';

type IconName = 'home' | 'card' | 'stickers' | 'binder';

export default function TabsLayout() {
	const insets = useSafeAreaInsets();
	const segments = useSegments() as readonly string[];
	const scanActive = segments.includes('scan');

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarHideOnKeyboard: true,
				tabBarStyle: {
					backgroundColor: palette.raised,
					borderTopColor: palette.line,
					borderTopWidth: 1,
					height: 64 + insets.bottom,
					paddingTop: 0,
					paddingBottom: insets.bottom + 4
				},
				tabBarItemStyle: styles.tabItem,
				tabBarActiveTintColor: palette.rose,
				tabBarInactiveTintColor: palette.creamFaint,
				sceneStyle: { backgroundColor: palette.base }
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Home',
					tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
					tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />
				}}
			/>
			<Tabs.Screen
				name="card"
				options={{
					title: 'Card',
					tabBarIcon: ({ focused }) => <TabIcon name="card" focused={focused} />,
					tabBarLabel: ({ focused }) => <TabLabel label="Card" focused={focused} />
				}}
			/>
			<Tabs.Screen
				name="scan"
				options={{
					title: 'Scan',
					tabBarLabel: () => null,
					tabBarButton: ({ onPress, onLongPress, accessibilityState }) => {
						return (
							<View style={styles.scanSlot}>
								<Pressable
									onPress={onPress}
									onLongPress={onLongPress}
									accessibilityRole="tab"
									accessibilityLabel="Scan"
									accessibilityState={{ ...accessibilityState, selected: scanActive }}
									aria-selected={scanActive}
									style={({ pressed }) => [
										styles.scanButton,
										scanActive && styles.scanButtonFocused,
										pressed && styles.pressed
									]}
								>
									<ScanGradient />
									<Text style={styles.scanLabel}>SCAN</Text>
								</Pressable>
							</View>
						);
					}
				}}
			/>
			<Tabs.Screen
				name="stickers"
				options={{
					title: 'Stickers',
					tabBarIcon: ({ focused }) => <TabIcon name="stickers" focused={focused} />,
					tabBarLabel: ({ focused }) => <TabLabel label="Stickers" focused={focused} />
				}}
			/>
			<Tabs.Screen
				name="binder"
				options={{
					title: 'Binder',
					tabBarIcon: ({ focused }) => <TabIcon name="binder" focused={focused} />,
					tabBarLabel: ({ focused }) => <TabLabel label="Binder" focused={focused} />
				}}
			/>
		</Tabs>
	);
}

function ScanGradient() {
	return (
		<Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
			<Defs>
				<LinearGradient id="scan-holo" x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#ffb3e0" />
					<Stop offset="25%" stopColor="#b9c9ff" />
					<Stop offset="50%" stopColor="#9ff0dc" />
					<Stop offset="75%" stopColor="#ffe7a8" />
					<Stop offset="100%" stopColor="#ffb3e0" />
				</LinearGradient>
			</Defs>
			<Rect width="100%" height="100%" fill="url(#scan-holo)" />
		</Svg>
	);
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
	return <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>;
}

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
	const color = focused ? palette.rose : palette.lineStrong;
	const fill = focused ? color : 'none';

	return (
		<Svg width={19} height={19} viewBox="0 0 20 20">
			{name === 'home' ? (
				<Path
					d="M3 9.2 10 3l7 6.2v7.3a.5.5 0 0 1-.5.5h-4.2v-5H7.7v5H3.5a.5.5 0 0 1-.5-.5Z"
					fill={fill}
					stroke={color}
					strokeWidth={1.5}
					strokeLinejoin="round"
				/>
			) : null}
			{name === 'card' ? (
				<Rect
					x={4}
					y={2.5}
					width={12}
					height={15}
					rx={2}
					fill={fill}
					stroke={color}
					strokeWidth={1.5}
				/>
			) : null}
			{name === 'stickers' ? (
				<Polygon
					points="10,2.3 12.2,7.2 17.5,7.8 13.5,11.4 14.6,16.7 10,14 5.4,16.7 6.5,11.4 2.5,7.8 7.8,7.2"
					fill={fill}
					stroke={color}
					strokeWidth={1.5}
					strokeLinejoin="round"
				/>
			) : null}
			{name === 'binder' ? (
				<>
					<Rect
						x={2.5}
						y={3}
						width={6.2}
						height={6.2}
						rx={1.2}
						fill={fill}
						stroke={color}
						strokeWidth={1.4}
					/>
					<Rect
						x={11.3}
						y={3}
						width={6.2}
						height={6.2}
						rx={1.2}
						fill={fill}
						stroke={color}
						strokeWidth={1.4}
					/>
					<Rect
						x={2.5}
						y={11}
						width={6.2}
						height={6.2}
						rx={1.2}
						fill={fill}
						stroke={color}
						strokeWidth={1.4}
					/>
					<Rect
						x={11.3}
						y={11}
						width={6.2}
						height={6.2}
						rx={1.2}
						fill={fill}
						stroke={color}
						strokeWidth={1.4}
					/>
				</>
			) : null}
		</Svg>
	);
}

const styles = StyleSheet.create({
	tabItem: { height: 60, paddingTop: 7 },
	tabLabel: {
		fontFamily: uiFont.regular,
		fontSize: 10,
		lineHeight: 13,
		color: palette.creamFaint,
		marginTop: 2
	},
	tabLabelFocused: { fontFamily: uiFont.semibold, color: palette.rose },
	scanSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
	scanButton: {
		minWidth: 68,
		marginTop: -6,
		paddingVertical: 9,
		paddingHorizontal: 18,
		borderRadius: 22,
		boxShadow: '0 4px 18px rgba(185,201,255,0.30)',
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden'
	},
	scanButtonFocused: { boxShadow: '0 4px 20px rgba(185,201,255,0.40)' },
	scanLabel: {
		fontFamily: uiFont.bold,
		fontSize: 12,
		lineHeight: 15,
		letterSpacing: 0.72,
		color: palette.base
	},
	pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] }
});
