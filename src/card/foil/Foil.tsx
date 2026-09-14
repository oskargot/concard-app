/**
 * The card's light, and every foil in the app.
 *
 * One component owns all of it — card tiers and sticker foils both (see
 * `../tiers.ts`) — for the same reason the web card keeps its effect layers in
 * one shell: the light on a foil must never desync from the light on the rest of
 * the card. Everything here is driven by the card's own `rx`/`ry` tilt.
 *
 * This is the CSS trading-card foil technique ported to React Native, which
 * became possible in RN 0.86: `mixBlendMode` carries the full CSS blend set,
 * `experimental_backgroundImage` parses gradient syntax, `filter` gives
 * brightness/contrast/saturate, and `isolation` scopes the blending to the card
 * so a color-dodge layer never reaches the app background behind it.
 *
 * Two deliberate departures from the CSS original:
 *
 *  - CSS `background-blend-mode` blends several backgrounds inside one element.
 *    React Native has no equivalent, so every layer is its own View with its own
 *    `mixBlendMode` and the stack does the same job.
 *  - The CSS version animates `background-position` from pointer coordinates.
 *    Here each moving layer is oversized and *translated* by Reanimated instead,
 *    because a transform is driven on the UI thread and a restyle is not. Same
 *    look, and it holds up while the card is being tilted.
 *
 * `wash`, `spec` and `edge` are ported from the web card's tuned values
 * (`concard/src/lib/components/CardShell.svelte`) so a card looks the same in
 * both renderers.
 *
 * One intentional divergence from the web card: its base face carries a glitter
 * layer (`.glint`). Here glitter is *earned* — design bible §7 makes tier 0
 * "holo base, no extra effect" and tier 1 Glitter, so a base card that already
 * glittered would make the first upgrade invisible.
 */

import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';

import type { FoilKind } from '../tiers';
import {
	HOLO_SPECTRUM,
	holoWash,
	nebula,
	nebulaSecondary,
	radialGlare,
	repeatingLinear
} from './gradients';
import { facetField, glitterField, hashSeed, starField } from './speckle';

/** Every layer the stack can draw, in stacking order. */
export const FOIL_LAYERS = [
	'space',
	'nebula',
	'wash',
	'bars',
	'facets',
	'glitter',
	'stars',
	'spec',
	'edge'
] as const;
export type FoilLayerName = (typeof FOIL_LAYERS)[number];

/**
 * Which layers each foil uses.
 *
 * `none` is tier 0 and is not bare: it gets the holo base every Concard carries.
 * `holo` is the sticker ceiling rather than a card tier, and leans on moving
 * bars because for a sticker, depth is the point.
 */
const RECIPES: Record<FoilKind, readonly FoilLayerName[]> = {
	none: ['wash', 'spec', 'edge'],
	glitter: ['wash', 'glitter', 'spec', 'edge'],
	holo: ['wash', 'bars', 'spec', 'edge'],
	cosmic: ['space', 'nebula', 'stars', 'bars', 'spec', 'edge'],
	mosaic: ['wash', 'facets', 'bars', 'spec', 'edge']
};

/**
 * Default blend and opacity per layer. `wash`, `spec` and `edge` carry the web
 * card's tuned numbers; the tier layers are this pass's starting point and are
 * exactly what /dev/foil-lab exists to tune.
 */
const DEFAULTS: Record<FoilLayerName, { blend: ViewStyle['mixBlendMode']; opacity: number }> = {
	space: { blend: 'normal', opacity: 0.94 },
	nebula: { blend: 'screen', opacity: 0.8 },
	wash: { blend: 'hard-light', opacity: 0.2 },
	bars: { blend: 'color-dodge', opacity: 0.3 },
	facets: { blend: 'color-dodge', opacity: 0.5 },
	glitter: { blend: 'color-dodge', opacity: 0.8 },
	stars: { blend: 'plus-lighter', opacity: 0.9 },
	spec: { blend: 'screen', opacity: 1 },
	edge: { blend: 'normal', opacity: 1 }
};

/** How far a layer slides per degree of tilt, as a fraction of card size.
 *  Bigger reads as deeper — right for a starfield, wrong for a card face. */
const PARALLAX: Partial<Record<FoilLayerName, number>> = {
	wash: 0.0022,
	bars: 0.0016,
	spec: 0.0024,
	nebula: 0.0009,
	stars: 0.0014,
	facets: 0.0006
};

