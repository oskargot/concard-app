import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/palette';
import { font, radius } from '@/theme/tokens';

export default function TabsLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarStyle: {
					backgroundColor: palette.raised,
					borderTopColor: palette.line,
					height: 76,
					paddingTop: 7,
					paddingBottom: 8
				},
				tabBarActiveTintColor: palette.rose,
				tabBarInactiveTintColor: palette.creamFaint,
				tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 11 },
				sceneStyle: { backgroundColor: palette.base }
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Home',
					tabBarIcon: ({ focused }) => <Glyph focused={focused}>⌂</Glyph>
				}}
			/>
			<Tabs.Screen
				name="card"
				options={{
					title: 'Card',
					tabBarIcon: ({ focused }) => <Glyph focused={focused}>▯</Glyph>
				}}
			/>
			<Tabs.Screen
				name="scan"
				options={{
					title: 'Scan',
					tabBarLabel: '',
					tabBarButton: ({ onPress, accessibilityState }) => (
						<View style={styles.scanSlot}>
							<Pressable
								onPress={onPress}
								accessibilityRole="button"
								accessibilityLabel="Scan a Concard"
								accessibilityState={accessibilityState}
								style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
							>
								<Text style={styles.scanGlyph}>⌁</Text>
							</Pressable>
							<Text style={styles.scanLabel}>SCAN</Text>
						</View>
					)
				}}
			/>
			<Tabs.Screen
				name="stickers"
				options={{
					title: 'Stickers',
					tabBarIcon: ({ focused }) => <Glyph focused={focused}>✦</Glyph>
				}}
			/>
			<Tabs.Screen
				name="binder"
				options={{
					title: 'Binder',
					tabBarIcon: ({ focused }) => <Glyph focused={focused}>▦</Glyph>
				}}
			/>
		</Tabs>
	);
}

function Glyph({ children, focused }: { children: string; focused: boolean }) {
	return (
		<Text style={{ color: focused ? palette.rose : palette.creamMute, fontSize: 21 }}>
			{children}
		</Text>
	);
}

const styles = StyleSheet.create({
	scanSlot: { flex: 1, alignItems: 'center' },
	scanButton: {
		width: 64,
		height: 64,
		borderRadius: radius.xl,
		marginTop: -27,
		backgroundColor: palette.rose,
		borderWidth: 5,
		borderColor: palette.raised,
		alignItems: 'center',
		justifyContent: 'center',
		boxShadow: `0 0 20px ${palette.roseGlow}`
	},
	scanGlyph: { color: palette.void, fontFamily: font.display, fontSize: 33, lineHeight: 38 },
	scanLabel: {
		color: palette.creamMute,
		fontFamily: font.bodyMedium,
		fontSize: 9,
		letterSpacing: 1,
		marginTop: 1
	},
	pressed: { transform: [{ scale: 0.94 }] }
});
