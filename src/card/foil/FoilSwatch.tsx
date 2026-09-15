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
import { CoverFoilTexture, TiledFoilTexture } from './FoilTexture';
import {
	cosmosBand,
	crosshatchBars,
	iceCrackleSheet,
	linearHoloBands,
	linearHoloBarcode,
	linearHoloScanlines,
	radialHotspot,
	rainbowGlitterPastelBand,
	rainbowGlitterSheet
} from './sampler-gradients';
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
}

/** A worklet factory: opacity that rises (or falls) with distance from centre —
 *  the CSS export's `--pfc`, "how far off-centre the light has travelled". */
function pfcOpacity(base: number, coeff: number) {
	return (lx: number, ly: number) => {
		'worklet';
		const pfc = Math.min(1, Math.hypot(lx - 50, ly - 50) / 60);
		return base + coeff * pfc;
	};
}

type Translate = (x: number, y: number) => { tx: number; ty: number };
type OpacityFn = (x: number, y: number) => number;

interface GroupProps {
	x: SharedValue<number>;
	y: SharedValue<number>;
	blend?: ViewStyle['mixBlendMode'];
	opacity?: number;
	opacityFn?: OpacityFn;
	filter?: ViewStyle['filter'];
	children: ReactNode;
}

/** Stands in for one CSS div: its children blend against each other inside
 *  (`isolation:'isolate'`), then the whole composite blends outward as one
 *  layer via this view's own `mixBlendMode` — exactly what `background-blend-mode`
 *  plus an outer `mix-blend-mode` did in the export. */
function Group({ x, y, blend, opacity = 1, opacityFn, filter, children }: GroupProps) {
	const style = useAnimatedStyle(
		() => ({ opacity: opacityFn ? opacityFn(x.value, y.value) : opacity }),
		[opacity, opacityFn]
	);
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				StyleSheet.absoluteFill,
				{ isolation: 'isolate' as const, mixBlendMode: blend, filter },
				style
			]}
		>
			{children}
		</Animated.View>
	);
}

interface GradientLayerProps {
	x: SharedValue<number>;
	y: SharedValue<number>;
	width: number;
	height: number;
	background: string;
	blend?: ViewStyle['mixBlendMode'];
	filter?: ViewStyle['filter'];
	overscan?: number;
	translate?: Translate;
	opacity?: number;
	opacityFn?: OpacityFn;
}

/** One CSS `background-image` layer: a fixed gradient, oversized so it never
 *  shows an edge, translated by `translate` instead of restyled. */
function GradientLayer({
	x,
	y,
	width,
	height,
	background,
	blend,
	filter,
	overscan = 1,
	translate,
	opacity = 1,
	opacityFn
}: GradientLayerProps) {
	// Several source recipes move farther than their original CSS background
	// overscan. Native Views expose that boundary, so translated layers reserve
	// an additional 70% in both dimensions.
	const safeOverscan = translate ? overscan + 0.7 : overscan;
	const w = width * safeOverscan;
	const h = height * safeOverscan;
	const style = useAnimatedStyle(() => {
		const d = translate ? translate(x.value, y.value) : { tx: 0, ty: 0 };
		return {
			transform: [{ translateX: d.tx }, { translateY: d.ty }],
			opacity: opacityFn ? opacityFn(x.value, y.value) : opacity
		};
	});
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				{
					position: 'absolute',
					left: -(w - width) / 2,
					top: -(h - height) / 2,
					width: w,
					height: h,
					mixBlendMode: blend,
					filter,
					experimental_backgroundImage: background
				},
				style
			]}
		/>
	);
}

interface TextureLayerProps {
	x: SharedValue<number>;
	y: SharedValue<number>;
	width: number;
	height: number;
	blend?: ViewStyle['mixBlendMode'];
	overscan?: number;
	translate?: Translate;
	opacity?: number;
	render: (w: number, h: number) => ReactNode;
}

/** Same idea as `GradientLayer`, for card-relative raster texture layers. */
function TextureLayer({
	x,
	y,
	width,
	height,
	blend,
	overscan = 1,
	translate,
	opacity = 1,
	render
}: TextureLayerProps) {
	const w = width * overscan;
	const h = height * overscan;
	const style = useAnimatedStyle(() => {
		const d = translate ? translate(x.value, y.value) : { tx: 0, ty: 0 };
		return { transform: [{ translateX: d.tx }, { translateY: d.ty }] };
	});
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				{
					position: 'absolute',
					left: -(w - width) / 2,
					top: -(h - height) / 2,
					width: w,
					height: h,
					opacity,
					mixBlendMode: blend
				},
				style
			]}
		>
			{render(w, h)}
		</Animated.View>
	);
}

// ---------------------------------------------------------------------------
// The five recipes
// ---------------------------------------------------------------------------

