/**
 * Collectible sticker definitions.
 *
 * A definition is the object itself — "STAR TREK" in retro-sci-fi, or a deco
 * PNG. Finish (base / glitter / holo) is an owned-instance property on
 * `PlacedSticker.foil`, never duplicated here. See the Stage 1 generative
 * fandom renderer in `FandomSticker.tsx`.
 *
 * The prototype glyph catalog in `catalog.ts` is a separate, older shape and
 * stays in place until a later stage replaces it.
 */

import type { StickerFoil } from '@/card/tiers';

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

export interface DecoStickerDefinition extends BaseStickerDefinition {
	kind: 'deco';
	imageUrl: string;
}

export type StickerDefinition = FandomStickerDefinition | DecoStickerDefinition;

export interface StickerRendererProps {
	definition: StickerDefinition;
	/** Accepted and ignored in Stage 1 — foil is an instance property, not art. */
	foil?: StickerFoil;
	width: number;
	/** Stable id for later foil fields; unused by the Stage 1 type renderer. */
	seed?: string;
}
