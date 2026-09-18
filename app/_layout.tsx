import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth, type AuthStatus } from '@/auth/AuthProvider';
import { ConcardSync } from '@/store/ConcardSync';
import { palette } from '@/theme/palette';
import { font } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
	/* already hidden — not worth failing a launch over */
});

export default function RootLayout() {
	// Self-hosted rather than fetched: a con hall is exactly where a request to a
	// third-party font CDN fails, and the web app made the same call.
	const [fontsLoaded, fontError] = useFonts({
		// App chrome — Outfit (the mockups' face).
		[font.ui]: require('../assets/fonts/Outfit-Regular.ttf'),
		[font.uiSemi]: require('../assets/fonts/Outfit-SemiBold.ttf'),
		[font.uiBold]: require('../assets/fonts/Outfit-Bold.ttf'),
		// Card face — kept in sync with the web card.
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
		<GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.ground }}>
			<SafeAreaProvider>
				<StatusBar style="light" />
				<AuthProvider>
					<ConcardSync />
					<AuthGate>
						<Stack
							screenOptions={{
								headerStyle: { backgroundColor: palette.ground },
								headerTintColor: palette.textPrimary,
								headerTitleStyle: { fontFamily: font.uiBold },
								contentStyle: { backgroundColor: palette.ground }
							}}
						>
							<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
							<Stack.Screen name="(auth)" options={{ headerShown: false }} />
							<Stack.Screen name="card/edit" options={{ title: 'Edit card' }} />
							<Stack.Screen name="dev/foil-lab" options={{ title: 'Foil lab' }} />
							<Stack.Screen name="dev/foil-sampler" options={{ title: 'Foil sampler' }} />
							<Stack.Screen name="dev/cards" options={{ title: 'Card gallery' }} />
							<Stack.Screen name="dev/stickers" options={{ title: 'Fandom stickers' }} />
						</Stack>
					</AuthGate>
				</AuthProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

/** Where each auth state belongs. Signing up is not finished until there is a
 *  username and a first card (design bible §10), so those are routes, not prompts. */
const HOME_FOR: Record<AuthStatus, string> = {
	unconfigured: '/setup',
	'signed-out': '/login',
	'needs-username': '/onboarding',
	'needs-card': '/first-card',
	ready: '/(tabs)'
};

/**
 * Redirects to wherever the current auth state belongs.
 *
 * Only acts when the user is somewhere they should not be, so it never fights
 * ordinary navigation — a signed-in user opening /dev/foil-lab stays there.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
	const { loading, status } = useAuth();
	const segments = useSegments();
	const router = useRouter();

	useEffect(() => {
		if (loading) return;

		// useSegments() is typed as a tuple of the routes it knows about, so it is
		// widened here rather than indexed past its declared length.
		const path = segments as readonly string[];
		const inAuthFlow = path[0] === '(auth)';
		// Foil lab / sampler / gallery / sticker lab don't need Supabase — leave
		// them alone so a designer can tilt cards without finishing auth first.
		const inDev = path[0] === 'dev';
		const target = HOME_FOR[status];

		if (inDev) return;

		if (status === 'ready') {
			// finished onboarding: get out of the auth flow, but leave any other
			// route (a card detail) alone
			if (inAuthFlow) router.replace('/(tabs)');
			return;
		}

		// Not finished: the auth flow is the only place they may be, and only on
		// the step their state calls for.
		const onCorrectStep = inAuthFlow && `/${path[1] ?? ''}` === target;
		if (!onCorrectStep) router.replace(target as never);
	}, [loading, status, segments, router]);

	if (loading) {
		return (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ActivityIndicator color={palette.holo} />
			</View>
		);
	}

	return <>{children}</>;
}