/** Oversize for translated layers, so sliding never exposes an edge. */
const OVERSCAN = 1.4;

/** Tilt range the parallax is mapped across, degrees. Matches FlipCard's clamp. */
const TILT_RANGE = 16;

export interface FoilOverride {
	enabled?: boolean;
	blend?: ViewStyle['mixBlendMode'];
	opacity?: number;
}

export interface FoilProps {
	kind: FoilKind;
	/** Card size in px. Everything scales off this; nothing is hardcoded. */
	width: number;
	height: number;
	/** Tilt in degrees, owned by the card so foil and face share one light. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	/** Seeds the deterministic glitter/star/facet fields — pass the card id. */
	seed: string;
	/** Radius of the face this sits inside, so `edge` follows the card silhouette. */
	radius?: number;
	/** Scales every layer's opacity at once. 0 disables the foil entirely. */
	intensity?: number;
	/** Per-layer overrides. Used by /dev/foil-lab; production passes nothing. */
	overrides?: Partial<Record<FoilLayerName, FoilOverride>>;
	/** Thumbnails ask for sparser dot fields. */
	detail?: 'full' | 'thumb';
}

export function Foil({
	kind,
	width,
	height,
	rx,
	ry,
	seed,
	radius = 0,
	intensity = 1,
	overrides,
	detail = 'full'
}: FoilProps) {
	if (intensity <= 0) return null;

	return (
		// `isolation: isolate` is what keeps color-dodge from reaching through the
		// card and blending with whatever is behind it.
		<View
			style={[StyleSheet.absoluteFill, styles.stack, { borderRadius: radius }]}
			pointerEvents="none"
		>
			{RECIPES[kind].map((name) => {
				const o = overrides?.[name];
				if (o?.enabled === false) return null;
				return (
					<Layer
						key={name}
						name={name}
						blend={o?.blend ?? DEFAULTS[name].blend}
						opacity={(o?.opacity ?? DEFAULTS[name].opacity) * intensity}
						width={width}
						height={height}
						radius={radius}
						rx={rx}
						ry={ry}
						seed={seed}
						detail={detail}
					/>
				);
			})}
		</View>
	);
}

interface LayerProps {
	name: FoilLayerName;
	blend: ViewStyle['mixBlendMode'];
	opacity: number;
	width: number;
	height: number;
	radius: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	seed: string;
	detail: 'full' | 'thumb';
}

function Layer({ name, blend, opacity, width, height, radius, rx, ry, seed, detail }: LayerProps) {
	const parallax = PARALLAX[name] ?? 0;
	const moves = parallax > 0;

	// Translated layers are oversized and centred, so the slide never shows an edge.
	const w = moves ? width * OVERSCAN : width;
	const h = moves ? height * OVERSCAN : height;
	const offX = moves ? -(w - width) / 2 : 0;
	const offY = moves ? -(h - height) / 2 : 0;

	const travelX = width * parallax * TILT_RANGE;
	const travelY = height * parallax * TILT_RANGE;

	const animated = useAnimatedStyle(() => {
		if (!moves) return {};
		// the light sits opposite the tilt, matching the web card's convention
		return {
			transform: [
				{ translateX: interpolate(-ry.value, [-TILT_RANGE, TILT_RANGE], [-travelX, travelX]) },
				{ translateY: interpolate(-rx.value, [-TILT_RANGE, TILT_RANGE], [-travelY, travelY]) }
			]
		};
	});

	const box: ViewStyle = {
		position: 'absolute',
		left: offX,
		top: offY,
		width: w,
		height: h,
		opacity,
		mixBlendMode: blend
	};

	return (
		<Animated.View style={[box, animated]} pointerEvents="none">
			<LayerContent name={name} width={w} height={h} radius={radius} seed={seed} detail={detail} />
		</Animated.View>
	);
}

