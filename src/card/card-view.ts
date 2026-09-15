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
 *  - **The badge.** `cards.affiliation` is a fandom id; the renderer wants the
 *    fandom's art together with the position stored on the card.
 */

import type { Database } from '../lib/database.types';
import { BADGE_HOME, normalizeStyle } from './card-style';
import { normalizeLinks } from './links';
import type { Affiliation, CardView } from './types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type CardRow = Database['public']['Tables']['cards']['Row'];
type Fandom = Database['public']['Tables']['fandoms']['Row'];

/** The badge as the renderer wants it: the fandom's art, at the card's position. */
export function affiliationFor(
	fandomId: string | null,
	x: number | null,
	y: number | null,
	fandoms: Fandom[]
): Affiliation | null {
	if (!fandomId) return null;
	const fandom = fandoms.find((f) => f.id === fandomId);
	// An id with no matching fandom — deactivated, or not loaded yet — draws no
	// badge rather than an empty one.
	if (!fandom) return null;
	return {
		id: fandom.id,
		name: fandom.name,
		mark: fandom.mark,
		color_a: fandom.color_a,
		color_b: fandom.color_b,
		x: x ?? BADGE_HOME.x,
		y: y ?? BADGE_HOME.y
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
