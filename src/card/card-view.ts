/**
 * Turning a `cards` row into the `CardView` the renderer draws.
 *
 * Kept apart from both the editor and the screens that only display a card,
 * because the two rules below are easy to get subtly wrong in one place and not
 * the other, and a card that renders differently depending on which screen
 * loaded it is the exact failure `CardView` exists to prevent:
 *
 *  - **Inherit.** `display_name`, `pronouns` and `bio` are null when the card
 *    has nothing of its own to say and the profile's value stands in.
 *  - **The affiliation.** `cards.affiliation` is a fandom id; the renderer
 *    wants a frozen generative sticker (name + style + finish + placement)
 *    so a snapshot never depends on a later catalog change.
 */

import type { Database } from '../lib/database.types';
import { styleCategoryOf } from '../stickers/fandoms';
import { BADGE_HOME, BADGE_HOME_LEGACY, normalizeStyle } from './card-style';
import { normalizeLinks } from './links';
import type { Affiliation, CardView } from './types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type CardRow = Database['public']['Tables']['cards']['Row'];
type Fandom = Database['public']['Tables']['fandoms']['Row'];

/** Defaults for the affiliation copy until placement/foil editing ships. */
export const AFFILIATION_DEFAULTS = {
	rotation: 0,
	scale: 1,
	foil: 'none' as const
};

/** The affiliation as the renderer wants it: frozen sticker art at the card's position. */
export function affiliationFor(
	fandomId: string | null,
	x: number | null,
	y: number | null,
	fandoms: Fandom[]
): Affiliation | null {
	if (!fandomId) return null;
	const fandom = fandoms.find((f) => f.id === fandomId);
	// An id with no matching fandom — deactivated, or not loaded yet — draws no
	// sticker rather than an empty one.
	if (!fandom) return null;
	// Never moved from the pre-spec default: follow the default to its new spot
	// (the spec's 64 × 64 corner) rather than pin the card to the old one.
	const unmoved =
		x == null ||
		y == null ||
		(Math.abs(x - BADGE_HOME_LEGACY.x) < 0.001 && Math.abs(y - BADGE_HOME_LEGACY.y) < 0.001);
	return {
		id: fandom.id,
		name: fandom.name,
		style_category: styleCategoryOf(fandom),
		x: unmoved ? BADGE_HOME.x : x,
		y: unmoved ? BADGE_HOME.y : y,
		rotation: AFFILIATION_DEFAULTS.rotation,
		scale: AFFILIATION_DEFAULTS.scale,
		foil: AFFILIATION_DEFAULTS.foil
	};
}

export function cardViewFrom(card: CardRow, profile: Profile, fandoms: Fandom[]): CardView {
	return {
		title: card.display_name ?? profile.display_name,
		handle: profile.username,
		pronouns: card.pronouns ?? profile.pronouns ?? null,
		bio: card.bio ?? profile.bio ?? '',
		label: card.label,
		art_url: card.art_url,
		art_x: card.art_x,
		art_y: card.art_y,
		art_scale: card.art_scale,
		style: normalizeStyle(card.style),
		affiliation: affiliationFor(card.affiliation, card.affiliation_x, card.affiliation_y, fandoms),
		links: normalizeLinks(card.links),
		// Placements are their own table and their own phase; a card drawn from a
		// row alone simply has none yet.
		stickers: []
	};
}
