import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { palette } from '@/theme/palette';
import { font } from '@/theme/tokens';

/**
 * The three tabs of design bible §11: My Card, Scan, Binder.
 *
 * Icons are placeholder glyphs for now — the bible calls for "rounded stroke,
 * slightly stickerish" icons (§12), which is its own design pass rather than a
 * stock icon set dropped in.
 */
export default function TabsLayout() {
	return (
		<Tabs
			screenOptions={{
				headerStyle: { backgroundColor: palette.base },
				headerTintColor: palette.cream,
				headerTitleStyle: { fontFamily: font.display, fontSize: 20 },
				tabBarStyle: {
					backgroundColor: palette.raised,
					borderTopColor: palette.line
				},
				tabBarActiveTintColor: palette.rose,
				tabBarInactiveTintColor: palette.creamFaint,
				tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 11 },
				sceneStyle: { backgroundColor: palette.base }
			}}
		>
			<Tabs.Screen
				name="index"
				options={{ title: 'My Card', tabBarIcon: () => <Glyph>▮</Glyph> }}
			/>
			<Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: () => <Glyph>⬚</Glyph> }} />
			<Tabs.Screen
				name="binder"
				options={{ title: 'Binder', tabBarIcon: () => <Glyph>▤</Glyph> }}
			/>
		</Tabs>
	);
}

function Glyph({ children }: { children: string }) {
	return <Text style={{ color: palette.creamMute, fontSize: 18 }}>{children}</Text>;
}
