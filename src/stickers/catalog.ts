import type { StickerFoil } from '@/card/tiers';

/**
 * Prototype glyph catalog used by the stickers tab and `StickerLayer`.
 *
 * This is not the Stage 1 generative definition (`types.ts`). It stays until a
 * later stage replaces glyphs with fandom/deco definitions; do not import this
 * `StickerDefinition` from new sticker rendering code.
 */
export interface StickerDefinition {
	id: string;
	name: string;
	glyph: string;
	foil: StickerFoil;
	color: string;
	unlocked: boolean;
}

/**
 * Original starter set for the native prototype. Glyphs keep the set crisp,
 * portable and available in a crowded convention hall with no image requests.
 */
export const STICKER_CATALOG: StickerDefinition[] = [
	{
		id: 'pixel-heart',
		name: 'Extra Life',
		glyph: '♥',
		foil: 'none',
		color: '#FF5C9A',
		unlocked: true
	},
	{
		id: 'spark',
		name: 'Star Drop',
		glyph: '✦',
		foil: 'none',
		color: '#FFD98A',
		unlocked: true
	},
	{
		id: 'lucky-slime',
		name: 'Lucky Slime',
		glyph: '●',
		foil: 'glitter',
		color: '#6BE39A',
		unlocked: true
	},
	{
		id: 'ice-bolt',
		name: 'Ice Bolt',
		glyph: 'ϟ',
		foil: 'glitter',
		color: '#45E5D5',
		unlocked: true
	},
	{
		id: 'moon-club',
		name: 'Moon Club',
		glyph: '☾',
		foil: 'holo',
		color: '#A97BFF',
		unlocked: true
	},
	{
		id: 'portal',
		name: 'Secret Portal',
		glyph: '◎',
		foil: 'holo',
		color: '#FF7EC7',
		unlocked: false
	},
	{
		id: 'tiny-crown',
		name: 'Afterparty Royalty',
		glyph: '♛',
		foil: 'holo',
		color: '#FFD98A',
		unlocked: false
	},
	{
		id: 'encounter',
		name: 'Rare Encounter',
		glyph: '!',
		foil: 'holo',
		color: '#F7F0E4',
		unlocked: false
	}
];

export const STICKER_BY_ID = Object.fromEntries(
	STICKER_CATALOG.map((sticker) => [sticker.id, sticker])
) as Record<string, StickerDefinition>;
