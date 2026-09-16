/**
 * Shared light-driven foil primitives.
 *
 * Used by `/dev/foil-sampler` (idle sweep + touch) and by `FoilV2` (FlipCard
 * tilt). Both speak the same language: light position as 0..100% SharedValues,
 * oversized layers translated instead of restyled, and `Group` standing in for
 * CSS `background-blend-mode` + outer `mix-blend-mode`.
 */

import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, {
	Circle,
	Defs,
	LinearGradient,
	Pattern,
	Polygon,
	Polyline,
	Rect,
	Stop
} from 'react-native-svg';

import { crackleField, glitterField, starField, type Speck } from './speckle';

export interface FoilLight {
	/** Light position, 0..100 of the surface's own width/height. */
	x: SharedValue<number>;
	y: SharedValue<number>;
	width: number;
	height: number;
}

/** Slides an oversized layer opposite (or with) the light.
 *  Carry `ampX`/`ampY` so GradientLayer can size itself to hide edges. */
export function slide(ampX: number, ampY: number, invert = true): LayerMotion {
	const s = invert ? -1 : 1;
	return {
		ampX,
		ampY,
		translate: (lx: number, ly: number) => {
			'worklet';
			return { tx: s * ((lx - 50) / 50) * ampX, ty: s * ((ly - 50) / 50) * ampY };
		}
	};
}

/**
 * How big a moving layer must be so ±amp travel never shows an edge.
 * Padding on each side must be ≥ amp; plus a small margin for rounding.
 */
export function overscanFor(
	width: number,
	height: number,
	motion: LayerMotion | undefined,
	margin = 0.18
): number {
	if (!motion) return 1;
	const fx = width > 0 ? motion.ampX / width : 0;
	const fy = height > 0 ? motion.ampY / height : 0;
	return 1 + 2 * Math.max(fx, fy) + margin;
}

/** Opacity that rises (or falls) with distance from centre — simey's `--pfc`. */
export function pfcOpacity(base: number, coeff: number) {
	return (lx: number, ly: number) => {
		'worklet';
		const pfc = Math.min(1, Math.hypot(lx - 50, ly - 50) / 60);
		return base + coeff * pfc;
	};
}

/** Four facet orientations catch light at different angles without moving the grain. */
export function facetOpacity(group: number, strength = 1) {
	return (lx: number, ly: number) => {
		'worklet';
		const angle = group * 1.5708 + 0.4;
		const alignment = Math.cos(
			((lx - 50) * Math.cos(angle) + (ly - 50) * Math.sin(angle)) * 0.085 + group * 1.8
		);
		return strength * (0.025 + 0.8 * Math.pow(Math.max(0, alignment), 8));
	};
}

type Translate = (x: number, y: number) => { tx: number; ty: number };
type OpacityFn = (x: number, y: number) => number;

export interface LayerMotion {
	translate: Translate;
	/** Max travel in px along X when the light goes edge to edge. */
	ampX: number;
	/** Max travel in px along Y when the light goes edge to edge. */
	ampY: number;
}

interface GroupProps {
	x: SharedValue<number>;
	y: SharedValue<number>;
	blend?: ViewStyle['mixBlendMode'];
	opacity?: number;
	opacityFn?: OpacityFn;
	filter?: ViewStyle['filter'];
	children: ReactNode;
}

/** One CSS shine/glare div: children blend inside, then the composite blends out. */
export function Group({ x, y, blend, opacity = 1, opacityFn, filter, children }: GroupProps) {
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
	/** Override auto-sizing. Prefer `motion` — overscan is derived from travel. */
	overscan?: number;
	motion?: LayerMotion;
	opacity?: number;
	opacityFn?: OpacityFn;
}

