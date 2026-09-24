/**
 * Sticker numbers that more than one screen needs (HANDOFF §1.4, §9).
 * The database enforces the same limits (`max_stickers_per_card()`, the
 * `sticker_placements` range checks); these are the client's copies.
 */

/** A sticker's base size at scale 1: its long edge (deco) or width
 *  (fandom) as a fraction of the card's width. Tune by eye. */
export const STICKER_BASE_WIDTH = 0.24;

/** Base size of placements written before `size` existed (the old 15.33cqw). */
export const LEGACY_STICKER_WIDTH = 0.1533;

/** The free affiliation's base size: the card spec's 64 × 64 badge spot. */
export const AFFILIATION_STICKER_WIDTH = 64 / 250;

/** Pinch clamps, as multiples of the base size. */
export const STICKER_SCALE_MIN = 0.5;
export const STICKER_SCALE_MAX = 2;

/** Soft cap on stickers per card. The free affiliation doesn't count: a card
 *  holds 20 stickers plus, at most, its one affiliation. */
export const MAX_STICKERS_PER_CARD = 20;

export function clampStickerScale(scale: number): number {
	return Math.min(STICKER_SCALE_MAX, Math.max(STICKER_SCALE_MIN, scale));
}

/** A placement's base size, whatever era it was written in. */
export function baseSizeOf(placed: { size?: number | null; is_affiliation?: boolean }): number {
	if (placed.size != null) return placed.size;
	return placed.is_affiliation ? AFFILIATION_STICKER_WIDTH : LEGACY_STICKER_WIDTH;
}
