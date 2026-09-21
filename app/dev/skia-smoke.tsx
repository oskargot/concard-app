/**
 * Stage C1: the SkSL holo finish, composited over a real card.
 *
 * The Skia canvas is an *overlay*. It draws no card of its own — it emits only
 * light, and the wrapper here screen-blends that over a real `Card`, so what
 * you are judging is the finish against actual photo, name and frame rather
 * than against a convenient dark plate.
 *
 * Skia ships in Expo Go on SDK 57, so this route is no longer dev-client-only.
 * The lazy require and error boundary below stay anyway: they now earn their
 * keep catching a *shader* miss rather than a missing native module, and a dead
 * canvas is otherwise a silent white rectangle.
 */

import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type SharedValue } from 'react-native-reanimated';

import { Card } from '@/card/Card';
import { shellMetrics } from '@/card/CardShell';
import { DEMO_CARD } from '@/card/demo-card';
import { FlipCard } from '@/card/FlipCard';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

// Lazy require: a static import would pull Skia in at app start, so any miss
// would redbox the whole app rather than this one route.
type SkiaSmokeComponent = (props: {
	width: number;
	height: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	radius: number;
}) => ReactNode;

let SkiaSmoke: SkiaSmokeComponent | null = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose: a static import would pull Skia's native module in at app start and redbox before this route is ever opened.
	SkiaSmoke = require('@/card/foil/SkiaSmoke').SkiaSmoke as SkiaSmokeComponent;
} catch {
	SkiaSmoke = null;
}

export default function SkiaSmokeScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const cardWidth = Math.min(width - space.xl * 2, 320);

	// The overlay has to land on the card's inner face rect exactly, or its
	// rounded corners will not match the ones under it. `shellMetrics` is the
	// same geometry CardShell itself lays the face out with.
	const m = shellMetrics(cardWidth, DEMO_CARD.style.shape);
	const faceWidth = m.width - m.band * 2;
	const faceHeight = m.height - m.band * 2;
	// `rect`/`shaved` compute a negative face radius; clamp before it reaches an SDF.
	const faceRadius = Math.max(0, m.faceRadius);

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: space.lg, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.intro}>
				<Text style={styles.eyebrow}>SKIA · SKSL</Text>
				<Text style={styles.title}>Holo finish</Text>
				<Text style={styles.body}>
					One runtime shader, screen-blended over a real card. Drag to tilt — the bands sweep and
					the bloom slides opposite your finger. Left alone it drifts slowly on its own. Every knob
					that controls the look sits at the top of{' '}
					<Text style={styles.mono}>src/card/foil/SkiaSmoke.tsx</Text>.
				</Text>
			</View>

			<View style={styles.stage}>
				<SkiaBoundary>
					{SkiaSmoke ? (
						<FlipCard
							width={cardWidth}
							flippable={false}
							renderFront={(rx, ry) => (
								// `isolation: isolate` scopes the screen blend to the card, so the
								// foil brightens the card and not the page behind it.
								<View style={styles.cardStack}>
									{/* No `foil` prop: CardShell only mounts the blend-mode stack when
									    one is named, and the two engines should not fight. */}
									<Card view={DEMO_CARD} width={cardWidth} seed="skia-smoke" rx={rx} ry={ry} />
									<View
										pointerEvents="none"
										style={[
											styles.foil,
											{
												left: m.band,
												top: m.band,
												width: faceWidth,
												height: faceHeight,
												borderRadius: faceRadius
											}
										]}
									>
										<SkiaSmoke
											width={faceWidth}
											height={faceHeight}
											radius={faceRadius}
											rx={rx}
											ry={ry}
										/>
									</View>
								</View>
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

/** Shown when Skia itself cannot be reached at all. */
function Fallback() {
	return (
		<View style={styles.fallback}>
			<Text style={styles.fallbackTitle}>Skia isn&apos;t linked in this app</Text>
			<Text style={styles.fallbackBody}>
				Expo Go ships Skia on SDK 57, so this should not happen — check that{' '}
				<Text style={styles.mono}>@shopify/react-native-skia</Text> matches the SDK with{' '}
				<Text style={styles.mono}>npx expo install --check</Text>. A shader that fails to compile
				reports itself separately, on the canvas.
			</Text>
		</View>
	);
}

/** Catches a render-time miss and swaps in the same panel. */
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
	title: { ...type.hero, color: palette.textPrimary },
	body: { ...type.body, color: palette.textDim },
	stage: { alignItems: 'center', paddingVertical: space.sm, minHeight: 200 },
	cardStack: { isolation: 'isolate' },
	// zIndex/elevation clear CardFace's photo (zIndex 1, elevation 2) and the
	// face light (4) — without them Android can paint the foil underneath.
	foil: {
		position: 'absolute',
		overflow: 'hidden',
		mixBlendMode: 'screen',
		zIndex: 5,
		elevation: 5
	},
	hint: { ...type.meta, color: palette.teal, textAlign: 'center', fontSize: 9 },
	fallback: {
		gap: space.sm,
		padding: space.lg,
		borderRadius: radius.lg,
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	fallbackTitle: { ...type.subtitle, color: palette.textPrimary },
	fallbackBody: { ...type.body, color: palette.textDim },
	mono: { color: palette.warm }
});
