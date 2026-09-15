/**
 * The foil sampler's swatch card — one blank card mock plus a recipe from
 * `recipes.ts`, driven by an automatic light sweep with a touch takeover.
 *
 * `Foil.tsx` / `FoilV2` are the engines that sit on a real Concard. This is a
 * different job: five *named* techniques on blank mocks for side-by-side
 * comparison, each running an idle sine sweep rather than sitting still until
 * touched.
 */

import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	type SharedValue
} from 'react-native-reanimated';

import { repeatingLinear } from './gradients';
import { FOIL_RECIPES, SAMPLER_RECIPE_IDS, type FoilRecipeId } from './recipes';
import { hashSeed } from './speckle';
import { palette } from '../../theme/palette';
import { radius, space, type as t } from '../../theme/tokens';

const SWATCH_ASPECT = 0.718;

export interface SwatchDef {
	id: FoilRecipeId;
	index: string;
	title: string;
	description: string;
	tint: string;
	phase: number;
	render: (light: {
		x: SharedValue<number>;
		y: SharedValue<number>;
		width: number;
		height: number;
		seed: number;
	}) => ReactNode;
}

export interface FoilSwatchProps {
	def: SwatchDef;
	width: number;
	/** Shared clock (seconds), owned by the screen so every swatch sweeps off one driver. */
	now: SharedValue<number>;
	/** Degrees of tilt per unit of light offset from centre. 0 disables tilt. */
	tilt?: number;
}

export type SamplerFoilPreset =
	'linear-holo' | 'rainbow-glitter' | 'radiant-crosshatch' | 'cosmos-speckle' | 'ice-crackle';

/**
 * The sampler techniques adapted for a real card: the card's tilt owns the
 * light position, and a restrained outer opacity keeps copy and artwork clear.
 */
export function SamplerFoil({
	preset,
	width,
	height,
	rx,
	ry,
	seed,
	intensity,
	blend = 'screen'
}: {
	preset: SamplerFoilPreset;
	width: number;
	height: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	seed: string;
	intensity: number;
	blend?: ViewStyle['mixBlendMode'];
}) {
	const x = useDerivedValue(() => clampPct(50 + (ry.value / 10) * 44));
	const y = useDerivedValue(() => clampPct(50 - (rx.value / 10) * 42));
	const light = { x, y, width, height };
	const numericSeed = useMemo(() => hashSeed(seed), [seed]);

	return (
		<View
			style={[
				StyleSheet.absoluteFill,
				{ opacity: intensity, mixBlendMode: blend, isolation: 'isolate' }
			]}
			pointerEvents="none"
		>
			{preset === 'linear-holo' ? <LinearHoloLayers {...light} /> : null}
			{preset === 'rainbow-glitter' ? <RainbowGlitterLayers {...light} seed={numericSeed} /> : null}
			{preset === 'radiant-crosshatch' ? <RadiantCrosshatchLayers {...light} /> : null}
			{preset === 'cosmos-speckle' ? <CosmosSpeckleLayers {...light} seed={numericSeed} /> : null}
			{preset === 'ice-crackle' ? <IceCrackleLayers {...light} seed={numericSeed} /> : null}
		</View>
	);
}

export function FoilSwatch({ def, width, now, tilt = 1 }: FoilSwatchProps) {
	const height = width / SWATCH_ASPECT;

	const manual = useSharedValue(false);
	const touchX = useSharedValue(50);
	const touchY = useSharedValue(50);

	const pan = Gesture.Pan()
		.onBegin((e) => {
			manual.value = true;
			touchX.value = clampPct((e.x / width) * 100);
			touchY.value = clampPct((e.y / height) * 100);
		})
		.onChange((e) => {
			touchX.value = clampPct((e.x / width) * 100);
			touchY.value = clampPct((e.y / height) * 100);
		})
		.onFinalize(() => {
			manual.value = false;
		});

	const x = useDerivedValue(() => {
		if (manual.value) return touchX.value;
		return 50 + 44 * Math.sin(now.value * 0.9 + def.phase);
	});
	const y = useDerivedValue(() => {
		if (manual.value) return touchY.value;
		return 50 + 42 * Math.sin(now.value * 0.63 + def.phase * 1.7 + 1.1);
	});

	const rotatorStyle = useAnimatedStyle(
		() => ({
			transform: [
				{ perspective: 900 },
				{ rotateY: `${(x.value - 50) * 0.3 * tilt}deg` },
				{ rotateX: `${(50 - y.value) * 0.26 * tilt}deg` }
			]
		}),
		[tilt]
	);

	const seed = hashSeed(`sampler-${def.id}`);

	return (
		<View style={styles.col}>
			<GestureDetector gesture={pan}>
				<Animated.View
					style={[{ width, height, borderRadius: radius.md }, styles.shell, rotatorStyle]}
				>
					<BlankCardMock tint={def.tint} width={width} height={height} />
					<View style={[styles.stack, { borderRadius: radius.md }]} pointerEvents="none">
						{def.render({ x, y, width, height, seed })}
					</View>
				</Animated.View>
			</GestureDetector>
			<View style={styles.caption}>
				<View style={styles.captionRow}>
					<Text style={styles.index}>{def.index}</Text>
					<Text style={styles.title}>{def.title}</Text>
				</View>
				<Text style={styles.desc}>{def.description}</Text>
			</View>
		</View>
	);
}

