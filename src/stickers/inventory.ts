/**
 * A person's stickers: owned copies per (sticker, foil), how many of those
 * are on their cards, and what's left to place.
 *
 * Mirrors the schema: `sticker_inventory` holds quantities; a copy placed on a
 * card is in use (`sticker_available_count()` = owned − placed); the free
 * affiliation placement never uses a copy. The live source (./live.ts) and the
 * on-device one (the store, seeded from ./local-catalog.ts) both reduce to
 * `InventoryEntry[]` through `buildInventory`, so the drawer and the Stickers
 * tab never care which they're looking at.
 */

import { STICKER_FOILS, type StickerFoil } from '@/card/tiers';
import type { PlacedSticker } from '@/card/types';
import { isFandomStickerId } from './definitions';

/** What a sticker is, as far as drawing and ordering it goes. */
export interface CatalogSticker {
	id: string;
	kind: 'deco' | 'fandom';
	name: string;
	sort_order: number;
	full_path?: string | null;
	mask_path?: string | null;
	thumb_path?: string | null;
	art_aspect?: number | null;
	glyph?: string | null;
	fandom_id?: string | null;
	label?: string;
	style_category?: PlacedSticker['style_category'];
}

export interface InventoryRow {
	sticker_id: string;
	foil: StickerFoil;
	quantity: number;
}

export interface InventoryEntry {
	sticker: CatalogSticker;
	foil: StickerFoil;
	quantity: number;
	/** Copies of this (sticker, foil) on any of the owner's cards. */
	placed: number;
	available: number;
}

type PlacedRef = Pick<PlacedSticker, 'sticker_id' | 'foil' | 'is_affiliation'>;

/** Rows + the owner's placements → entries, in drawer order. Unknown sticker
 *  ids (a row whose definition didn't load) are kept, drawn as best we can. */
export function buildInventory(
	rows: InventoryRow[],
	placements: PlacedRef[],
	catalog: ReadonlyMap<string, CatalogSticker>
): InventoryEntry[] {
	const placedCount = new Map<string, number>();
	for (const p of placements) {
		if (p.is_affiliation) continue;
		const key = `${p.sticker_id}:${p.foil}`;
		placedCount.set(key, (placedCount.get(key) ?? 0) + 1);
	}
	const entries = rows
		.filter((row) => row.quantity > 0)
		.map((row) => {
			const placed = placedCount.get(`${row.sticker_id}:${row.foil}`) ?? 0;
			return {
				sticker: catalog.get(row.sticker_id) ?? fallbackSticker(row.sticker_id),
				foil: row.foil,
				quantity: row.quantity,
				placed,
				available: Math.max(0, row.quantity - placed)
			};
		});
	return sortInventory(entries);
}

/** `sort_order`, then foil descending within the same sticker (HANDOFF §2.2). */
export function sortInventory(entries: InventoryEntry[]): InventoryEntry[] {
	return [...entries].sort(
		(a, b) =>
			a.sticker.sort_order - b.sticker.sort_order ||
			a.sticker.id.localeCompare(b.sticker.id) ||
			STICKER_FOILS.indexOf(b.foil) - STICKER_FOILS.indexOf(a.foil)
	);
}

export function entryKey(entry: { sticker: { id: string }; foil: StickerFoil }): string {
	return `${entry.sticker.id}:${entry.foil}`;
}

/** The definition fields a placement of this entry carries (v4 snapshot shape). */
export function placementFields(sticker: CatalogSticker): Partial<PlacedSticker> {
	return {
		kind: sticker.kind,
		name: sticker.name,
		full_path: sticker.full_path ?? null,
		mask_path: sticker.mask_path ?? null,
		thumb_path: sticker.thumb_path ?? null,
		art_aspect: sticker.art_aspect ?? null,
		glyph: sticker.glyph ?? null,
		fandom_id: sticker.fandom_id ?? null,
		label: sticker.label,
		style_category: sticker.style_category
	};
}

function fallbackSticker(id: string): CatalogSticker {
	return {
		id,
		kind: isFandomStickerId(id) ? 'fandom' : 'deco',
		name: id,
		sort_order: 100000
	};
}
