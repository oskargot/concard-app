/**
 * Stage C0 smoke route: proves the Skia canvas draws on a card-sized surface,
 * driven by FlipCard's tilt.
 *
 * Expo Go bundles Skia, so this route runs anywhere the rest of the app does —
 * no dev client needed. The error boundary below is kept as a plain guard: a
 * Skia version that doesn't match the one Expo ships for this SDK is the
 * realistic way the canvas fails, and a panel reads better than a redbox.
 */

import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type SharedValue } from 'react-native-reanimated';

import { FlipCard } from '@/card/FlipCard';
import { palette } from '@/theme/palette';
import { CARD_ASPECT, radius, space, type } from '@/theme/tokens';

// Required rather than statically imported so a broken/mismatched Skia install
// fails on this dev route only, instead of at app start. The error boundary
// below catches a render-time miss too.
type SkiaSmokeComponent = (props: {
	width: number;
	height: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
}) => ReactNode;

let SkiaSmoke: SkiaSmokeComponent | null = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose: keeps a bad Skia install contained to this route instead of redboxing the app at start.
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
				<Text style={styles.eyebrow}>SKIA</Text>
				<Text style={styles.title}>Skia smoke</Text>
				<Text style={styles.body}>
					A Skia canvas on a card-sized surface. Drag to tilt — the holo and its specular core slide
					opposite the tilt, driven by the same rx/ry as the foil engines. Proof that Skia draws and
					reanimated drives it. Not a foil (that&apos;s C1).
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

/** Shown when the Skia canvas can't load — in practice, a version mismatch. */
function Fallback() {
	return (
		<View style={styles.fallback}>
			<Text style={styles.fallbackTitle}>Skia didn&apos;t load</Text>
			<Text style={styles.fallbackBody}>
				Expo Go bundles Skia, so this is almost always a version mismatch. Reinstall the version
				Expo ships for this SDK with{' '}
				<Text style={styles.mono}>npx expo install @shopify/react-native-skia</Text>. See the README
				(&ldquo;Skia&rdquo;) for details.
			</Text>
		</View>
	);
}

/** Catches a render-time Skia miss (the canvas can throw on mount rather than
 *  at require) and swaps in the same fallback panel. */
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
