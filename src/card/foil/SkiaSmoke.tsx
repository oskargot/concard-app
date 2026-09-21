/**
 * Stage C0 smoke: proof that a Skia canvas draws on a card-sized surface and
 * that its light answers the same `rx`/`ry` tilt every other engine in this
 * folder reads. It is deliberately *not* a foil — no per-tier recipe, no pinned
 * textures — just one holo radial and a specular core that slide opposite the
 * tilt, so a glance tells you Skia is linked and reanimated is driving it on the
 * UI thread. The real Skia foil is Stage C1.
 *
 * This module imports `@shopify/react-native-skia`, which only resolves in a
 * development build. Nothing here is imported at app start — the `/dev/skia-smoke`
 * route requires it lazily and shows a fallback in Expo Go (see that route).
 */

import {
	Canvas,
	Group,
	RadialGradient,
	RoundedRect,
	rect,
	rrect,
	vec
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { TILT_RANGE } from '../FlipCard';

/** Hex mirror of `gradients.ts`' HOLO_SPECTRUM — Skia parses hex most reliably. */
const HOLO = ['#FF7773', '#FFED5F', '#A8FF5F', '#83FFF7', '#7894FF', '#D875FF'];

export interface SkiaSmokeProps {
	width: number;
	height: number;
	/** Card tilt, owned by FlipCard — the same signal the foil engines read. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	/** Corner radius of the surface, so the canvas reads as a card face. */
	radius?: number;
}

export function SkiaSmoke({ width, height, rx, ry, radius = width * 0.06 }: SkiaSmokeProps) {
	// The light sits opposite the tilt — drag right, it slides left — matching
	// the convention in Foil.tsx / FoilPokemon. This is the whole point of the
	// smoke: only light moves, and it moves on the UI thread.
	const holoCenter = useDerivedValue(() =>
		vec(
			width * (0.5 - (ry.value / TILT_RANGE) * 0.4),
			height * (0.5 + (rx.value / TILT_RANGE) * 0.4)
		)
	);
	const specCenter = useDerivedValue(() =>
		vec(
			width * (0.5 - (ry.value / TILT_RANGE) * 0.28),
			height * (0.35 + (rx.value / TILT_RANGE) * 0.28)
		)
	);

	const surface = rrect(rect(0, 0, width, height), radius, radius);

	return (
		<Canvas style={{ width, height }}>
			{/* Base plate so the blended light has something to sit on. */}
			<RoundedRect rect={surface} color="#141019" />

			{/* The holo sweep — the "colour moves with tilt" cue. */}
			<Group>
				<RoundedRect rect={surface}>
					<RadialGradient c={holoCenter} r={width * 0.95} colors={HOLO} />
				</RoundedRect>
			</Group>

			{/* A specular core over the top, screened so it only ever brightens. */}
			<Group blendMode="screen">
				<RoundedRect rect={surface}>
					<RadialGradient
						c={specCenter}
						r={width * 0.6}
						colors={['#FFFFFF', 'rgba(255,255,255,0)']}
					/>
				</RoundedRect>
			</Group>

			{/* A faint lit lip so the flat plate reads as a card with an edge. */}
			<RoundedRect rect={surface} style="stroke" strokeWidth={width * 0.008} color="#FFFFFF59" />
		</Canvas>
	);
}
