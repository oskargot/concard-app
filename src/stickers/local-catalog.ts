/**
 * The sticker catalog and starting inventory for the on-device card — what
 * the editor's drawer and the Stickers tab show with no Supabase project or
 * nobody signed in (development builds allow both).
 *
 * Deco stickers are the bundled fixtures (real bakes). Fandom stickers are the
 * eight fandoms live today, with the style categories the schema backfilled
 * for them (migration 20260924000002).
 */

import type { InventoryRow, CatalogSticker } from './inventory';
import { fandomStickerId } from './definitions';
import { FIXTURE_STICKERS } from './fixtures.generated';
import type { FandomStyleCategory } from './types';

export const LOCAL_FANDOMS: {
	id: string;
	name: string;
	style_category: FandomStyleCategory;
	sort_order: number;
}[] = [
	{ id: 'anime', name: 'Anime', style_category: 'general', sort_order: 10 },
	{ id: 'scifi', name: 'Sci-fi', style_category: 'retro-sci-fi', sort_order: 20 },
	{ id: 'tcg', name: 'Trading cards', style_category: 'cute', sort_order: 30 },
	{ id: 'gaming', name: 'Gaming', style_category: 'cute', sort_order: 40 },
	{ id: 'cosplay', name: 'Cosplay', style_category: 'cute', sort_order: 50 },
	{ id: 'comics', name: 'Comics', style_category: 'horror', sort_order: 60 },
	{ id: 'tabletop', name: 'Tabletop', style_category: 'general', sort_order: 70 },
	{ id: 'fantasy', name: 'Fantasy', style_category: 'fantasy', sort_order: 80 }
];

export const LOCAL_CATALOG: ReadonlyMap<string, CatalogSticker> = new Map<string, CatalogSticker>([
	...FIXTURE_STICKERS.map((f): [string, CatalogSticker] => [
		f.id,
		{
			id: f.id,
			kind: 'deco',
			name: f.name,
			sort_order: f.sort_order,
			full_path: f.full_path,
			mask_path: f.mask_path,
			thumb_path: f.thumb_path,
			art_aspect: f.art_aspect
		}
	]),
	...LOCAL_FANDOMS.map((f): [string, CatalogSticker] => [
		fandomStickerId(f.id),
		{
			id: fandomStickerId(f.id),
			kind: 'fandom',
			name: f.name,
			sort_order: f.sort_order,
			fandom_id: f.id,
			label: f.name,
			style_category: f.style_category
		}
	])
]);

/**
 * What an on-device card starts with: two plain copies of every fixture (the
 * starter-grant shape), a few foiled ones so every rung shows up in the
 * drawer, and a handful of fandom stickers.
 */
export const LOCAL_STARTER_INVENTORY: InventoryRow[] = [
	...FIXTURE_STICKERS.map((f) => ({ sticker_id: f.id, foil: 'none' as const, quantity: 2 })),
	{ sticker_id: 'star', foil: 'glitter', quantity: 2 },
	{ sticker_id: 'sparkles', foil: 'holo', quantity: 1 },
	{ sticker_id: 'heart', foil: 'cosmic', quantity: 1 },
	{ sticker_id: 'rocket', foil: 'mosaic', quantity: 1 },
	{ sticker_id: fandomStickerId('scifi'), foil: 'none', quantity: 2 },
	{ sticker_id: fandomStickerId('anime'), foil: 'glitter', quantity: 1 },
	{ sticker_id: fandomStickerId('gaming'), foil: 'none', quantity: 1 },
	{ sticker_id: fandomStickerId('fantasy'), foil: 'holo', quantity: 1 }
];
