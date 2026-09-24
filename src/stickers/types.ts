/**
 * Collectible sticker definitions.
 *
 * A definition is the object itself — "STAR TREK" in retro-sci-fi, or a baked
 * deco image. Its foil (none → glitter → holo → cosmic → mosaic) belongs to a
 * copy — `PlacedSticker.foil`, an inventory pile — never to the definition.
 * `definitions.ts` builds these from placements, snapshots and inventory rows.
 */

import type { ImageSourcePropType } from 'react-native';

import type { StickerFoil } from '@/card/tiers';
import type { StickerLight } from './StickerFoil';

export const FANDOM_STYLE_CATEGORIES = [
	'retro-sci-fi',
	'cute',
	'fantasy',
	'action',
	'horror',
	'tech',
	'general'
] as const;

/**
 * Concard visual categories — art direction, not legal classification and not
 * franchise-specific fonts.
 */
export type FandomStyleCategory = (typeof FANDOM_STYLE_CATEGORIES)[number];

export type FandomCase = 'upper' | 'lower' | 'title' | 'preserve';

interface BaseStickerDefinition {
	id: string;
	name: string;
	kind: 'fandom' | 'deco';
}

export interface FandomStickerDefinition extends BaseStickerDefinition {
	kind: 'fandom';
	/** Text drawn on the sticker. Usually the fandom's display name. */
	label: string;
	styleCategory: FandomStyleCategory;
}

/** The three baked, immutable images a deco sticker is drawn from
 *  (scripts/stickers/pipeline.ts): die-cut art, its silhouette for the foil
 *  to clip to, and a drawer-sized copy. */
export interface DecoStickerAssets {
	full: ImageSourcePropType;
	mask: ImageSourcePropType;
	thumb: ImageSourcePropType;
	/** Width / height of `full` and `mask`, which share one canvas. */
	aspect: number;
}

export interface DecoStickerDefinition extends BaseStickerDefinition {
	kind: 'deco';
	/** Null when neither a live URL nor a bundled fixture is available. */
	assets: DecoStickerAssets | null;
	/** Drawn when there are no assets: the prototype emoji stickers. */
	glyph?: string | null;
}

export type StickerDefinition = FandomStickerDefinition | DecoStickerDefinition;

export interface StickerRendererProps {
	definition: StickerDefinition;
	/** Any rung of the ladder; `none` draws a fully static sticker. */
	foil?: StickerFoil;
	/** Base size in px: a deco sticker's long edge, a fandom sticker's width. */
	width: number;
	/** Kept for callers that key stickers by a stable id. */
	seed?: string;
	/** The light the foil shares with its card. Omit for a loose sticker
	 *  that is never tilted. */
	light?: StickerLight;
	/** Drawer tiles draw the thumbnail. */
	art?: 'full' | 'thumb';
}
