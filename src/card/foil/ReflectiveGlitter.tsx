/**
 * Fixed, non-repeating microfacets illuminated by a moving specular field.
 * Inspired by the reference's fixed glitter + moving light composition. Each
 * orientation has its own narrow reflection lobe, so neighbouring flakes catch
 * at different angles. Only gradient centres animate; geometry stays cached.
 */
import { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import type { FoilLight } from './layers';
import { glitterField } from './speckle';

const AnimatedRadialGradient = Animated.createAnimatedComponent(RadialGradient);
const ORIENTATIONS = 24;
const COLORS = ['#fff3d9', '#d9fff6', '#e5deff', '#ffe0ed'];

interface FacetBatch {
	d: string;
	dx: number;
	dy: number;
	roughness: number;
}

function makeFacets(seed: number, width: number, height: number): FacetBatch[] {
	// Scale the work down for stickers/thumbnails, with a bounded hero budget.
	const count = Math.max(80, Math.min(2400, Math.round((width * height) / 55)));
	const normals = glitterField(seed ^ 0x5f3759df, ORIENTATIONS);
	const batches = normals.map((n) => ({
		d: '',
		dx: (n.x - 0.5) * 0.7,
		dy: (n.y - 0.5) * 0.7,
		roughness: 0.12 + n.opacity * 0.12
	}));
	const scale = Math.min(1, width / 300);
	for (const [i, s] of glitterField(seed, count).entries()) {
		const cx = s.x * width;
		const cy = s.y * height;
		// Mostly subpixel flakes, with occasional larger facets. No repeated tile.
		const r = (0.28 + Math.pow(s.opacity, 4) * 0.85) * scale;
		const skew = 0.4 + s.r * 50;
		batches[i % ORIENTATIONS].d +=
			`M${cx.toFixed(2)},${(cy - r).toFixed(2)}` +
			`l${(r * skew).toFixed(2)},${r.toFixed(2)}` +
			`l${(-r * skew).toFixed(2)},${(r * 0.7).toFixed(2)}` +
			`l${(-r * skew).toFixed(2)},${(-r * 0.7).toFixed(2)}Z`;
	}
	return batches;
}

function FacetLight({
	x,
	y,
	width,
	height,
	batch,
	id,
	color
}: FoilLight & { batch: FacetBatch; id: string; color: string }) {
	const { dx, dy, roughness } = batch;
	const animatedProps = useAnimatedProps(() => {
		// Same light travel as the existing glitter glare (±30% of the face).
		const cx = width * (0.5 + ((x.value - 50) / 50) * 0.3 + dx);
		const cy = height * (0.5 + ((y.value - 50) / 50) * 0.3 + dy);
		return { cx, cy, fx: cx, fy: cy };
	});
	return (
		<AnimatedRadialGradient
			id={id}
			gradientUnits="userSpaceOnUse"
			cx={width * (0.5 + dx)}
			cy={height * (0.5 + dy)}
			rx={width * roughness}
			ry={height * roughness}
			animatedProps={animatedProps}
		>
			<Stop offset="0" stopColor="#ffffff" stopOpacity={1} />
			<Stop offset="0.12" stopColor="#ffffff" stopOpacity={0.95} />
			<Stop offset="0.32" stopColor={color} stopOpacity={0.6} />
			<Stop offset="0.6" stopColor={color} stopOpacity={0.12} />
			<Stop offset="1" stopColor={color} stopOpacity={0} />
		</AnimatedRadialGradient>
	);
}

export function ReflectiveGlitter(light: FoilLight & { seed: number }) {
	const { width, height, seed } = light;
	// useId prevents collisions when the same card appears twice on web.
	const id = `glitter-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
	const batches = useMemo(() => makeFacets(seed, width, height), [seed, width, height]);
	return (
		<View pointerEvents="none" style={[StyleSheet.absoluteFill, { mixBlendMode: 'screen' }]}>
			<Svg width={width} height={height}>
				<Defs>
					{batches.map((batch, i) => (
						<FacetLight
							key={i}
							{...light}
							batch={batch}
							id={`${id}-${i}`}
							color={COLORS[i % COLORS.length]}
						/>
					))}
				</Defs>
				{batches.map((batch, i) => (
					<Path key={i} d={batch.d} fill={`url(#${id}-${i})`} />
				))}
			</Svg>
		</View>
	);
}
