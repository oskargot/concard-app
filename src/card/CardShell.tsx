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
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { BGS, FRAMES, type CardStyle } from './card-style';
import { CARD_ASPECT } from '../theme/tokens';
import { Foil } from './foil/Foil';
import type { FoilLayerName, FoilOverride } from './foil/Foil';
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
	detail?: 'full' | 'thumb';
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
	detail = 'full',
	children,
	overlay
}: CardShellProps) {
	const m = shellMetrics(width, style.shape);
	const shaved = style.shape === 'shaved';

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
				{foil ? (
					<Foil
						kind={foil}
						width={m.width - m.band * 2}
						height={m.height - m.band * 2}
						radius={m.faceRadius}
						rx={rx}
						ry={ry}
						seed={seed}
						intensity={intensity}
						overrides={foilOverrides}
						detail={detail}
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