function LayerContent({
	name,
	width,
	height,
	radius,
	seed,
	detail
}: {
	name: FoilLayerName;
	width: number;
	height: number;
	radius: number;
	seed: string;
	detail: 'full' | 'thumb';
}) {
	const numericSeed = useMemo(() => hashSeed(seed), [seed]);
	const thumb = detail === 'thumb';

	switch (name) {
		case 'wash':
			return <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: WASH }]} />;
		case 'space':
			return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0616' }]} />;
		case 'nebula':
			return (
				<>
					<View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: NEBULA_A }]} />
					<View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: NEBULA_B }]} />
				</>
			);
		case 'bars':
			return <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: BARS }]} />;
		case 'spec':
			return <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: SPEC }]} />;
		case 'edge':
			// a lit top lip and a shadowed bottom one: the whole reason a flat
			// rectangle reads as a card with thickness
			return (
				<View
					style={[
						StyleSheet.absoluteFill,
						{
							borderRadius: radius,
							boxShadow: [
								`inset 0 ${width * 0.012}px ${width * 0.016}px ${-width * 0.008}px rgba(255,255,255,0.5)`,
								`inset 0 ${-width * 0.012}px ${width * 0.016}px ${-width * 0.008}px rgba(23,22,27,0.13)`
							].join(', ')
						}
					]}
				/>
			);
		case 'glitter':
			return (
				<DotField seed={numericSeed} kind="glitter" width={width} height={height} thumb={thumb} />
			);
		case 'stars':
			return (
				<DotField seed={numericSeed} kind="stars" width={width} height={height} thumb={thumb} />
			);
		case 'facets':
			return <FacetField seed={numericSeed} width={width} height={height} thumb={thumb} />;
	}
}

/** Glitter flecks and starfields. Drawn white and blended, so their colour comes
 *  from the layers underneath — which is what makes the light appear to travel
 *  *across* the glitter rather than the glitter itself moving. */
function DotField({
	seed,
	kind,
	width,
	height,
	thumb
}: {
	seed: number;
	kind: 'glitter' | 'stars';
	width: number;
	height: number;
	thumb: boolean;
}) {
	const specks = useMemo(
		() =>
			kind === 'glitter' ? glitterField(seed, thumb ? 70 : 220) : starField(seed, thumb ? 45 : 120),
		[seed, kind, thumb]
	);

	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill}>
			{specks.map((s, i) => (
				<Circle
					key={i}
					cx={s.x * width}
					cy={s.y * height}
					r={s.r * width}
					fill="#ffffff"
					opacity={s.opacity}
				/>
			))}
		</Svg>
	);
}

/** The mosaic tier: a jittered lattice of triangles, each sampling the holo
 *  spectrum at a different rotation. Eight shared gradient defs rather than one
 *  per facet — 70 gradient definitions would cost far more than they buy. */
function FacetField({
	seed,
	width,
	height,
	thumb
}: {
	seed: number;
	width: number;
	height: number;
	thumb: boolean;
}) {
	const facets = useMemo(
		() => (thumb ? facetField(seed, 3, 4) : facetField(seed, 5, 7)),
		[seed, thumb]
	);
	const bucket = 360 / FACET_ANGLES.length;

	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill}>
			<Defs>
				{FACET_ANGLES.map((deg, i) => {
					const a = HOLO_SPECTRUM[i % HOLO_SPECTRUM.length];
					const b = HOLO_SPECTRUM[(i + 2) % HOLO_SPECTRUM.length];
					const rad = (deg * Math.PI) / 180;
					return (
						<LinearGradient
							key={deg}
							id={`facet${i}`}
							x1={`${50 - Math.cos(rad) * 50}%`}
							y1={`${50 - Math.sin(rad) * 50}%`}
							x2={`${50 + Math.cos(rad) * 50}%`}
							y2={`${50 + Math.sin(rad) * 50}%`}
						>
							<Stop offset="0" stopColor={a} />
							<Stop offset="1" stopColor={b} />
						</LinearGradient>
					);
				})}
			</Defs>
			{facets.map((f, i) => (
				<Polygon
					key={i}
					points={f.points.map((p) => `${p.x * width},${p.y * height}`).join(' ')}
					fill={`url(#facet${Math.floor(f.angle / bucket) % FACET_ANGLES.length})`}
					opacity={f.opacity}
				/>
			))}
		</Svg>
	);
}

const FACET_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

// Built once at module load. Rebuilding a gradient string per frame is exactly
// what the transform-based approach exists to avoid.
const WASH = holoWash('118deg', 1);
const BARS = repeatingLinear('102deg', HOLO_SPECTRUM, 4.5, 100);
const SPEC = radialGlare(50, 38, { core: 0.3, mid: 0.08 });
const NEBULA_A = nebula();
const NEBULA_B = nebulaSecondary();

const styles = StyleSheet.create({
	stack: {
		// scopes every blend mode below to the card
		isolation: 'isolate',
		overflow: 'hidden'
	}
});
