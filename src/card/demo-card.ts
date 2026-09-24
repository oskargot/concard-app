/**
 * Fixture cards.
 *
 * The same purpose the web app's `demo-card.ts` serves: a card to develop
 * against that never needs a database or a signed-in user. Used by /dev/foil-lab
 * and /dev/cards, and later by the signed-out landing state.
 */

import { ART_DEFAULT, BADGE_HOME, DEFAULT_STYLE, type CardStyle } from './card-style';
import type { CardView } from './types';

/**
 * The card on the home gallery. Gold on butter with stickers and a fandom
 * affiliation sticker — matches the web demo fixture for style comparison.
 */
export const DEMO_CARD: CardView = {
	title: 'Oskar',
	handle: 'oskar',
	pronouns: null,
	bio: 'Anime and sci-fi con regular. Making concard. Will trade stickers for good tea recommendations.',
	label: null,
	art_url: null,
	art_x: ART_DEFAULT.x,
	art_y: ART_DEFAULT.y,
	art_scale: ART_DEFAULT.scale,
	style: { ...DEFAULT_STYLE, frame: 'gold', bg: 'butter', photo_shape: 'arch', photo_height: 126 },
	affiliation: {
		id: 'anime',
		name: 'Anime',
		style_category: 'cute',
		...BADGE_HOME,
		rotation: 0,
		scale: 1,
		foil: 'none'
	},
	links: [
		{ url: 'https://bsky.app/profile/oskar.bsky.social', handle: '@oskar.bsky.social' },
		{ url: 'https://oskar.itch.io', handle: 'oskar' },
		{ url: 'https://instagram.com/pixelpastrycafe', handle: '@pixelpastrycafe' },
		{ url: 'https://oskargot.space', handle: 'oskargot.space' }
	],
	stickers: [
		{ sticker_id: 'star', x: 0.87, y: 0.14, rotation: 0, scale: 0.9, z_index: 1, foil: 'none' },
		{
			sticker_id: 'dragon',
			x: 0.13,
			y: 0.33,
			rotation: 0,
			scale: 0.95,
			z_index: 2,
			foil: 'glitter'
		},
		{ sticker_id: 'rainbow', x: 0.94, y: 0.82, rotation: 0, scale: 0.85, z_index: 3, foil: 'holo' }
	]
};

/** A second fixture, so side-by-side comparisons are not two identical cards. */
export const DEMO_CARD_ALT: CardView = {
	...DEMO_CARD,
	title: 'Rafa Lindqvist',
	handle: 'rafadraws',
	pronouns: 'they/them',
	bio: 'Inks comics too slowly. Table H14 all weekend.',
	label: 'Business',
	style: { ...DEFAULT_STYLE, frame: 'gold', bg: 'slate', photo_shape: 'circle' },
	affiliation: null,
	stickers: [
		{ sticker_id: 'cat', x: 0.18, y: 0.22, rotation: -6, scale: 1, z_index: 1, foil: 'none' }
	],
	links: [
		{ url: 'https://rafadraws.tumblr.com', handle: 'rafadraws' },
		{ url: 'https://ko-fi.com/rafadraws', handle: 'rafadraws' }
	]
};

export function demoWithStyle(style: Partial<CardStyle>): CardView {
	return { ...DEMO_CARD, style: { ...DEMO_CARD.style, ...style } };
}
