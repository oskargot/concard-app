/**
 * The curated Noto Emoji deco set (HANDOFF §3.3): con culture — hearts, stars
 * and sparkles, faces, animals, food, and a few fandom-ish objects.
 *
 * The first twelve keep the ids, names, sources and sort orders of the live
 * `stickers` rows seeded by the web app, so inventory and placements that
 * already point at them keep working once they gain real art.
 *
 * `codepoints` names the Noto file: `emoji_u<cp>[_<cp>…].png`, lowercase hex,
 * U+FE0F dropped (Noto's own convention).
 */

export interface EmojiSticker {
	id: string;
	name: string;
	codepoints: string;
	sort_order: number;
	source: 'starter' | 'drop';
}

export const EMOJI_SET: EmojiSticker[] = [
	// Seeded in the live project already.
	{ id: 'star', name: 'Star', codepoints: '2b50', sort_order: 10, source: 'starter' },
	{ id: 'heart', name: 'Heart', codepoints: '2764', sort_order: 20, source: 'starter' },
	{ id: 'sparkles', name: 'Sparkles', codepoints: '2728', sort_order: 30, source: 'starter' },
	{ id: 'fire', name: 'Fire', codepoints: '1f525', sort_order: 40, source: 'starter' },
	{ id: 'cat', name: 'Cat', codepoints: '1f431', sort_order: 50, source: 'drop' },
	{ id: 'rocket', name: 'Rocket', codepoints: '1f680', sort_order: 60, source: 'drop' },
	{ id: 'sushi', name: 'Sushi', codepoints: '1f363', sort_order: 70, source: 'drop' },
	{ id: 'dice', name: 'D20', codepoints: '1f3b2', sort_order: 80, source: 'drop' },
	{ id: 'crown', name: 'Crown', codepoints: '1f451', sort_order: 90, source: 'drop' },
	{ id: 'dragon', name: 'Dragon', codepoints: '1f409', sort_order: 100, source: 'drop' },
	{ id: 'ufo', name: 'UFO', codepoints: '1f6f8', sort_order: 110, source: 'drop' },
	{ id: 'rainbow', name: 'Rainbow', codepoints: '1f308', sort_order: 120, source: 'drop' },

	// Hearts, stars, sparkle.
	{ id: 'pink-heart', name: 'Pink Heart', codepoints: '1fa77', sort_order: 130, source: 'drop' },
	{
		id: 'purple-heart',
		name: 'Purple Heart',
		codepoints: '1f49c',
		sort_order: 140,
		source: 'drop'
	},
	{
		id: 'sparkling-heart',
		name: 'Sparkling Heart',
		codepoints: '1f496',
		sort_order: 150,
		source: 'drop'
	},
	{
		id: 'glowing-star',
		name: 'Glowing Star',
		codepoints: '1f31f',
		sort_order: 160,
		source: 'drop'
	},
	{ id: 'dizzy', name: 'Dizzy', codepoints: '1f4ab', sort_order: 170, source: 'drop' },
	{ id: 'moon', name: 'Moon', codepoints: '1f319', sort_order: 180, source: 'drop' },
	{ id: 'lightning', name: 'Lightning', codepoints: '26a1', sort_order: 190, source: 'drop' },
	{ id: 'blossom', name: 'Blossom', codepoints: '1f338', sort_order: 200, source: 'drop' },

	// Faces and folks.
	{ id: 'heart-eyes', name: 'Heart Eyes', codepoints: '1f60d', sort_order: 210, source: 'drop' },
	{ id: 'star-struck', name: 'Star-Struck', codepoints: '1f929', sort_order: 220, source: 'drop' },
	{ id: 'cool', name: 'Cool', codepoints: '1f60e', sort_order: 230, source: 'drop' },
	{ id: 'pleading', name: 'Pleading', codepoints: '1f97a', sort_order: 240, source: 'drop' },
	{ id: 'skull', name: 'Skull', codepoints: '1f480', sort_order: 250, source: 'drop' },
	{ id: 'ghost', name: 'Ghost', codepoints: '1f47b', sort_order: 260, source: 'drop' },
	{ id: 'alien', name: 'Alien', codepoints: '1f47d', sort_order: 270, source: 'drop' },
	{ id: 'robot', name: 'Robot', codepoints: '1f916', sort_order: 280, source: 'drop' },

	// Animals.
	{ id: 'fox', name: 'Fox', codepoints: '1f98a', sort_order: 290, source: 'drop' },
	{ id: 'frog', name: 'Frog', codepoints: '1f438', sort_order: 300, source: 'drop' },
	{ id: 'bunny', name: 'Bunny', codepoints: '1f430', sort_order: 310, source: 'drop' },
	{ id: 'unicorn', name: 'Unicorn', codepoints: '1f984', sort_order: 320, source: 'drop' },
	{ id: 'octopus', name: 'Octopus', codepoints: '1f419', sort_order: 330, source: 'drop' },
	{ id: 'penguin', name: 'Penguin', codepoints: '1f427', sort_order: 340, source: 'drop' },

	// Food.
	{ id: 'dango', name: 'Dango', codepoints: '1f361', sort_order: 350, source: 'drop' },
	{ id: 'onigiri', name: 'Onigiri', codepoints: '1f359', sort_order: 360, source: 'drop' },
	{ id: 'ramen', name: 'Ramen', codepoints: '1f35c', sort_order: 370, source: 'drop' },
	{ id: 'boba', name: 'Boba', codepoints: '1f9cb', sort_order: 380, source: 'drop' },
	{ id: 'donut', name: 'Donut', codepoints: '1f369', sort_order: 390, source: 'drop' },
	{ id: 'strawberry', name: 'Strawberry', codepoints: '1f353', sort_order: 400, source: 'drop' },

	// Things you'd find in a con bag.
	{ id: 'controller', name: 'Controller', codepoints: '1f3ae', sort_order: 410, source: 'drop' },
	{
		id: 'crystal-ball',
		name: 'Crystal Ball',
		codepoints: '1f52e',
		sort_order: 420,
		source: 'drop'
	},
	{ id: 'swords', name: 'Crossed Swords', codepoints: '2694', sort_order: 430, source: 'drop' },
	{ id: 'ribbon', name: 'Ribbon', codepoints: '1f380', sort_order: 440, source: 'drop' },
	{ id: 'mushroom', name: 'Mushroom', codepoints: '1f344', sort_order: 450, source: 'drop' }
];

export function notoFile(codepoints: string): string {
	return `emoji_u${codepoints}.png`;
}
