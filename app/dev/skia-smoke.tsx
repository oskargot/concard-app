/**
 * Stage C0 smoke route: proves the Skia canvas draws on a card-sized surface in
 * a development build, driven by FlipCard's tilt.
 *
 * Skia is a native module that only exists in the dev client, never in Expo Go.
 * So the Skia component is required lazily and the whole surface sits behind an
 * error boundary: in the dev client you get the canvas, in Expo Go you get a
 * panel telling you to install the dev build instead of a redbox. This is the
 * one route in the app that is *meant* to be Expo Go-unsafe — see the README.
 */

import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type SharedValue } from 'react-native-reanimated';

import { FlipCard } from '@/card/FlipCard';
import { palette } from '@/theme/palette';
import { CARD_ASPECT, radius, space, type } from '@/theme/tokens';

// Lazy require: importing Skia at app start would try to touch a native module
// Expo Go doesn't ship. Requiring it here keeps the failure contained to this
// route, and the error boundary below catches a render-time miss too.
type SkiaSmokeComponent = (props: {
	width: number;
	height: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
}) => ReactNode;

let SkiaSmoke: SkiaSmokeComponent | null = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose: a static import would pull Skia's native module in at app start and redbox Expo Go before this route is ever opened.
	SkiaSmoke = require('@/card/foil/SkiaSmoke').SkiaSmoke as SkiaSmokeComponent;
} catch {
	SkiaSmoke = null;
}

export default function SkiaSmokeScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const cardWidth = Math.min(width - space.xl * 2, 320);
	const cardHeight = cardWidth / CARD_ASPECT;

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: space.lg, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.intro}>
				<Text style={styles.eyebrow}>DEV CLIENT · SKIA</Text>
				<Text style={styles.title}>Skia smoke</Text>
				<Text style={styles.body}>
					A Skia canvas on a card-sized surface. Drag to tilt — the holo and its specular core slide
					opposite the tilt, driven by the same rx/ry as the foil engines. Proof that Skia is linked
					and reanimated drives it. Not a foil (that&apos;s C1).
				</Text>
			</View>

			<View style={styles.stage}>
				<SkiaBoundary>
					{SkiaSmoke ? (
						<FlipCard
							width={cardWidth}
							flippable={false}
							renderFront={(rx, ry) => (
								<SkiaSmoke width={cardWidth} height={cardHeight} rx={rx} ry={ry} />
							)}
						/>
					) : (
						<Fallback />
					)}
				</SkiaBoundary>
			</View>
			<Text style={styles.hint}>DRAG TO MOVE THE LIGHT</Text>
		</ScrollView>
	);
}

/** Shown in Expo Go (or any build without Skia linked). */
function Fallback() {
	return (
		<View style={styles.fallback}>
			<Text style={styles.fallbackTitle}>Skia isn&apos;t linked in this app</Text>
			<Text style={styles.fallbackBody}>
				This route needs the development build, not Expo Go. Install the dev client and run{' '}
				<Text style={styles.mono}>npx expo start --dev-client</Text>. See the README (&ldquo;Skia
				and the development build&rdquo;) for the exact steps.
			</Text>
		</View>
	);
}

/** Catches a render-time Skia miss (Expo Go throws when the canvas mounts, not
 *  always at require) and swaps in the same fallback panel. */
class SkiaBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	render() {
		if (this.state.failed) return <Fallback />;
		return this.props.children;
	}
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	intro: { gap: space.xs },
	eyebrow: { ...type.meta, color: palette.teal },
	title: { ...type.hero, color: palette.cream },
	body: { ...type.body, color: palette.creamMute },
	stage: { alignItems: 'center', paddingVertical: space.sm, minHeight: 200 },
	hint: { ...type.meta, color: palette.teal, textAlign: 'center', fontSize: 9 },
	fallback: {
		gap: space.sm,
		padding: space.lg,
		borderRadius: radius.lg,
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	fallbackTitle: { ...type.subtitle, color: palette.cream },
	fallbackBody: { ...type.body, color: palette.creamMute },
	mono: { color: palette.butter, fontFamily: 'SpaceGrotesk-Bold' }
});