const HOLO_SCANLINES = linearHoloScanlines();
const HOLO_BANDS = linearHoloBands();
const HOLO_BARCODE = linearHoloBarcode();
const HOTSPOT_ICE_WHITE = radialHotspot('hsl(180,100%,95%)', 'rgba(0,0,0,0.85)');

function LinearHoloLayers({ x, y, width, height }: SwatchLight) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				filter={[{ brightness: 1.05 }, { contrast: 1.15 }, { saturate: 1.2 }]}
			>
				<GradientLayer x={x} y={y} width={width} height={height} background={HOLO_SCANLINES} />
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOLO_BANDS}
					blend="overlay"
					overscan={1.6}
					translate={slide(width * 0.5, height * 0.6)}
				/>
				<TextureLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="soft-light"
					opacity={0.55}
					render={(w, h) => <TiledFoilTexture name="grain" width={w} height={h} tileScale={0.32} />}
				/>
			</Group>
			<Group
				x={x}
				y={y}
				blend="hard-light"
				opacity={0.6}
				filter={[{ brightness: 1.1 }, { contrast: 1.1 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOLO_BARCODE}
					overscan={1.4}
					translate={slide(width * 0.22, height * 0.1)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOLO_BARCODE}
					blend="screen"
					overscan={1.4}
					translate={slide(width * 0.18, height * 0.16, false)}
				/>
			</Group>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={HOTSPOT_ICE_WHITE}
				blend="overlay"
				filter={[{ brightness: 0.75 }, { contrast: 2.2 }]}
				overscan={1.7}
				translate={slide(width * 0.32, height * 0.32, false)}
			/>
		</>
	);
}

const GLITTER_SHEET_A = rainbowGlitterSheet('-30deg');
const GLITTER_SHEET_B = rainbowGlitterSheet('-60deg');
const GLITTER_PASTEL = rainbowGlitterPastelBand();
const HOTSPOT_WARM = radialHotspot('hsla(50,20%,90%,0.7)', 'rgba(0,0,0,0.85)');

