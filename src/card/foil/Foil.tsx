/**
 * The card's light, and every foil in the app.
 *
 * One component owns all of it — card tiers and sticker foils both share the
 * vocabulary in `../tiers.ts` — for the same reason the web card keeps its
 * effect layers in one shell: the light on a foil must never desync from the
 * light on the rest of the card. Everything here is driven by the card's own
 * `rx`/`ry` tilt.
 *
 * It draws two layers over the card's content:
 *
 *  - The *holo*, over the whole face, photo included (card spec §7: the tier
 *    foil covers the face; tiers replace each other rather than stack). One SkSL runtime
 *    shader (`SkiaFoil.tsx`, source in `foil-sksl.ts`) with a recipe per
 *    kind. It emits light only and is screen-blended over the face, so it
 *    brightens the card and never darkens it. Its alpha also tracks its
 *    light, so its black is transparent even where a platform drops
 *    `mixBlendMode` on the native Skia surface. Beside it sits `edge`: a lit
 *    top lip and a shadowed bottom one, the reason a flat rectangle reads as
 *    a card with thickness.
 *  - The *gloss*, over everything: the glare's white wash, a plain gradient
 *    that slides with the same numbers the shader lights its flecks with.
 *    Every card has it, plain ones included; it replaced the static specular
 *    shine a plain card used to borrow from the web card, so here tier 0's
 *    light moves with the tilt where the web card's holds still.
 *
 * CardFace lifts the photo with `zIndex: 1` / `elevation: 2` for flip
 * stability, and both platforms flatten the plain wrappers between it and this
 * component, so it ends up a sibling of these two layers. The holo stack sits
 * at 3, over the photo and every other block; the gloss sits at 6, above that
 * and above CardShell's face light (4). Stickers are drawn outside the face
 * entirely, in CardShell's overlay, so they stay above the foil.
 *
 * `isolation: isolate` on the holo stack scopes the screen blend to the card,
 * so the foil never reaches whatever is behind it.
 *
 * One intentional divergence from the web card: its base face carries a
 * glitter layer. Here glitter is *earned* — design bible §7 makes tier 0
 * "holo base, no extra effect" and tier 1 Glitter, so a base card that
 * already glittered would make the first upgrade invisible.
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { TILT_RANGE } from '../FlipCard';
import type { FoilKind } from '../tiers';
import { GLARE_REST, GLARE_TRAVEL, GLOSS_RADII, glossGradient, LIGHT_DIRECTION } from './foil-sksl';
import { SKIA_AVAILABLE, SkiaFoil, type SkiaRecipeName } from './SkiaFoil';

/**
 * Which shader recipe each foil kind draws. `holo` is the sticker ceiling
 * rather than a card tier; a card gets it from the holo frame.
 */
export const RECIPE_FOR_KIND: Record<Exclude<FoilKind, 'none'>, SkiaRecipeName> = {
	glitter: 'sprayed',
	holo: 'linear',
	cosmic: 'stars',
	mosaic: 'mosaic'
};

export interface FoilProps {
	kind: FoilKind;
	/** Card size in px. Everything scales off this; nothing is hardcoded. */
	width: number;
	height: number;
	/** Tilt in degrees, owned by the card so foil and face share one light. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	/** Radius of the face this sits inside, so `edge` follows the card silhouette. */
	radius?: number;
	/** Scales the foil's brightness. 0 disables the foil entirely. */
	intensity?: number;
	/** Thumbnails hold still instead of drifting, so a grid of them does not
	 *  redraw every frame. */
	detail?: 'full' | 'thumb';
	/** Reserved. The recipes draw fixed patterns today; this is where a
	 *  per-card facet layout will take its seed. */
	seed?: string;
}

export function Foil({
	kind,
	width,
	height,
	rx,
	ry,
	radius = 0,
	intensity = 1,
	detail = 'full'
}: FoilProps) {
	if (intensity <= 0) return null;
	// Without a Skia runtime (the web target) every kind degrades to the plain
	// card's gloss, so a foiled card still reads as a card, just a quiet one.
	const recipe = kind === 'none' || !SKIA_AVAILABLE ? null : RECIPE_FOR_KIND[kind];

	return (
		<>
			<View
				style={[StyleSheet.absoluteFill, styles.stack, { borderRadius: radius }]}
				pointerEvents="none"
			>
				{recipe ? (
					<View style={[styles.shader, { opacity: intensity, borderRadius: radius }]}>
						<SkiaFoil
							recipe={recipe}
							width={width}
							height={height}
							radius={radius}
							rx={rx}
							ry={ry}
							idle={detail === 'thumb' ? 'still' : 'drift'}
						/>
					</View>
				) : null}
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
			</View>
			<View
				style={[StyleSheet.absoluteFill, styles.gloss, { borderRadius: radius }]}
				pointerEvents="none"
			>
				<Glare width={width} height={height} rx={rx} ry={ry} opacity={intensity} />
			</View>
		</>
	);
}

/** Built once: the gradient only depends on the panel in foil-sksl.ts. */
const GLOSS = glossGradient();

/**
 * The glare's white wash, as a gradient ellipse that slides opposite the
 * finger. Same centre, travel and falloff as the glare the shader lights its
 * flecks with (`foil-sksl.ts`), so the gloss and the sparkle under it move as
 * one light. White at alpha `a` drawn normally is exactly a screen blend of
 * `a`, so this needs no blend mode.
 */
function Glare({
	width,
	height,
	rx,
	ry,
	opacity
}: {
	width: number;
	height: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	opacity: number;
}) {
	// The shader measures the glare in face heights, x and y alike.
	const radiusX = GLOSS_RADII[0] * height;
	const radiusY = GLOSS_RADII[1] * height;

	// Mirrors `glareCentre = GLARE_REST + u_tilt * LIGHT_DIRECTION * GLARE_TRAVEL`,
	// with u_tilt = [ry, -rx] / TILT_RANGE exactly as SkiaFoil feeds it.
	const slide = useAnimatedStyle(() => ({
		transform: [
			{ translateX: (ry.value / TILT_RANGE) * LIGHT_DIRECTION[0] * GLARE_TRAVEL[0] * width },
			{ translateY: (-rx.value / TILT_RANGE) * LIGHT_DIRECTION[1] * GLARE_TRAVEL[1] * height }
		]
	}));

	return (
		<Animated.View
			style={[
				{
					position: 'absolute',
					left: GLARE_REST[0] * width - radiusX,
					top: GLARE_REST[1] * height - radiusY,
					width: radiusX * 2,
					height: radiusY * 2,
					opacity,
					experimental_backgroundImage: GLOSS
				} as ViewStyle,
				slide
			]}
		/>
	);
}

const styles = StyleSheet.create({
	stack: {
		// scopes every blend mode below to the card
		isolation: 'isolate',
		overflow: 'hidden',
		// Over the face's content, photo included (spec §7). No background, so
		// no Android shadow, and shadowColor makes sure of it.
		zIndex: 3,
		elevation: 3,
		shadowColor: 'transparent'
	},
	// Above CardFace's lifted blocks (1 / 2) and the face light (4): the gloss
	// is the laminate, so the light reaches the photo and text. No background,
	// so no Android shadow, and shadowColor makes sure of it.
	gloss: {
		overflow: 'hidden',
		zIndex: 6,
		elevation: 6,
		shadowColor: 'transparent'
	},
	// zIndex/elevation here only order the shader over `edge` inside the stack.
	shader: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		overflow: 'hidden',
		mixBlendMode: 'screen',
		zIndex: 5,
		elevation: 5
	}
} as Record<string, ViewStyle>);
