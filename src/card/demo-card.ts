/**
 * Fixture cards.
 *
 * The same purpose the web app's `demo-card.ts` serves: a card to develop
 * against that never needs a database or a signed-in user. Used by /dev/foil-lab
 * and /dev/cards, and later by the signed-out landing state.
 */

import { DEFAULT_STYLE, type CardStyle } from './card-style';
import type { CardView } from './types';

export const DEMO_CARD: CardView = {
	title: 'Jade Okonkwo',
	handle: 'jadeo',
	pronouns: 'she/her',
	bio: 'Seamstress, armour builder, professional gremlin. Ask me about the wings.',
	label: 'Cosplay',
	art_url: null,
	art_x: 0.5,
	art_y: 0.5,
	art_scale: 1,
	style: { ...DEFAULT_STYLE, bg: 'blush', photo_shape: 'arch' },
	affiliation: {
		id: 'cosplay',
		name: 'Cosplay',
		mark: 'COS',
		color_a: '#f48fb1',
		color_b: '#ad1457',
		x: 0.853,
		y: 0.895
	},
	links: [
		{ label: 'Bluesky', url: 'https://bsky.app/profile/jadeo' },
		{ label: 'Instagram', url: 'https://instagram.com/jadeo' },
		{ label: 'Ko-fi', url: 'https://ko-fi.com/jadeo' },
		{ label: 'Portfolio', url: 'https://jadeo.example' },
		{ label: 'Discord', url: 'https://discord.gg/example' }
	],
	stickers: []
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
	links: [
		{ label: 'Shop', url: 'https://example.com' },
		{ label: 'Tumblr', url: 'https://example.com' }
	]
};

export function demoWithStyle(style: Partial<CardStyle>): CardView {
	return { ...DEMO_CARD, style: { ...DEMO_CARD.style, ...style } };
}