/** One CSS `background-image`: fixed gradient, oversized, transform-translated. */
export function GradientLayer({
	x,
	y,
	width,
	height,
	background,
	blend,
	filter,
	overscan,
	motion,
	opacity = 1,
	opacityFn
}: GradientLayerProps) {
	const scale = overscan ?? overscanFor(width, height, motion);
	const w = width * scale;
	const h = height * scale;
	const translate = motion?.translate;
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

interface SvgLayerProps {
	x: SharedValue<number>;
	y: SharedValue<number>;
	width: number;
	height: number;
	blend?: ViewStyle['mixBlendMode'];
	overscan?: number;
	motion?: LayerMotion;
	opacity?: number;
	opacityFn?: OpacityFn;
	render: (w: number, h: number) => ReactNode;
}

/** Same as GradientLayer, for SVG textures standing in for raster foil sheets. */
export function SvgLayer({
	x,
	y,
	width,
	height,
	blend,
	overscan,
	motion,
	opacity = 1,
	opacityFn,
	render
}: SvgLayerProps) {
	const scale = overscan ?? overscanFor(width, height, motion);
	const w = width * scale;
	const h = height * scale;
	const translate = motion?.translate;
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
					mixBlendMode: blend
				},
				style
			]}
		>
			{render(w, h)}
		</Animated.View>
	);
}

export function DotSpecks({
	seed,
	kind,
	width,
	height,
	count
}: {
	seed: number;
	kind: 'glitter' | 'stars';
	width: number;
	height: number;
	count: number;
}) {
	const specks = useMemo<Speck[]>(
		() => (kind === 'glitter' ? glitterField(seed, count) : starField(seed, count)),
		[seed, kind, count]
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

/**
 * A small deterministic grain tile repeated across the whole foil sheet.
 * Repetition is intentional: dense commercial foil has a manufactured texture,
 * unlike the sparse one-off confetti field used by the original experiment.
 */
export function TiledFoilGrain({
	seed,
	width,
	height,
	tileSize,
	density = 32,
	facetGroup,
	rotation = 0
}: {
	seed: number;
	width: number;
	height: number;
	tileSize: number;
	density?: number;
	/** Optional subset of the same grain, for independently lit facet orientations. */
	facetGroup?: number;
	/** Rotate the repeating lattice, not the card or its light response. */
	rotation?: number;
}) {
	const specks = useMemo(() => glitterField(seed, density), [seed, density]);
	const patternId = `foil-grain-${seed.toString(16)}-${facetGroup ?? 'base'}`;

	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill}>
			<Defs>
				<Pattern
					id={patternId}
					patternUnits="userSpaceOnUse"
					width={tileSize}
					height={tileSize}
					patternTransform={`rotate(${rotation})`}
				>
					{specks.map(
						(s, i) =>
							(facetGroup == null || i % 4 === facetGroup) && (
								<Circle
									key={i}
									cx={s.x * tileSize}
									cy={s.y * tileSize}
									r={Math.max(0.28, s.r * tileSize * 0.42)}
									fill={
										facetGroup == null
											? i % 5 === 0
												? '#17161b'
												: '#ffffff'
											: ['#fff0da', '#d9fffa', '#e9deff', '#ffe0ef'][facetGroup]
									}
									opacity={
										facetGroup == null
											? i % 5 === 0
												? 0.16 + s.opacity * 0.18
												: 0.18 + s.opacity * 0.64
											: 0.65 + s.opacity * 0.35
									}
								/>
							)
					)}
				</Pattern>
			</Defs>
			<Rect width={width} height={height} fill={`url(#${patternId})`} />
		</Svg>
	);
}

