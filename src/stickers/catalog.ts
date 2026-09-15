import type { StickerFoil } from '@/card/tiers';

export type StickerRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface StickerDefinition {
	id: string;
	name: string;
	glyph: string;
	rarity: StickerRarity;
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
		rarity: 'common',
		foil: 'none',
		color: '#FF5C9A',
		unlocked: true
	},
	{
		id: 'spark',
		name: 'Star Drop',
		glyph: '✦',
		rarity: 'common',
		foil: 'none',
		color: '#FFD98A',
		unlocked: true
	},
	{
		id: 'lucky-slime',
		name: 'Lucky Slime',
		glyph: '●',
		rarity: 'uncommon',
		foil: 'glitter',
		color: '#6BE39A',
		unlocked: true
	},
	{
		id: 'ice-bolt',
		name: 'Ice Bolt',
		glyph: 'ϟ',
		rarity: 'uncommon',
		foil: 'glitter',
		color: '#45E5D5',
		unlocked: true
	},
	{
		id: 'moon-club',
		name: 'Moon Club',
		glyph: '☾',
		rarity: 'rare',
		foil: 'holo',
		color: '#A97BFF',
		unlocked: true
	},
	{
		id: 'portal',
		name: 'Secret Portal',
		glyph: '◎',
		rarity: 'rare',
		foil: 'holo',
		color: '#FF7EC7',
		unlocked: false
	},
	{
		id: 'tiny-crown',
		name: 'Afterparty Royalty',
		glyph: '♛',
		rarity: 'legendary',
		foil: 'holo',
		color: '#FFD98A',
		unlocked: false
	},
	{
		id: 'encounter',
		name: 'Rare Encounter',
		glyph: '!',
		rarity: 'legendary',
		foil: 'holo',
		color: '#F7F0E4',
		unlocked: false
	}
];

export const STICKER_BY_ID = Object.fromEntries(
	STICKER_CATALOG.map((sticker) => [sticker.id, sticker])
) as Record<string, StickerDefinition>;

export const RARITY_COLOR: Record<StickerRarity, string> = {
	common: '#F7F0E4',
	uncommon: '#6BE39A',
	rare: '#A97BFF',
	legendary: '#FFD98A'
};
