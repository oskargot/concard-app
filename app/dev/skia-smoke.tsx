/**
 * Stage C1: the SkSL holo finish, composited over a real card.
 *
 * The Skia canvas is an *overlay*. It draws no card of its own — it emits only
 * light, and the wrapper here screen-blends that over a real `Card`, so what
 * you are judging is the finish against actual photo, name and frame rather
 * than against a convenient dark plate.
 *
 * Skia ships in Expo Go on SDK 57, so this route is no longer dev-client-only
 * and the canvas is imported normally. It used to be a lazy `require` inside a
 * try/catch, guarding a native module Expo Go did not carry -- but that put
 * SkiaSmoke outside the static dependency graph and pinned this module to the
 * component instance it first resolved, so edits to the shader did not reach
 * the phone until Metro was restarted. Tuning the shader by hot-reloading is
 * the point of that file, so the static import matters.
 *
 * The error boundary stays: it catches a render-time throw from the canvas.
 * A shader that fails to *compile* reports itself on the canvas instead.
 */

import { Component, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/card/Card';
import { shellMetrics } from '@/card/CardShell';
import { DEMO_CARD } from '@/card/demo-card';
import { FlipCard } from '@/card/FlipCard';
import { SkiaSmoke } from '@/card/foil/SkiaSmoke';
import { SkiaTextured } from '@/card/foil/SkiaTextured';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

/**
 * The two engines draw the same five terms; they differ only in where the two
 * pinned fields come from. `procedural` computes them (a cosine for the bands,
 * hashes for the grain and flakes); `textured` samples them from illusion.png
 * and glitter.png. Everything else -- ramp, tilt response, glare, rim -- is
 * deliberately identical, so flipping between them compares the pattern source
 * and nothing else.
 */
const ENGINES = ['procedural', 'textured'] as const;
type Engine = (typeof ENGINES)[number];

export default function SkiaSmokeScreen() {
	const [engine, setEngine] = useState<Engine>('procedural');
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
					One runtime shader, screen-blended over a real card. Drag to tilt — the light moves and
					the grain does not. Hold a finger on one speck and tilt: it should stay under your finger
					and change colour rather than crawl. Left alone the card drifts slowly on its own.
				</Text>
				<Text style={styles.body}>
					Two engines draw that same finish. <Text style={styles.mono}>procedural</Text> computes
					the pattern in <Text style={styles.mono}>src/card/foil/SkiaSmoke.tsx</Text>;{' '}
					<Text style={styles.mono}>textured</Text> samples it from two PNGs in{' '}
					<Text style={styles.mono}>src/card/foil/SkiaTextured.tsx</Text>. Both files keep every
					look value in a panel at the top.
				</Text>
			</View>

			<View style={styles.stage}>
				<SkiaBoundary>
					<FlipCard
						width={cardWidth}
						flippable={false}
						renderFront={(rx, ry) => (
							// `isolation: isolate` scopes the screen blend to the card, so the
							// foil brightens the card and not the page behind it.
							<View style={styles.cardStack}>
								{/* No `foil` prop: CardShell only mounts the blend-mode stack
								    when one is named, and the two engines should not fight. */}
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
									{engine === 'procedural' ? (
										<SkiaSmoke
											width={faceWidth}
											height={faceHeight}
											radius={faceRadius}
											rx={rx}
											ry={ry}
										/>
									) : (
										<SkiaTextured
											width={faceWidth}
											height={faceHeight}
											radius={faceRadius}
											rx={rx}
											ry={ry}
										/>
									)}
								</View>
							</View>
						)}
					/>
				</SkiaBoundary>
			</View>
			<Chips options={ENGINES} value={engine} onChange={setEngine} />
			<Text style={styles.hint}>
				{engine === 'procedural'
					? 'PATTERN COMPUTED — COSINE BANDS, HASH GRAIN, HASH FLAKES'
					: 'PATTERN SAMPLED — ILLUSION.PNG CONTOURS, GLITTER.PNG FLAKES'}
			</Text>
			<Text style={styles.hint}>DRAG TO MOVE THE LIGHT, NOT THE GRAIN</Text>
		</ScrollView>
	);
}

/** Engine picker. Same shape as foil-lab's, kept local so the routes stay
 *  independent of each other. */
function Chips<T extends string>({
	options,
	value,
	onChange
}: {
	options: readonly T[];
	value: T;
	onChange: (next: T) => void;
}) {
	return (
		<View style={styles.chipWrap}>
			{options.map((opt) => {
				const on = opt === value;
				return (
					<Pressable
						key={opt}
						onPress={() => onChange(opt)}
						style={[styles.chip, on && styles.chipOn]}
					>
						<Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

/** Shown when the canvas throws while rendering. */
function Fallback() {
	return (
		<View style={styles.fallback}>
			<Text style={styles.fallbackTitle}>The Skia canvas threw</Text>
			<Text style={styles.fallbackBody}>
				Expo Go ships Skia on SDK 57, so this should not happen — check that{' '}
				<Text style={styles.mono}>@shopify/react-native-skia</Text> matches the SDK with{' '}
				<Text style={styles.mono}>npx expo install --check</Text>, and read the Metro log. A shader
				that fails to compile reports itself separately, on the canvas.
			</Text>
		</View>
	);
}

/** Swaps in the panel above rather than redboxing the app. */
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
	chipWrap: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
	chip: {
		paddingVertical: space.xs + 2,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	chipOn: { backgroundColor: palette.rose, borderColor: palette.rose },
	chipText: { ...type.small, color: palette.creamMute },
	chipTextOn: { color: palette.void, fontFamily: 'SpaceGrotesk-Bold' },
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