/** A lightly repeated, jittered star tile keeps catches spread across a filled card. */
export function CosmicSparkles({
	seed,
	width,
	height,
	count = 6,
	facetGroup
}: {
	seed: number;
	width: number;
	height: number;
	count?: number;
	facetGroup?: number;
}) {
	const specks = useMemo(() => starField(seed, count), [seed, count]);
	const tileWidth = width * 0.5;
	const tileHeight = height * 0.38;
	const patternId = `cosmic-stars-${seed.toString(16)}-${facetGroup ?? 'base'}`;
	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill}>
			<Defs>
				<Pattern id={patternId} patternUnits="userSpaceOnUse" width={tileWidth} height={tileHeight}>
					{specks.map((s, i) => {
						if (facetGroup != null && i % 4 !== facetGroup) return null;
						// One star per cell, with seeded jitter and enough inset to avoid tile seams.
						const cx = (((i % 3) + 0.25 + s.x * 0.5) * tileWidth) / 3;
						const cy = ((Math.floor(i / 3) + 0.25 + s.y * 0.5) * tileHeight) / Math.ceil(count / 3);
						const r = width * (0.005 + s.opacity * 0.005);
						const strokeWidth = Math.max(0.25, width * 0.0007);
						return (
							<Polygon
								key={i}
								points={`${cx},${cy - r * 1.8} ${cx + r * 0.42},${cy - r * 0.42} ${cx + r * 1.8},${cy} ${cx + r * 0.42},${cy + r * 0.42} ${cx},${cy + r * 1.8} ${cx - r * 0.42},${cy + r * 0.42} ${cx - r * 1.8},${cy} ${cx - r * 0.42},${cy - r * 0.42}`}
								fill={
									facetGroup == null
										? '#ffffff'
										: ['#fff0da', '#d9fffa', '#e9deff', '#ffe0ef'][facetGroup]
								}
								opacity={facetGroup == null ? s.opacity : s.opacity * 0.65}
								stroke="rgba(23,22,27,0.24)"
								strokeWidth={strokeWidth}
							/>
						);
					})}
				</Pattern>
			</Defs>
			<Rect width={width} height={height} fill={`url(#${patternId})`} />
		</Svg>
	);
}

/** Fixed-size barcode periods: overscan adds repeats instead of stretching the bars. */
export function HoloBarcodeTexture({
	seed,
	width,
	height,
	period
}: {
	seed: number;
	width: number;
	height: number;
	period: number;
}) {
	const patternId = `holo-barcode-${seed.toString(16)}`;
	const gradientId = `${patternId}-ramp`;
	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill}>
			<Defs>
				<LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
					<Stop offset="0%" stopColor="#000000" />
					<Stop offset="50%" stopColor="#b3b3b3" />
					<Stop offset="100%" stopColor="#000000" />
				</LinearGradient>
				<Pattern
					id={patternId}
					patternUnits="userSpaceOnUse"
					width={period}
					height={period}
					patternTransform="rotate(2)"
				>
					<Rect width={period} height={period} fill={`url(#${gradientId})`} />
				</Pattern>
			</Defs>
			<Rect width={width} height={height} fill={`url(#${patternId})`} />
		</Svg>
	);
}

/** Fine manufactured rainbow lines for true holo, including web fallback. */
export function LinearHoloTexture({
	seed,
	width,
	height,
	lineSize
}: {
	seed: number;
	width: number;
	height: number;
	lineSize: number;
}) {
	const patternId = `linear-holo-${seed.toString(16)}`;
	const colors = ['#d72ee8', '#28bde8', '#36d69b', '#e8d438', '#ef4d68', '#8e57dc'];
	const gradientId = `${patternId}-spectrum`;
	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill}>
			<Defs>
				<LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
					{[...colors, colors[0]].map((color, i) => (
						<Stop key={i} offset={`${(i / colors.length) * 100}%`} stopColor={color} />
					))}
				</LinearGradient>
				<Pattern
					id={patternId}
					patternUnits="userSpaceOnUse"
					width={lineSize}
					height={lineSize}
					patternTransform="rotate(-8)"
				>
					<Rect width={lineSize} height={lineSize} fill={`url(#${gradientId})`} opacity={0.65} />
				</Pattern>
			</Defs>
			<Rect width={width} height={height} fill={`url(#${patternId})`} />
		</Svg>
	);
}

export function CrackleLines({
	seed,
	width,
	height
}: {
	seed: number;
	width: number;
	height: number;
}) {
	const lines = useMemo(() => crackleField(seed, 11), [seed]);
	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill}>
			{lines.map((l, i) => (
				<Polyline
					key={i}
					points={l.points.map((p) => `${p.x * width},${p.y * height}`).join(' ')}
					stroke="#ffffff"
					strokeWidth={l.strokeWidth * width}
					fill="none"
					opacity={l.opacity}
				/>
			))}
		</Svg>
	);
}

/** Lit top lip / shadowed bottom — thickness cue shared by both engines. */
export function EdgeLip({ width, radius }: { width: number; radius: number }) {
	return (
		<View
			pointerEvents="none"
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
}
