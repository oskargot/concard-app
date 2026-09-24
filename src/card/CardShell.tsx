/**
 * The card's physical shell: the edge band, the inset face, and the foil stack
 * over it. Identical front and back (card spec §2).
 *
 * The card is designed once in a 250 × 350 unit space and drawn at any size by
 * multiplying every unit by `width / 250`. `u(n)` is that conversion. It is
 * applied to each dimension rather than as one `scale` transform on a
 * 250-wide view so that text is laid out at its real pixel size: a scaled-up
 * bitmap of 22-unit text would be soft on the hero card on iOS. The layout is
 * identical either way, because every number scales by the same factor.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { BGS, FRAMES, type CardStyle } from './card-style';
import { TILT_RANGE } from './FlipCard';
import { Foil } from './foil/Foil';
import { CARD_H, CARD_W, FRAME } from './layout/spec';
import type { FoilKind } from './tiers';

export interface CardShellProps {
	style: CardStyle;
	/** Card width in px. Height follows from the 250:350 design space. */
	width: number;
	/** Override the face colour. The card back is always graphite. */
	faceColor?: string;
	/** Override the edge gradient: the offline placeholder back's neutral edge. */
	edge?: string;
	/** Which foil to draw over the face. Omit for a face with no light at all. */
	foil?: FoilKind;
	/** Reserved for per-card foil patterns — pass the card id. See `Foil`. */
	seed?: string;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	intensity?: number;
	detail?: 'full' | 'thumb';
	/**
	 * Draw a soft circular light over the face — bright at the centre, faint at
	 * its edges. Opt-in so a collected card's frozen snapshot stays pixel-identical
	 * to the web card; used on the home hero card, which is app chrome, not data.
	 */
	light?: boolean;
	children?: ReactNode;
	/** Drawn outside the face clip: stickers, and the editor's divider handle. */
	overlay?: ReactNode;
}

/** The shell's derived geometry, shared with anything drawing onto the card. */
export interface ShellMetrics {
	width: number;
	height: number;
	/** px per design unit. */
	scale: number;
	band: number;
	outerRadius: number;
	faceRadius: number;
	/** Design units → px. */
	u: (n: number) => number;
}

export function shellMetrics(width: number): ShellMetrics {
	const scale = width / CARD_W;
	const u = (n: number) => n * scale;
	return {
		width,
		height: u(CARD_H),
		scale,
		band: u(FRAME.edge),
		outerRadius: u(FRAME.radius),
		faceRadius: u(FRAME.faceRadius),
		u
	};
}

/**
 * A soft round light on the face: brightest at the centre, fading to nothing by
 * ~52% out. `circle` (not `ellipse`) keeps it round on the face instead of
 * stretching to the box, so the edges stay faint and even all the way around.
 * Biased up to 30% so its core sits over the photo rather than over the bio
 * below it; it slides off this rest position as the card tilts (see `lightShift`).
 */
const FACE_LIGHT =
	'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.2) 26%, transparent 52%)';

export function CardShell({
	style,
	width,
	faceColor,
	edge,
	foil,
	seed,
	rx,
	ry,
	intensity = 1,
	detail = 'full',
	light,
	children,
	overlay
}: CardShellProps) {
	const m = shellMetrics(width);
	const foilKind = style.frame === 'holo' && foil === 'none' ? 'holo' : foil;

	// The light glides opposite the drag, like a fixed source reflecting off a
	// card you tilt: drag right and it slides left, drag down and it slides up.
	// As the face-sized layer slides, the edge it leaves bare is already in the
	// gradient's transparent tail, so no seam shows.
	const lightTravel = m.u(50);
	const lightShift = useAnimatedStyle(() => ({
		transform: [
			{ translateX: -(ry.value / TILT_RANGE) * lightTravel },
			{ translateY: (rx.value / TILT_RANGE) * lightTravel }
		]
	}));

	return (
		<View style={{ width: m.width, height: m.height }}>
			<View
				style={[
					styles.band,
					{
						borderRadius: m.outerRadius,
						experimental_backgroundImage: edge ?? FRAMES[style.frame],
						boxShadow: `0 ${m.u(11.7)}px ${m.u(25)}px rgba(23,22,27,0.24), 0 0 0 0.75px rgba(23,22,27,0.35)`
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
					{/* content first; the foil stack and the light play over it */}
					<View style={StyleSheet.absoluteFill}>{children}</View>
					{light ? (
						<Animated.View
							pointerEvents="none"
							style={[
								StyleSheet.absoluteFill,
								{
									// Above the photo, which lifts itself onto its own layer for
									// flip stability (zIndex/elevation in CardFace).
									zIndex: 4,
									elevation: 4,
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
							detail={detail}
						/>
					) : null}
				</View>
			</View>
			{overlay ? (
				<View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
					{overlay}
				</View>
			) : null}
		</View>
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
		// Stickers sit above everything on the face, tier foil included (spec §7).
		zIndex: 7,
		elevation: 7
	}
} as Record<string, ViewStyle>);
