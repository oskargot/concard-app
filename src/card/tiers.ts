/**
 * The foil ladder.
 *
 * Two systems progress through foils and they overlap, so they share one
 * vocabulary and one renderer (see `foil/Foil.tsx`):
 *
 *   - **Card tiers** (design bible §7) — per card, per collector. Meeting
 *     someone repeatedly upgrades their card in your binder.
 *   - **Sticker foils** (web app, `sticker_foil` enum) — two copies of a
 *     sticker at one tier combine into one at the next.
 *
 * `glitter` is a rung on both ladders and must look identical in both places, or
 * the shared vocabulary stops meaning anything.
 */

/** Every foil treatment in the app. One renderer covers all of them. */
export const FOIL_KINDS = ['none', 'glitter', 'holo', 'cosmic', 'mosaic'] as const;
export type FoilKind = (typeof FOIL_KINDS)[number];

/** The three a sticker can be, matching the database enum exactly. */
export const STICKER_FOILS = ['none', 'glitter', 'holo'] as const;
export type StickerFoil = (typeof STICKER_FOILS)[number];

/**
 * Card tier → foil, and the meeting count that earns it.
 *
 * The bible calls these thresholds "a starting point [to] be tuned in
 * playtesting", so they live in exactly one place. Tier 0 is not bare: it still
 * gets the holo base every Concard has, just no effect on top.
 */
export interface TierSpec {
	tier: number;
	meetings: number;
	foil: FoilKind;
	label: string;
}

export const CARD_TIERS: readonly TierSpec[] = [
	{ tier: 0, meetings: 1, foil: 'none', label: 'Plain' },
	{ tier: 1, meetings: 2, foil: 'glitter', label: 'Glitter' },
	{ tier: 2, meetings: 4, foil: 'cosmic', label: 'Cosmic' },
	{ tier: 3, meetings: 8, foil: 'mosaic', label: 'Mosaic' }
] as const;

export const MAX_TIER = CARD_TIERS[CARD_TIERS.length - 1].tier;

/**
 * The tier a given number of meetings earns. Rounds down to the highest
 * threshold met, so tuning a threshold can never leave a collector's card
 * between two tiers.
 */
export function tierForMeetings(meetings: number): number {
	let earned = 0;
	for (const spec of CARD_TIERS) if (meetings >= spec.meetings) earned = spec.tier;
	return earned;
}

/** Meetings still needed for the next tier, or null at the ceiling. */
export function meetingsToNextTier(meetings: number): number | null {
	const next = CARD_TIERS.find((spec) => spec.meetings > meetings);
	return next ? next.meetings - meetings : null;
}

const BY_TIER = new Map(CARD_TIERS.map((spec) => [spec.tier, spec]));

/** The foil a tier renders. Unknown tiers clamp rather than throw: a client
 *  older than the server must degrade to a plainer card, never a broken one. */
export function foilForTier(tier: number): FoilKind {
	return BY_TIER.get(Math.max(0, Math.min(MAX_TIER, Math.trunc(tier))))?.foil ?? 'none';
}

export function tierLabel(tier: number): string {
	return BY_TIER.get(tier)?.label ?? 'Plain';
}
