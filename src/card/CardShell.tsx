/**
 * The card's physical shell: the metal frame band, the inset face, and the foil
 * stack over it. Ported from the web app's `CardShell.svelte`, including its
 * geometry — the two renderers have to agree or a card would look different on
 * concard.me than in the app.
 *
 * The web version sizes everything in `cqw` (1% of its own width) via container
 * queries. React Native has none, so the shell takes a `width` and every
 * dimension is derived from it. `u(n)` here is exactly `n cqw` there.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { BGS, FRAMES, type CardStyle } from './card-style';
import { TILT_RANGE } from './FlipCard';
import { CARD_ASPECT } from '../theme/tokens';
import { Foil } from './foil/Foil';
import type { FoilEngine, FoilLayerName, FoilOverride, SamplerFoilOptions } from './foil/Foil';
import type { FoilRecipeId } from './foil/recipes';
import type { FoilKind } from './tiers';

export interface CardShellProps {
	style: CardStyle;
	/** Card width in px. Height follows from the 5:7 ratio. */
	width: number;
	/** Override the face colour. The card back is always drawn in ink. */
	faceColor?: string;
	/** Which foil to draw over the face. Omit for a face with no light at all. */
	foil?: FoilKind;
	/** Seeds the foil's deterministic fields — pass the card id. */
	seed?: string;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	intensity?: number;
	foilOverrides?: Partial<Record<FoilLayerName, FoilOverride>>;
	foilSampler?: SamplerFoilOptions;
	detail?: 'full' | 'thumb';
	/** `v2` = shine+glare experiment. Production leaves unset (legacy). */
	foilEngine?: FoilEngine;
	/** Foil-lab: force a specific v2 recipe regardless of `foil` kind. */
	foilRecipe?: FoilRecipeId;
	/**
	 * Draw a soft circular light over the face — bright at the centre, faint at
	 * its edges. Opt-in so a collected card's frozen snapshot stays pixel-identical
	 * to the web card; used on the home hero card, which is app chrome, not data.
	 */
	light?: boolean;
	children?: ReactNode;
	/** Drawn outside the face clip, so stickers can hang over the card edge. */
	overlay?: ReactNode;
}

/** The shell's derived geometry, shared with anything drawing onto the face. */
export interface ShellMetrics {
	width: number;
	height: number;
	band: number;
	outerRadius: number;
	faceRadius: number;
	/** `n cqw` — 1% of the card's width. */
	u: (n: number) => number;
}

export function shellMetrics(width: number, shape: CardStyle['shape']): ShellMetrics {
	const u = (n: number) => (width * n) / 100;
	const height = width / CARD_ASPECT;
	const band = Math.max(u(1.67), 3);
	// rect and shaved both sit nearly square-cornered; shaved then cuts its corners
	const outerRadius = shape === 'rounded' ? u(8.67) : u(1);
	return { width, height, band, outerRadius, faceRadius: outerRadius - band, u };
}

/**
 * A soft round light on the face: brightest at the centre, fading to nothing by
 * ~68% out. `circle` (not `ellipse`) keeps it round on the 5:7 face instead of
 * stretching to the box, so the edges stay faint and even all the way around.
 * Centred at rest — it slides off centre as the card tilts (see `lightShift`).
 */
const FACE_LIGHT =
	'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.14) 34%, transparent 68%)';

export function CardShell({
	style,
	width,
	faceColor,
	foil,
	seed = 'card',
	rx,
	ry,
	intensity = 1,
	foilOverrides,
	foilSampler,
	detail = 'full',
	foilEngine,
	foilRecipe,
	light,
	children,
	overlay
}: CardShellProps) {
	const m = shellMetrics(width, style.shape);
	const shaved = style.shape === 'shaved';
	const foilKind = style.frame === 'holo' && foil === 'none' ? 'holo' : foil;

	// The light glides opposite the drag, like a fixed source reflecting off a
	// card you tilt: drag right and it slides left, drag down and it slides up.
	// This deliberately departs from the foil's frozen-parallax rule (see
	// FlipCard) — here the moving light *is* the point. The layer is oversized by
	// its own max travel so it always covers the face as it slides.
	const lightTravel = m.u(12);
	const lightShift = useAnimatedStyle(() => ({
		transform: [
			{ translateX: -(ry.value / TILT_RANGE) * lightTravel },
			{ translateY: (rx.value / TILT_RANGE) * lightTravel }
		]
	}));

	const band = (
		<View
			style={[
				styles.band,
				{
					borderRadius: m.outerRadius,
					experimental_backgroundImage: FRAMES[style.frame]
				},
				// A clipped shell cannot also cast a box-shadow — the shadow would be
				// clipped with it — so the shaved variant gets a drop-shadow filter
				// on the mask instead, exactly as the web card does.
				!shaved && {
					boxShadow: `0 ${m.u(4.67)}px ${m.u(10)}px rgba(23,22,27,0.24), 0 0 0 0.75px rgba(23,22,27,0.35)`
				}
			]}
		>
			<View
				style={[
					styles.face,
					{
						top: m.band,
						left: m.band,
						right: m.band,
						bottom: m.band,
						borderRadius: m.faceRadius,
						backgroundColor: faceColor ?? BGS[style.bg]
					}
				]}
			>
				{/* content sits under the light, so the foil plays over the face */}
				<View style={StyleSheet.absoluteFill}>{children}</View>
				{light ? (
					<Animated.View
						pointerEvents="none"
						style={[
							{
								position: 'absolute',
								top: -lightTravel,
								bottom: -lightTravel,
								left: -lightTravel,
								right: -lightTravel,
								experimental_backgroundImage: FACE_LIGHT
							} as ViewStyle,
							lightShift
						]}
					/>
				) : null}
				{foilKind ? (
					<Foil
						kind={foilKind}
						width={m.width - m.band * 2}
						height={m.height - m.band * 2}
						radius={m.faceRadius}
						rx={rx}
						ry={ry}
						seed={seed}
						intensity={intensity}
						overrides={foilOverrides}
						samplerOptions={foilSampler}
						detail={detail}
						engine={foilEngine}
						recipe={foilRecipe}
					/>
				) : null}
			</View>
		</View>
	);

	return (
		<View style={{ width: m.width, height: m.height }}>
			{shaved ? (
				<View
					style={{
						width: m.width,
						height: m.height,
						filter: [{ dropShadow: `0 ${m.u(4.67)}px ${m.u(6)}px rgba(23,22,27,0.24)` }]
					}}
				>
					<MaskedView
						style={{ width: m.width, height: m.height }}
						maskElement={<Octagon width={m.width} height={m.height} cut={m.u(10)} />}
					>
						{band}
					</MaskedView>
				</View>
			) : (
				band
			)}
			{overlay ? (
				<View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
					{overlay}
				</View>
			) : null}
		</View>
	);
}

/** The shaved silhouette: a rectangle with its four corners cut at 45°. */
function Octagon({ width, height, cut }: { width: number; height: number; cut: number }) {
	const points = [
		[cut, 0],
		[width - cut, 0],
		[width, cut],
		[width, height - cut],
		[width - cut, height],
		[cut, height],
		[0, height - cut],
		[0, cut]
	]
		.map(([x, y]) => `${x},${y}`)
		.join(' ');
	return (
		<Svg width={width} height={height}>
			<Polygon points={points} fill="#000" />
		</Svg>
	);
}

const styles = StyleSheet.create({
	band: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0
	},
	face: {
		position: 'absolute',
		overflow: 'hidden'
	},
	overlay: {
		zIndex: 6
	}
} as Record<string, ViewStyle>);
