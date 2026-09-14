import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { palette } from '@/theme/palette';
import { font } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
	/* already hidden — not worth failing a launch over */
});

export default function RootLayout() {
	// Self-hosted rather than fetched: a con hall is exactly where a request to a
	// third-party font CDN fails, and the web app made the same call.
	const [fontsLoaded, fontError] = useFonts({
		[font.display]: require('../assets/fonts/Fredoka-Bold.ttf'),
		[font.displaySemi]: require('../assets/fonts/Fredoka-SemiBold.ttf'),
		[font.body]: require('../assets/fonts/SpaceGrotesk-Regular.ttf'),
		[font.bodyMedium]: require('../assets/fonts/SpaceGrotesk-Medium.ttf'),
		[font.bodyBold]: require('../assets/fonts/SpaceGrotesk-Bold.ttf')
	});

	useEffect(() => {
		// Hide on error too: a missing font should degrade to the system face, not
		// leave the user staring at a splash screen forever.
		if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
	}, [fontsLoaded, fontError]);

	if (!fontsLoaded && !fontError) return null;

	return (
		<GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.base }}>
			<SafeAreaProvider>
				<StatusBar style="light" />
				<Stack
					screenOptions={{
						headerStyle: { backgroundColor: palette.base },
						headerTintColor: palette.cream,
						headerTitleStyle: { fontFamily: font.display },
						contentStyle: { backgroundColor: palette.base }
					}}
				>
					<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
					<Stack.Screen name="dev/foil-lab" options={{ title: 'Foil lab' }} />
					<Stack.Screen name="dev/cards" options={{ title: 'Card gallery' }} />
				</Stack>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
