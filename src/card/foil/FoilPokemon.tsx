/**
 * Foil engine "pokemon" — the simeydotme/pokemon-cards-css structure itself,
 * ported layer-for-layer rather than reinterpreted:
 *
 *   1. The card face is the base (drawn by `CardFace`, below this component).
 *   2. `.card__shine` — one (or a few, for rarity accents) oversized
 *      background-image layer(s), `mix-blend-mode: color-dodge`. This is the
 *      layer that actually makes the rainbow read as *light on foil* rather
 *      than a printed sticker — the one blend mode this file will never skip.
 *   3. `.card__glare` — a single radial gradient that tracks the pointer
 *      directly, `mix-blend-mode: overlay`, fading in as the pointer moves
 *      off-centre (`--card-opacity` in the original).
 *   4. Pointer state: the original computes `--pointer-x/y` (0–100%),
 *      `--rotate-x/y` and `--background-x/y` (the pointer position amplified,
 *      since foil should sweep farther than the tilt that drives it) from one
 *      pointermove handler. Here `rx`/`ry` (FlipCard's tilt, already the
 *      card's rotate-x/y) stand in for the pointer — light sits opposite the
 *      tilt, matching every other engine in this folder — and this file
 *      derives `pointerX/Y` and the amplified `backgroundX/Y` from that same
 *      pair, so nothing here reads a second, independent pointer signal.
 *   5. Where the CSS original animates `background-position` on an oversized
 *      (200–400%) `background-image`, this translates an oversized layer by
 *      transform instead — same reasoning as the rest of `foil/`: a transform
 *      runs on the UI thread, a restyled gradient does not.
 *   6. Per-rarity stacks live in `pokemon-recipes.tsx`; this file only knows
 *      how to draw *a* stack, not what any particular rarity looks like.
 *
 * Card art is unaffected by design: `CardFace` sits under this overlay and
 * this component only ever draws inside the face's own clip (the caller
 * gives it the face's `radius`), so there's no separate art-window mask to
 * carry here the way the CSS original sometimes needs one.
 */

import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useDerivedValue,
	type SharedValue
} from 'react-native-reanimated';

import type { FoilKind } from '../tiers';
import { EdgeLip, pfcOpacity } from './layers';
import { GLARE_GRADIENT, POKEMON_RECIPES, type ShineLayerDef } from './pokemon-recipes';
import { hashSeed } from './speckle';

/** Matches FlipCard's tilt clamp — pointer maps across the same range. */
const TILT_RANGE = 16;

export interface FoilPokemonProps {
	kind: FoilKind;
	width: number;
	height: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	seed: string;
	radius?: number;
	intensity?: number;
}

export function FoilPokemon({
	kind,
	width,
	height,
	rx,
	ry,
	seed,
	radius = 0,
	intensity = 1
}: FoilPokemonProps) {
	const recipe = POKEMON_RECIPES[kind];
	const numericSeed = useMemo(() => hashSeed(seed), [seed]);

	// `--pointer-x/y`: 0..100%, opposite the tilt (the light source sits where
	// the drag isn't), same convention `Foil.tsx` and `FoilV2` already use.
	const pointerX = useDerivedValue(() => 50 + (-ry.value / TILT_RANGE) * 50);
	const pointerY = useDerivedValue(() => 50 + (-rx.value / TILT_RANGE) * 50);

	if (intensity <= 0) return null;

	return (
		<View
			style={[StyleSheet.absoluteFill, styles.stack, { borderRadius: radius, opacity: intensity }]}
			pointerEvents="none"
		>
			{recipe
				? recipe.shine.map((layer, i) => (
						<ShineLayer
							key={i}
							x={pointerX}
							y={pointerY}
							width={width}
							height={height}
							layer={layer}
							seed={numericSeed}
						/>
					))
				: null}
			{recipe ? (
				<Glare
					x={pointerX}
					y={pointerY}
					width={width}
					height={height}
					core={recipe.glareCore}
					edge={recipe.glareEdge}
				/>
			) : null}
			<EdgeLip width={width} radius={radius} />
		</View>
	);
}

function ShineLayer({
	x,
	y,
	width,
	height,
	layer,
	seed
}: {
	x: SharedValue<number>;
	y: SharedValue<number>;
	width: number;
	height: number;
	layer: ShineLayerDef;
	seed: number;
}) {
	// 200–400% of the card, per the CSS original — big enough that
	// `--background-x/y` travel never uncovers an edge.
	const scale = layer.oversize ?? 3;
	const amp = layer.amp ?? 1.6;
	const w = width * scale;
	const h = height * scale;

	const style = useAnimatedStyle(() => {
		// `--background-x/y`: the pointer's offset from centre, amplified —
		// the shine should sweep farther than the tilt driving it.
		const bx = ((x.value - 50) / 50) * amp;
		const by = ((y.value - 50) / 50) * amp;
		return {
			transform: [{ translateX: -bx * ((w - width) / 2) }, { translateY: -by * ((h - height) / 2) }]
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
					// The one blend mode this technique cannot skip: without it a
					// rainbow gradient is just an opaque sticker over the face.
					mixBlendMode: layer.blend ?? 'color-dodge',
					opacity: layer.opacity ?? 1
				},
				style
			]}
		>
			{layer.texture ? (
				layer.texture(w, h, seed)
			) : (
				<View
					style={[StyleSheet.absoluteFill, { experimental_backgroundImage: layer.background }]}
				/>
			)}
		</Animated.View>
	);
}

/** `.card__glare` — tracks the pointer 1:1 (no amplification, unlike shine),
 *  fading in as the pointer moves off-centre. The gradient itself is baked at
 *  rest and the layer translated, same UI-thread reasoning as everywhere else
 *  in this folder; only its *position*, not its shape, needs to move. */
function Glare({
	x,
	y,
	width,
	height,
	core,
	edge
}: {
	x: SharedValue<number>;
	y: SharedValue<number>;
	width: number;
	height: number;
	core?: string;
	edge?: string;
}) {
	const scale = 1.8;
	const w = width * scale;
	const h = height * scale;
	const opacityAt = pfcOpacity(0.15, 0.65);

	const style = useAnimatedStyle(() => {
		const dx = (x.value - 50) / 50;
		const dy = (y.value - 50) / 50;
		return {
			transform: [
				{ translateX: -dx * ((w - width) / 2) },
				{ translateY: -dy * ((h - height) / 2) }
			],
			opacity: opacityAt(x.value, y.value)
		};
	});

	const background =
		core || edge
			? `radial-gradient(circle farthest-corner at 50% 50%, ${core ?? 'hsla(0,0%,100%,0.85)'} 12%, ${edge ?? 'hsla(0,0%,0%,0.55)'} 95%)`
			: GLARE_GRADIENT;

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
					mixBlendMode: 'overlay' as ViewStyle['mixBlendMode'],
					experimental_backgroundImage: background
				},
				style
			]}
		/>
	);
}

const styles = StyleSheet.create({
	stack: {
		// scopes color-dodge/overlay to the card, matching every other engine
		isolation: 'isolate',
		overflow: 'hidden'
	}
});