function clampPct(n: number): number {
	'worklet';
	return Math.min(100, Math.max(0, n));
}

const SAMPLER_INDEX: Record<string, string> = {
	'linear-holo': '01',
	'rainbow-glitter': '02',
	'radiant-crosshatch': '03',
	'cosmos-speckle': '04',
	'ice-crackle': '13'
};

export const SAMPLER_SWATCHES: SwatchDef[] = SAMPLER_RECIPE_IDS.map((id) => {
	const recipe = FOIL_RECIPES[id];
	return {
		id,
		index: SAMPLER_INDEX[id] ?? '··',
		title: recipe.title,
		description: recipe.description,
		tint: recipe.tint,
		phase: recipe.phase,
		render: recipe.render
	};
});

// ---------------------------------------------------------------------------
// Blank card mock — the export's placeholder card, not a real Concard
// ---------------------------------------------------------------------------

function BlankCardMock({ tint, width, height }: { tint: string; width: number; height: number }) {
	const stripeA = lighten(tint, 0.07);
	const stripeB = lighten(tint, 0.03);
	const artA = lighten(tint, 0.11);
	const artB = lighten(tint, 0.07);
	const divider = lighten(tint, 0.14);
	const bar = lighten(tint, 0.09);
	const barMute = lighten(tint, 0.05);
	const label = lighten(tint, 0.38);

	return (
		<View
			style={[
				StyleSheet.absoluteFill,
				{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: tint }
			]}
		>
			<View
				style={[
					StyleSheet.absoluteFill,
					{ experimental_backgroundImage: repeatingLinear('135deg', [stripeA, stripeB], 3, 100) }
				]}
			/>
			<View
				style={{
					position: 'absolute',
					left: width * 0.07,
					right: width * 0.07,
					top: height * 0.07,
					bottom: height * 0.46,
					borderRadius: 4,
					overflow: 'hidden',
					alignItems: 'center',
					justifyContent: 'center',
					experimental_backgroundImage: repeatingLinear('115deg', [artA, artB], 4, 100)
				}}
			>
				<Text style={{ fontSize: 9, letterSpacing: 1.4, color: label, textTransform: 'uppercase' }}>
					card art
				</Text>
			</View>
			<View
				style={{
					position: 'absolute',
					left: width * 0.07,
					right: width * 0.07,
					top: height * 0.57,
					height: 1,
					backgroundColor: divider
				}}
			/>
			<View
				style={{
					position: 'absolute',
					left: width * 0.07,
					right: width * 0.07,
					top: height * 0.61,
					gap: 6
				}}
			>
				<View style={{ height: 6, width: '74%', borderRadius: 2, backgroundColor: bar }} />
				<View style={{ height: 6, width: '52%', borderRadius: 2, backgroundColor: barMute }} />
				<View style={{ height: 6, width: '63%', borderRadius: 2, backgroundColor: barMute }} />
			</View>
		</View>
	);
}

function lighten(hex: string, amount: number): string {
	const h = hex.replace('#', '');
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
	const mix = (v: number) => Math.round(v + (255 - v) * amount);
	return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

const styles = StyleSheet.create({
	col: { gap: space.md },
	shell: {
		boxShadow: '0 18px 32px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)'
	} as ViewStyle,
	stack: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		overflow: 'hidden',
		isolation: 'isolate'
	} as ViewStyle,
	caption: { gap: space.xs },
	captionRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
	index: { ...t.meta, color: palette.creamFaint, letterSpacing: 0 },
	title: { ...t.subtitle, color: palette.cream },
	desc: { ...t.small, color: palette.creamMute }
});
