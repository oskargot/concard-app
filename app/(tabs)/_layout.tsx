import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { HOLO_GRADIENT, palette } from '@/theme/palette';
import { font, shadow } from '@/theme/tokens';
import { QrGlyph } from '@/ui';

/**
 * Five tabs: Home · Card · Scan · Stickers · Binder.
 *
 * Home / Card / Stickers / Binder are regular tab icons — an outline geometric
 * shape when inactive, a solid holo fill when active. Scan is the one special
 * control: an elevated circular button carrying a stylized QR glyph on a holo
 * gradient, popping above the bar so it reads as the primary meet action. Its
 * glow strengthens on the Scan screen itself.
 */
export default function TabsLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarStyle: {
					backgroundColor: palette.surface,
					borderTopColor: palette.line,
					borderTopWidth: 1,
					height: 64,
					paddingTop: 8,
					paddingBottom: 4
				},
				tabBarActiveTintColor: palette.holo,
				tabBarInactiveTintColor: palette.textFaint,
				tabBarLabelStyle: { fontFamily: font.uiSemi, fontSize: 10 },
				sceneStyle: { backgroundColor: palette.ground }
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Home',
					tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />
				}}
			/>
			<Tabs.Screen
				name="card"
				options={{
					title: 'Card',
					tabBarIcon: ({ focused }) => <CardIcon focused={focused} />
				}}
			/>
			<Tabs.Screen
				name="scan"
				options={{
					title: 'Scan',
					tabBarLabel: () => null,
					tabBarButton: ({ onPress, accessibilityState }) => (
						<ScanButton onPress={onPress} active={!!accessibilityState?.selected} />
					)
				}}
			/>
			<Tabs.Screen
				name="stickers"
				options={{
					title: 'Stickers',
					tabBarIcon: ({ focused }) => <StickersIcon focused={focused} />
				}}
			/>
			<Tabs.Screen
				name="binder"
				options={{
					title: 'Binder',
					tabBarIcon: ({ focused }) => <BinderIcon focused={focused} />
				}}
			/>
		</Tabs>
	);
}

const ICON = 20;

/** Outline when inactive, solid holo fill when active — the guide's tab treatment. */
function iconColors(focused: boolean) {
	return {
		stroke: focused ? palette.holo : palette.mutedUi,
		fill: focused ? palette.holo : 'none'
	};
}

function HomeIcon({ focused }: { focused: boolean }) {
	const { stroke, fill } = iconColors(focused);
	return (
		<Svg width={ICON} height={ICON} viewBox="0 0 20 20">
			<Path
				d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1z"
				stroke={stroke}
				strokeWidth={1.5}
				strokeLinejoin="round"
				fill={focused ? fill : 'none'}
			/>
		</Svg>
	);
}

function CardIcon({ focused }: { focused: boolean }) {
	const { stroke, fill } = iconColors(focused);
	return (
		<Svg width={ICON} height={ICON} viewBox="0 0 20 20">
			<Rect
				x={4.5}
				y={2.5}
				width={11}
				height={15}
				rx={2.5}
				stroke={stroke}
				strokeWidth={1.5}
				fill={focused ? fill : 'none'}
			/>
			{!focused ? (
				<Path d="M7.5 6.5h5M7.5 13.5h3" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
			) : null}
		</Svg>
	);
}

function StickersIcon({ focused }: { focused: boolean }) {
	const { stroke, fill } = iconColors(focused);
	return (
		<Svg width={ICON} height={ICON} viewBox="0 0 20 20">
			<Path
				d="M10 2.2 12 7l4.8 1.8L13 12.2l.6 5-3.6-2.6L6.4 17l.6-5-3.8-3.4L8 7z"
				stroke={stroke}
				strokeWidth={1.5}
				strokeLinejoin="round"
				fill={focused ? fill : 'none'}
			/>
		</Svg>
	);
}

function BinderIcon({ focused }: { focused: boolean }) {
	const { stroke, fill } = iconColors(focused);
	const cell = (x: number, y: number) => (
		<Rect
			x={x}
			y={y}
			width={6}
			height={6}
			rx={1.4}
			stroke={stroke}
			strokeWidth={1.5}
			fill={focused ? fill : 'none'}
		/>
	);
	return (
		<Svg width={ICON} height={ICON} viewBox="0 0 20 20">
			{cell(3, 3)}
			{cell(11, 3)}
			{cell(3, 11)}
			{cell(11, 11)}
		</Svg>
	);
}

function ScanButton({ onPress, active }: { onPress?: unknown; active: boolean }) {
	return (
		<View style={styles.scanSlot} pointerEvents="box-none">
			<Pressable
				onPress={onPress as ((e: GestureResponderEvent) => void) | undefined}
				accessibilityRole="button"
				accessibilityLabel="Scan a Concard"
				accessibilityState={{ selected: active }}
				style={({ pressed }) => [
					styles.scanButton,
					active && styles.scanButtonActive,
					pressed && styles.pressed
				]}
			>
				<QrGlyph size={26} color={palette.ground} />
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	scanSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
	scanButton: {
		width: 56,
		height: 56,
		borderRadius: 28,
		marginTop: -22,
		borderWidth: 4,
		borderColor: palette.surface,
		alignItems: 'center',
		justifyContent: 'center',
		boxShadow: shadow.scan,
		...({ experimental_backgroundImage: HOLO_GRADIENT } as object)
	},
	scanButtonActive: { boxShadow: shadow.scanActive },
	pressed: { transform: [{ scale: 0.94 }] }
});
