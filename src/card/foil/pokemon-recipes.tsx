/**
 * Foil recipes for the `pokemon` engine — a faithful port of
 * simeydotme/pokemon-cards-css's actual structure, not just its blend modes:
 *
 *   - `.card__shine` — ALWAYS `mix-blend-mode: color-dodge`. This is the layer
 *     that turns a background-image into light; skipping color-dodge here is
 *     the single most common way to reimplement this technique wrong (you get
 *     an opaque rainbow sticker instead of a foil).
 *   - `.card__glare` — a radial gradient that tracks the pointer directly (not
 *     amplified), `mix-blend-mode: overlay`, fading in as the pointer moves
 *     off-centre.
 *   - Per-rarity extra layers (the original's `::before`/`::after` on the
 *     shine element) carry their own background-image + blend mode, so a
 *     rarity is "a stack of layers", not a shader.
 *
 * Every background here is either a gradient string (via `gradients.ts` /
 * `sampler-gradients.ts`, since RN's `experimental_backgroundImage` doesn't
 * parse `repeating-linear-gradient`) or one of the vendored
 * `assets/foil/pokemon-cards-css` textures via `FoilTexture.tsx` — nothing
 * here is invented art, it's the same source material `recipes.tsx` and the
 * sampler already draw from.
 */

import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import type { FoilKind } from '../tiers';
import { HOLO_SPECTRUM, nebula, repeatingLinear } from './gradients';
import { crosshatchBars, radialHotspot, rainbowGlitterPastelBand } from './sampler-gradients';
import { CoverFoilTexture, TiledFoilTexture } from './FoilTexture';

export interface ShineLayerDef {
	/** A gradient string for `experimental_backgroundImage`. Mutually exclusive with `texture`. */
	background?: string;
	/** A raster texture (one of the vendored assets) standing in for a gradient. */
	texture?: (width: number, height: number, seed: number) => ReactNode;
	/** Defaults to `'color-dodge'` — only override this for a secondary/accent layer. */
	blend?: ViewStyle['mixBlendMode'];
	opacity?: number;
	/** Layer size as a multiple of the card, 2–4 per the CSS original's 200–400%. */
	oversize?: number;
	/** How much farther this layer travels than the pointer itself (`--background-x/y`). */
	amp?: number;
}

export interface PokemonRecipe {
	/** The rarity's background-image stack, drawn under `.card__shine`. */
	shine: ShineLayerDef[];
	/** Tint for the glare's hot core. White unless a rarity wants a colour cast. */
	glareCore?: string;
	glareEdge?: string;
}

// ---- shared gradients, built once ------------------------------------------

const HOLO_BANDS = repeatingLinear('110deg', HOLO_SPECTRUM, 9, 100);
const GLITTER_PASTEL = rainbowGlitterPastelBand();
const NEBULA = nebula();
const CROSSHATCH_A = crosshatchBars('-45deg');
const CROSSHATCH_B = crosshatchBars('45deg');
export const GLARE_GRADIENT = radialHotspot('hsla(0,0%,100%,0.85)', 'hsla(0,0%,0%,0.55)', 12, 95);

/**
 * One recipe per `FoilKind`. `none` has no entry — tier 0 stays a flat card
 * (design bible §7: "holo base, no extra effect"), matching every other
 * engine in this folder.
 */
export const POKEMON_RECIPES: Partial<Record<FoilKind, PokemonRecipe>> = {
	glitter: {
		shine: [
			{
				texture: (w, h) => (
					<TiledFoilTexture name="glitter" width={w} height={h} tileScale={0.22} />
				),
				oversize: 3,
				amp: 1.6
			},
			{
				background: GLITTER_PASTEL,
				blend: 'color-dodge',
				opacity: 0.4,
				oversize: 2.4,
				amp: 1.9
			}
		]
	},
	holo: {
		shine: [
			{ background: HOLO_BANDS, oversize: 3, amp: 1.8 },
			{
				texture: (w, h) => <TiledFoilTexture name="grain" width={w} height={h} tileScale={0.3} />,
				blend: 'hard-light',
				opacity: 0.3,
				oversize: 2,
				amp: 1.2
			}
		]
	},
	cosmic: {
		shine: [
			{ background: NEBULA, oversize: 2.6, amp: 1.4 },
			{
				texture: () => <CoverFoilTexture name="cosmosBottom" opacity={0.9} />,
				oversize: 2,
				amp: 1.5
			},
			{
				texture: () => <CoverFoilTexture name="cosmosTop" opacity={0.85} />,
				blend: 'screen',
				opacity: 0.6,
				oversize: 2,
				amp: 1.7
			}
		],
		glareCore: 'hsla(204,100%,95%,0.9)',
		glareEdge: 'hsl(250,15%,15%)'
	},
	mosaic: {
		shine: [
			{ background: CROSSHATCH_A, oversize: 2.8, amp: 1.5 },
			{ background: CROSSHATCH_B, blend: 'color-dodge', opacity: 0.7, oversize: 2.8, amp: 1.5 },
			{
				texture: (w, h) => <TiledFoilTexture name="trainer" width={w} height={h} tileScale={0.4} />,
				blend: 'multiply',
				opacity: 0.35,
				oversize: 2,
				amp: 1.1
			}
		]
	}
};