function RainbowGlitterLayers({ x, y, width, height }: SwatchLight) {
	return (
		<>
			<Group x={x} y={y} filter={[{ contrast: 3 }, { saturate: 1.8 }]}>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={GLITTER_SHEET_A}
					overscan={1.7}
					translate={slide(width * 0.4, height * 0.55)}
				/>
				<TextureLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="overlay"
					render={(w, h) => (
						<TiledFoilTexture name="glitter" width={w} height={h} tileScale={0.25} />
					)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={GLITTER_PASTEL}
					blend="luminosity"
					overscan={1.5}
					translate={slide(0, height * 0.5)}
				/>
			</Group>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				filter={[{ contrast: 3 }]}
				opacityFn={pfcOpacity(1, -0.4)}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={GLITTER_SHEET_B}
					overscan={1.7}
					translate={slide(width * 0.4, height * 0.55, false)}
				/>
				<TextureLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="overlay"
					render={(w, h) => (
						<TiledFoilTexture name="glitter" width={w} height={h} tileScale={0.25} />
					)}
				/>
			</Group>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={HOTSPOT_WARM}
				blend="overlay"
				opacity={0.75}
				overscan={1.6}
				translate={slide(width * 0.3, height * 0.3, false)}
			/>
		</>
	);
}

const CROSSHATCH_A = crosshatchBars('-45deg');
const CROSSHATCH_B = crosshatchBars('45deg');
const HOTSPOT_CROSS_ELLIPSE = radialHotspot('hsl(0,0%,96%)', 'hsl(175,100%,88%)', 20, 130);
const HOTSPOT_CROSS_GLOW = radialHotspot('rgba(255,255,255,0.9)', 'rgba(0,0,0,0.4)', 5, 110);

function RadiantCrosshatchLayers({ x, y, width, height }: SwatchLight) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				filter={[{ brightness: 0.9 }, { contrast: 2 }, { saturate: 1.6 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={CROSSHATCH_A}
					overscan={1.6}
					translate={slide(width * 0.35, height * 0.35)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={CROSSHATCH_B}
					blend="darken"
					overscan={1.6}
					translate={slide(width * 0.35, height * 0.35)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOTSPOT_CROSS_ELLIPSE}
					blend="exclusion"
					overscan={1.6}
					translate={slide(width * 0.14, height * 0.14, false)}
				/>
			</Group>
			<TextureLayer
				x={x}
				y={y}
				width={width}
				height={height}
				blend="multiply"
				opacity={0.9}
				render={(w, h) => <TiledFoilTexture name="trainer" width={w} height={h} tileScale={0.25} />}
			/>
			<TextureLayer
				x={x}
				y={y}
				width={width}
				height={height}
				blend="overlay"
				opacity={0.55}
				render={(w, h) => <TiledFoilTexture name="glitter" width={w} height={h} tileScale={0.15} />}
			/>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={HOTSPOT_CROSS_GLOW}
				blend="hard-light"
				filter={[{ brightness: 1 }, { contrast: 1.5 }]}
				overscan={1.6}
				translate={slide(width * 0.3, height * 0.3, false)}
			/>
		</>
	);
}

const COSMOS_BAND = cosmosBand();
const HOTSPOT_COSMOS = radialHotspot('hsla(204,100%,95%,0.9)', 'hsl(250,15%,15%)', 5, 150);

function CosmosSpeckleLayers({ x, y, width, height }: SwatchLight) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				filter={[{ brightness: 1.1 }, { contrast: 1.1 }, { saturate: 0.9 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={COSMOS_BAND}
					overscan={2.2}
					translate={slide(width * 0.9, height * 0.5)}
				/>
				<TextureLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="color-burn"
					render={() => <CoverFoilTexture name="cosmosBottom" />}
				/>
				<TextureLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="overlay"
					opacity={0.75}
					render={() => <CoverFoilTexture name="cosmosMiddle" />}
				/>
				<TextureLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="screen"
					opacity={0.55}
					render={() => <CoverFoilTexture name="cosmosTop" />}
				/>
			</Group>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={HOTSPOT_COSMOS}
				blend="overlay"
				overscan={1.6}
				translate={slide(width * 0.3, height * 0.3, false)}
				opacityFn={pfcOpacity(0.25, 1)}
			/>
		</>
	);
}

const ICE_SHEET = iceCrackleSheet();
const HOTSPOT_ICE_A = radialHotspot('hsla(190,100%,96%,0.85)', 'hsl(210,30%,10%)', 5, 90);
const HOTSPOT_ICE_B = radialHotspot('hsla(195,100%,92%,0.5)', 'hsl(0,0%,10%)', 8, 70);

function IceCrackleLayers({ x, y, width, height }: SwatchLight) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				opacity={0.85}
				filter={[{ brightness: 0.55 }, { contrast: 1.7 }, { saturate: 0.85 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOTSPOT_ICE_A}
					overscan={1.5}
					translate={slide(width * 0.18, height * 0.18, false)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={ICE_SHEET}
					blend="hard-light"
					overscan={1.8}
					translate={slide(width * 0.45, height * 0.45)}
				/>
				<TextureLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="exclusion"
					opacity={0.65}
					render={(w, h) => (
						<TiledFoilTexture name="illusion" width={w} height={h} tileScale={0.62} />
					)}
				/>
			</Group>
			<Group
				x={x}
				y={y}
				blend="overlay"
				filter={[{ brightness: 0.9 }, { contrast: 1.6 }, { saturate: 0.6 }]}
				opacityFn={pfcOpacity(0.5, 0.5)}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOTSPOT_ICE_B}
					overscan={1.5}
					translate={slide(width * 0.16, height * 0.16, false)}
				/>
				<TextureLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="color-dodge"
					opacity={0.5}
					render={(w, h) => (
						<TiledFoilTexture name="glitter" width={w} height={h} tileScale={0.28} />
					)}
				/>
			</Group>
		</>
	);
}

export const SAMPLER_SWATCHES: SwatchDef[] = [
	{
		id: 'linear-holo',
		index: '01',
		title: 'Linear holo',
		description:
			'Rainbow bands over fine scanlines, color-dodged, sliding against a hard-lit barcode sparkle.',
		tint: '#101218',
		phase: 0,
		render: (l) => <LinearHoloLayers {...l} />
	},
	{
		id: 'rainbow-glitter',
		index: '02',
		title: 'Rainbow glitter',
		description:
			'Two counter-sliding rainbow sheets with a glitter fleck field worked between them.',
		tint: '#14101a',
		phase: 1.1,
		render: (l) => <RainbowGlitterLayers {...l} />
	},
	{
		id: 'radiant-crosshatch',
		index: '03',
		title: 'Radiant crosshatch',
		description:
			'Two greyscale bar stacks at ±45°, darken-blended into a crosshatch, then lit by an ellipse of glow.',
		tint: '#0f1414',
		phase: 2.3,
		render: (l) => <RadiantCrosshatchLayers {...l} />
	},
	{
		id: 'cosmos-speckle',
		index: '04',
		title: 'Cosmos speckle',
		description:
			'A star-speckled field color-burned against a drifting rainbow band, so galaxies glide as the light moves.',
		tint: '#0d1018',
		phase: 3.4,
		render: (l) => <CosmosSpeckleLayers {...l} />
	},
	{
		id: 'ice-crackle',
		index: '13',
		title: 'Ice crackle',
		description:
			'Fracture lines exclusion-blended into a cool sheet — frost breaking the light instead of a rainbow.',
		tint: '#0d1216',
		phase: 5.6,
		render: (l) => <IceCrackleLayers {...l} />
	}
];

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
