/**
 * A sticker's foil: the card's own foil engine, lit by the card's light.
 *
 * Not a second foil implementation. It draws `FoilFill` — the very element
 * the card's canvas draws, same shader, same recipes — plus the card's gloss,
 * and only changes *where* those are evaluated:
 *
 * - The light field is the card. Each sticker pixel is lit as the point of
 *   the card it covers (the shader's local matrix is the inverse of the
 *   sticker's placement), with the card's `rx`/`ry`. So a glitter sticker and
 *   the glitter card under it catch the same glare in the same place.
 * - The material is anchored to the sticker at the card's scale: its flecks
 *   travel and turn with it, and are exactly the card's fleck size.
 * - The card's rounded-face clip and rim are off (`edge={0}`); the sticker's
 *   baked mask shapes the foil instead, rim included, like real foil stock.
 *
 * A loose sticker (drawer, inventory) is lit as if placed at the centre of a
 * card sized so that the sticker is STICKER_BASE_WIDTH of it.
 *
 * Idle drift comes from the one shared shimmer clock (./shimmer.tsx).
 */

import { useMemo, type ReactElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import {
	Canvas,
	Fill,
	Group,
	Image,
	RadialGradient,
	Skia,
	useImage,
	type SkMatrix
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { TILT_RANGE } from '@/card/FlipCard';
import { RECIPE_FOR_KIND } from '@/card/foil/Foil';
import {
	GLARE_REST,
	GLARE_TRAVEL,
	GLOSS_RADII,
	glossStops,
	LIGHT_DIRECTION
} from '@/card/foil/foil-sksl';
import { FoilFill, SKIA_AVAILABLE } from '@/card/foil/SkiaFoil';
import { CARD_H, CARD_W } from '@/card/layout/spec';
import type { StickerFoil } from '@/card/tiers';
import { STICKER_BASE_WIDTH } from './constants';
import { useShimmerClock } from './shimmer';
import type { DecoStickerAssets } from './types';

/** Where a sticker sits on the card whose light it shares, in that card's px. */
export interface StickerOnCard {
	width: number;
	height: number;
	/** The sticker's centre. */
	cx: number;
	cy: number;
	/** Degrees, everything included (the placement's and its fixed wobble). */
	rotation: number;
	scale: number;
}

export interface StickerLight {
	/** The card's tilt, so card and stickers share one light. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	/** Omit for a loose sticker. */
	card?: StickerOnCard;
}

interface Field {
	width: number;
	height: number;
	/** Light field (card px) → this canvas. */
	matrix: SkMatrix;
	/** The sticker's own frame in card px: its centre and rotation. */
	textureMatrix: SkMatrix;
}

/** How a `w × h` sticker canvas maps onto the card that lights it. */
export function stickerField(w: number, h: number, card?: StickerOnCard): Field {
	const place: StickerOnCard = card ?? looseCard(w, h);
	const theta = (place.rotation * Math.PI) / 180;
	// canvas = centre + (1/s) R(-θ) (card - C)
	const matrix = Skia.Matrix()
		.translate(w / 2, h / 2)
		.scale(1 / place.scale, 1 / place.scale)
		.rotate(-theta)
		.translate(-place.cx, -place.cy);
	const textureMatrix = Skia.Matrix().translate(place.cx, place.cy).rotate(theta);
	return { width: place.width, height: place.height, matrix, textureMatrix };
}

function looseCard(w: number, h: number): StickerOnCard {
	const width = Math.max(w, h) / STICKER_BASE_WIDTH;
	const height = (width * CARD_H) / CARD_W;
	return { width, height, cx: width / 2, cy: height / 2, rotation: 0, scale: 1 };
}

/**
 * The foil and gloss for one sticker, as Skia elements. `clipped`: they're
 * drawn onto the sticker's mask in a layer and keep to it.
 */
function FoilAndGloss({
	foil,
	field,
	rx,
	ry,
	clock,
	clipped = false
}: {
	foil: Exclude<StickerFoil, 'none'>;
	field: Field;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	clock: SharedValue<number>;
	/** Drawn onto a mask already in the layer: keep to it. */
	clipped?: boolean;
}) {
	return (
		<>
			<Group blendMode={clipped ? 'srcIn' : 'srcOver'}>
				<FoilFill
					recipe={RECIPE_FOR_KIND[foil]}
					width={field.width}
					height={field.height}
					rx={rx}
					ry={ry}
					clock={clock}
					edge={0}
					matrix={field.matrix}
					textureMatrix={field.textureMatrix}
				/>
			</Group>
			<Group blendMode={clipped ? 'srcATop' : 'srcOver'}>
				<Gloss field={field} rx={rx} ry={ry} />
			</Group>
		</>
	);
}

const GLOSS = glossStops();

/**
 * The card's gloss (Foil.tsx's `Glare`), drawn in Skia: the glare's white wash,
 * an ellipse centred where the shader puts the glare, sliding with real tilt
 * only. Drawn in a space squashed vertically so a round gradient is the
 * gloss's ellipse.
 */
function Gloss({
	field,
	rx,
	ry
}: {
	field: Field;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
}) {
	const radiusX = GLOSS_RADII[0] * field.height;
	const squash = GLOSS_RADII[1] / GLOSS_RADII[0];
	const centre = useDerivedValue(() => {
		const tx = ry.value / TILT_RANGE;
		const ty = -rx.value / TILT_RANGE;
		const x = (GLARE_REST[0] + tx * LIGHT_DIRECTION[0] * GLARE_TRAVEL[0]) * field.width;
		const y = (GLARE_REST[1] + ty * LIGHT_DIRECTION[1] * GLARE_TRAVEL[1]) * field.height;
		return { x, y: y / squash };
	});
	return (
		<Group matrix={field.matrix}>
			<Group transform={[{ scaleY: squash }]}>
				<Fill>
					<RadialGradient
						c={centre}
						r={radiusX}
						colors={GLOSS.colors}
						positions={GLOSS.positions}
					/>
				</Fill>
			</Group>
		</Group>
	);
}

/** Skia wants a require() number or a uri string. */
function skiaSource(source: DecoStickerAssets['full']): number | string | null {
	if (typeof source === 'number') return source;
	if (source && !Array.isArray(source) && typeof source === 'object' && 'uri' in source) {
		return source.uri ?? null;
	}
	return null;
}

/**
 * A foiled deco sticker, whole: the baked art, then the foil laid over it
 * through the baked mask, composited exactly as the card composites its own. One canvas, one image and one mask; no
 * runtime outline, blur or filter.
 */
export function DecoFoilCanvas({
	assets,
	foil,
	width,
	height,
	light,
	art = 'full'
}: {
	assets: DecoStickerAssets;
	foil: Exclude<StickerFoil, 'none'>;
	width: number;
	height: number;
	light: StickerLight;
	/** Drawer tiles draw the thumbnail; the mask is always the full one. */
	art?: 'full' | 'thumb';
}) {
	const clock = useShimmerClock();
	const image = useImage(skiaSource(art === 'thumb' ? assets.thumb : assets.full));
	const mask = useImage(skiaSource(assets.mask));
	const field = useMemo(() => stickerField(width, height, light.card), [width, height, light.card]);

	if (!image || !mask) return <View style={{ width, height }} />;

	return (
		<Canvas style={{ width, height }} pointerEvents="none">
			<Image image={image} x={0} y={0} width={width} height={height} fit="fill" />
			{/* Composited like the card's foil actually is: Foil.tsx isolates its
			    stack, so its screen blend never reaches the face and the light lands
			    as premultiplied source-over (its alpha tracks its light). A screen
			    here would wash out on bright art where the card's flecks show. */}
			<Group layer>
				{/* mask first, then the foil kept only inside it (srcIn) and the
				    gloss over the foil, still inside it (srcAtop). Clipping by
				    drawing the mask *after* with dstIn would miss the partial pixel
				    row a fractional-size canvas has past the image's edge. */}
				<Image image={mask} x={0} y={0} width={width} height={height} fit="fill" />
				<FoilAndGloss foil={foil} field={field} rx={light.rx} ry={light.ry} clock={clock} clipped />
			</Group>
		</Canvas>
	);
}

/**
 * Foil over a sticker that isn't an image — the generative fandom sticker.
 * Its own vector silhouette (`silhouette`, drawn the same size and place) is
 * the mask, so the foil registers with the die cut exactly; the foil view is
 * laid over the sticker beneath it the way the card lays its foil.
 *
 * Native only: react-native-masked-view's web build drops its children, so on
 * the web target the fandom sticker draws plain.
 */
export function MaskedFoil({
	silhouette,
	foil,
	width,
	height,
	light
}: {
	silhouette: ReactElement;
	foil: Exclude<StickerFoil, 'none'>;
	width: number;
	height: number;
	light: StickerLight;
}) {
	const clock = useShimmerClock();
	const field = useMemo(() => stickerField(width, height, light.card), [width, height, light.card]);
	if (Platform.OS === 'web' || !SKIA_AVAILABLE) return null;

	return (
		<MaskedView pointerEvents="none" style={StyleSheet.absoluteFill} maskElement={silhouette}>
			<Canvas style={{ width, height }}>
				<FoilAndGloss foil={foil} field={field} rx={light.rx} ry={light.ry} clock={clock} />
			</Canvas>
		</MaskedView>
	);
}

export { SKIA_AVAILABLE as STICKER_FOIL_AVAILABLE };
