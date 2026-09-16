/** Fixed material geometry; only the reflected light moves. No repeating tiles. */
import { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, {
	Defs,
	G,
	LinearGradient,
	Mask,
	Path,
	RadialGradient,
	Rect,
	Stop
} from 'react-native-svg';

import type { FoilLight } from './layers';
import { facetField, glitterField, starField } from './speckle';

const MovingRadial = Animated.createAnimatedComponent(RadialGradient);
const MovingLinear = Animated.createAnimatedComponent(LinearGradient);
type Material = 'cosmic' | 'crosshatch' | 'ice';
type Props = FoilLight & { seed: number };
interface Batch {
	d: string;
	dx: number;
	dy: number;
	spread: number;
}

/** A reflection lobe for one surface orientation. Transparent away from light. */
function MaterialLight({
	x,
	y,
	width,
	height,
	id,
	dx = 0,
	dy = 0,
	spread = 0.3,
	color = '#e2f3ff'
}: FoilLight & { id: string; dx?: number; dy?: number; spread?: number; color?: string }) {
	const animatedProps = useAnimatedProps(() => {
		const cx = width * (0.5 + (x.value - 50) * 0.006 + dx);
		const cy = height * (0.5 + (y.value - 50) * 0.006 + dy);
		return { cx, cy, fx: cx, fy: cy };
	});
	return (
		<MovingRadial
			id={id}
			gradientUnits="userSpaceOnUse"
			cx={width * (0.5 + dx)}
			cy={height * (0.5 + dy)}
			rx={width * spread}
			ry={height * spread}
			animatedProps={animatedProps}
		>
			<Stop offset="0" stopColor="#ffffff" stopOpacity={1} />
			<Stop offset="0.18" stopColor={color} stopOpacity={0.85} />
			<Stop offset="0.5" stopColor={color} stopOpacity={0.25} />
			<Stop offset="1" stopColor={color} stopOpacity={0} />
		</MovingRadial>
	);
}

function polygon(points: { x: number; y: number }[]) {
	return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('') + 'Z';
}

function materialGeometry(kind: Material, seed: number, width: number, height: number): Batch[] {
	const normals = glitterField(seed ^ 0x7f4a7c15, kind === 'crosshatch' ? 2 : 16);
	const batches = normals.map((n) => ({
		d: '',
		dx: (n.x - 0.5) * 0.6,
		dy: (n.y - 0.5) * 0.6,
		spread: kind === 'cosmic' ? 0.16 + n.opacity * 0.12 : 0.26 + n.opacity * 0.12
	}));
	if (kind === 'crosshatch') {
		// Fixed physical spacing; ±45° directions catch on opposite sides of the light.
		const spacing = Math.max(3, width * 0.027);
		for (let i = 0; i < 2; i++) {
			const sign = i === 0 ? 1 : -1;
			batches[i].dx = sign * 0.12;
			batches[i].dy = -sign * 0.08;
			for (let start = -height; start <= width + height; start += spacing) {
				batches[i].d += `M${start.toFixed(2)},0l${sign * height},${height}`;
			}
		}
	} else if (kind === 'ice') {
		// Shared vertices make connected facets rather than unrelated zigzag strokes.
		const cols = width < 120 ? 5 : 9;
		const rows = Math.max(4, Math.round((cols * height) / width));
		for (const [i, facet] of facetField(seed, cols, rows).entries()) {
			batches[i % batches.length].d += polygon(
				facet.points.map((p) => ({
					x: p.x * width,
					y: p.y * height
				}))
			);
		}
	} else {
		const count = Math.max(18, Math.min(220, Math.round((width * height) / 650)));
		for (const [i, s] of starField(seed, count).entries()) {
			const cx = s.x * width;
			const cy = s.y * height;
			const r = width * (0.0018 + Math.pow(s.opacity, 3) * 0.007);
			let d: string;
			if (i % 13 === 0) {
				// Occasional starburst; most particles are compact foil fragments.
				d = polygon(
					Array.from({ length: 8 }, (_, j) => {
						const a = (j * Math.PI) / 4;
						const radius = r * (j % 2 ? 0.32 : 1.7);
						return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
					})
				);
			} else if (i % 3 === 0) {
				d = `M${cx - r},${cy}a${r},${r} 0 1 0 ${r * 2},0a${r},${r} 0 1 0 ${-r * 2},0Z`;
			} else {
				d = polygon([
					{ x: cx - r, y: cy - r * 0.3 },
					{ x: cx + r * 0.4, y: cy - r },
					{ x: cx + r, y: cy + r * 0.6 },
					{ x: cx - r * 0.6, y: cy + r }
				]);
			}
			batches[i % batches.length].d += d;
		}
	}
	return batches;
}

/** Cosmic fragments, etched lattice, and fractured film share one light model. */
export function ReflectiveMaterial({ kind, ...light }: Props & { kind: Material }) {
	const { width, height, seed } = light;
	const id = `material-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
	const batches = useMemo(
		() => materialGeometry(kind, seed, width, height),
		[kind, seed, width, height]
	);
	return (
		<View pointerEvents="none" style={[StyleSheet.absoluteFill, { mixBlendMode: 'screen' }]}>
			<Svg width={width} height={height}>
				<Defs>
					{batches.map((b, i) => (
						<MaterialLight
							key={i}
							{...light}
							{...b}
							id={`${id}-${i}`}
							color={
								kind === 'ice' ? '#cdeafa' : ['#ffebce', '#c9fff0', '#e4d4ff', '#ffd7ec'][i % 4]
							}
						/>
					))}
				</Defs>
				{batches.map((b, i) => (
					<Path
						key={i}
						d={b.d}
						fill={kind === 'crosshatch' ? 'none' : `url(#${id}-${i})`}
						fillOpacity={kind === 'ice' ? 0.2 : 0.95}
						stroke={kind === 'cosmic' ? 'none' : `url(#${id}-${i})`}
						strokeOpacity={kind === 'ice' ? 0.3 : 0.6}
						strokeWidth={Math.max(0.25, width * 0.0013)}
					/>
				))}
			</Svg>
		</View>
	);
}

