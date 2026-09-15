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
import Svg, { Circle, Polyline } from 'react-native-svg';

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
	render
}: SvgLayerProps) {
	const scale = overscan ?? overscanFor(width, height, motion);
	const w = width * scale;
	const h = height * scale;
	const translate = motion?.translate;
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