/** One broad spectral reflection, modulated by fixed fine grooves. */
export function ReflectiveHolo(light: Props) {
	const { x, y, width, height } = light;
	const id = `holo-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
	const grooves = useMemo(() => {
		let d = '';
		const spacing = Math.max(1.2, width * 0.005);
		for (let px = -height * 0.08; px <= width; px += spacing) {
			d += `M${px.toFixed(2)},0l${height * 0.08},${height}`;
		}
		return d;
	}, [width, height]);
	const animatedProps = useAnimatedProps(() => {
		const cx = width * (0.5 + (x.value - 50) * 0.006);
		const cy = height * (0.5 + (y.value - 50) * 0.006);
		return {
			x1: cx - width * 0.38,
			y1: cy - height * 0.12,
			x2: cx + width * 0.38,
			y2: cy + height * 0.12
		};
	});
	return (
		<View pointerEvents="none" style={[StyleSheet.absoluteFill, { mixBlendMode: 'screen' }]}>
			<Svg width={width} height={height}>
				<Defs>
					<MaterialLight {...light} id={`${id}-light`} spread={0.65} color="#ffffff" />
					<MovingLinear
						id={`${id}-spectrum`}
						gradientUnits="userSpaceOnUse"
						x1={width * 0.12}
						y1={height * 0.38}
						x2={width * 0.88}
						y2={height * 0.62}
						animatedProps={animatedProps}
					>
						{['#be8bff', '#689fff', '#5fd9ed', '#98ecb0', '#ffe394', '#ff9ebc', '#be8bff'].map(
							(c, i) => (
								<Stop
									key={c + i}
									offset={i / 6}
									stopColor={c}
									stopOpacity={i === 0 || i === 6 ? 0 : 0.65}
								/>
							)
						)}
					</MovingLinear>
					<Mask
						id={`${id}-mask`}
						x={0}
						y={0}
						width={width}
						height={height}
						maskUnits="userSpaceOnUse"
						maskType="alpha"
					>
						<Rect width={width} height={height} fill={`url(#${id}-light)`} />
					</Mask>
				</Defs>
				<G mask={`url(#${id}-mask)`}>
					<Rect width={width} height={height} fill={`url(#${id}-spectrum)`} opacity={0.45} />
					<Path
						d={grooves}
						fill="none"
						stroke={`url(#${id}-spectrum)`}
						strokeWidth={Math.max(0.25, width * 0.001)}
						opacity={0.5}
					/>
				</G>
			</Svg>
		</View>
	);
}
