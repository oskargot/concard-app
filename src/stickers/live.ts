/**
 * Stickers against the live Supabase project.
 *
 * Written to work on both sides of the sticker migrations
 * (concard `20260924000000`–`04`): `stickers` is always embedded as `*`, and
 * columns that only exist afterwards (`kind`, asset paths, `is_affiliation`,
 * `fandoms.style_category`) are read if present and inferred if not. Writes
 * only send columns the live table already has.
 */

import { normalizeStickerFoil } from '@/card/tiers';
import type { PlacedSticker } from '@/card/types';
import { requireSupabase } from '@/lib/supabase';
import { isFandomStickerId } from './definitions';
import { buildInventory, type CatalogSticker, type InventoryEntry } from './inventory';
import { FANDOM_STYLE_CATEGORIES, type FandomStyleCategory } from './types';

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, fallback = 0): number => {
	const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
	return Number.isFinite(n) ? n : fallback;
};

interface FandomInfo {
	name: string;
	style_category: FandomStyleCategory | undefined;
}

async function fetchFandoms(ids: string[]): Promise<Map<string, FandomInfo>> {
	const out = new Map<string, FandomInfo>();
	if (!ids.length) return out;
	const client = requireSupabase();
	const { data } = await client.from('fandoms').select('*').in('id', ids);
	for (const row of (data ?? []) as Row[]) {
		const style = str(row.style_category);
		out.set(String(row.id), {
			name: String(row.name),
			style_category: FANDOM_STYLE_CATEGORIES.includes(style as FandomStyleCategory)
				? (style as FandomStyleCategory)
				: undefined
		});
	}
	return out;
}

function fandomIdOf(sticker: Row | null, stickerId: string): string | null {
	return str(sticker?.fandom_id) ?? (isFandomStickerId(stickerId) ? stickerId.slice(7) : null);
}

/** A `stickers` row (any schema era) as a catalog entry. */
function catalogFrom(
	stickerId: string,
	row: Row | null,
	fandoms: Map<string, FandomInfo>
): CatalogSticker {
	const fandomId = fandomIdOf(row, stickerId);
	const kind = (str(row?.kind) as 'deco' | 'fandom' | null) ?? (fandomId ? 'fandom' : 'deco');
	const fandom = fandomId ? fandoms.get(fandomId) : undefined;
	return {
		id: stickerId,
		kind,
		name: str(row?.name) ?? fandom?.name ?? stickerId,
		sort_order: num(row?.sort_order, 100000),
		full_path: str(row?.full_path),
		mask_path: str(row?.mask_path),
		thumb_path: str(row?.thumb_path),
		art_aspect: row?.art_aspect == null ? null : num(row.art_aspect, 1),
		glyph: str(row?.glyph),
		fandom_id: fandomId,
		label: fandom?.name ?? str(row?.name) ?? undefined,
		style_category: fandom?.style_category
	};
}

/** Everything the signed-in person owns, with what's free to place. */
export async function fetchLiveInventory(userId: string): Promise<InventoryEntry[]> {
	const client = requireSupabase();
	const inv = await client
		.from('sticker_inventory')
		.select('sticker_id, foil, quantity, stickers(*)')
		.eq('owner_id', userId);
	if (inv.error) throw new Error(inv.error.message);

	let placed = await client
		.from('sticker_placements')
		.select('sticker_id, foil, is_affiliation, cards!inner(owner_id)')
		.eq('cards.owner_id', userId);
	if (placed.error) {
		// before the migration there's no is_affiliation (and no free affiliation)
		placed = (await client
			.from('sticker_placements')
			.select('sticker_id, foil, cards!inner(owner_id)')
			.eq('cards.owner_id', userId)) as typeof placed;
	}
	if (placed.error) throw new Error(placed.error.message);

	const rows = (inv.data ?? []) as unknown as Row[];
	const fandoms = await fetchFandoms(
		rows
			.map((r) => fandomIdOf(r.stickers as Row | null, String(r.sticker_id)))
			.filter((id): id is string => !!id)
	);
	const catalog = new Map<string, CatalogSticker>();
	for (const r of rows) {
		const id = String(r.sticker_id);
		catalog.set(id, catalogFrom(id, (r.stickers as Row | null) ?? null, fandoms));
	}
	return buildInventory(
		rows.map((r) => ({
			sticker_id: String(r.sticker_id),
			foil: normalizeStickerFoil(r.foil),
			quantity: num(r.quantity)
		})),
		((placed.data ?? []) as unknown as Row[]).map((p) => ({
			sticker_id: String(p.sticker_id),
			foil: normalizeStickerFoil(p.foil),
			is_affiliation: p.is_affiliation === true
		})),
		catalog
	);
}

/** One card's placements, each carrying what it needs to be drawn. */
export async function fetchCardPlacements(cardId: string): Promise<PlacedSticker[]> {
	const client = requireSupabase();
	const { data, error } = await client
		.from('sticker_placements')
		.select('*, stickers(*)')
		.eq('card_id', cardId)
		.order('z_index');
	if (error) throw new Error(error.message);
	const rows = (data ?? []) as unknown as Row[];
	const fandoms = await fetchFandoms(
		rows
			.map((r) => fandomIdOf(r.stickers as Row | null, String(r.sticker_id)))
			.filter((id): id is string => !!id)
	);
	return rows.map((r) => {
		const id = String(r.sticker_id);
		const def = catalogFrom(id, (r.stickers as Row | null) ?? null, fandoms);
		return {
			id: String(r.id),
			sticker_id: id,
			x: num(r.x, 0.5),
			y: num(r.y, 0.5),
			rotation: num(r.rotation),
			scale: num(r.scale, 1),
			z_index: num(r.z_index),
			foil: normalizeStickerFoil(r.foil),
			size: r.size == null ? null : num(r.size),
			is_affiliation: r.is_affiliation === true,
			kind: def.kind,
			name: def.name,
			full_path: def.full_path,
			mask_path: def.mask_path,
			thumb_path: def.thumb_path,
			art_aspect: def.art_aspect,
			glyph: def.glyph,
			fandom_id: def.fandom_id,
			label: def.label,
			style_category: def.style_category
		};
	});
}

/** Rounded to the columns' precision, so a write reads back identical. */
interface Wire {
	x?: number;
	y?: number;
	rotation?: number;
	scale?: number;
	z_index?: number;
}

function wire(p: Partial<PlacedSticker>): Wire {
	const out: Wire = {};
	if (p.x !== undefined) out.x = Math.round(p.x * 1e5) / 1e5;
	if (p.y !== undefined) out.y = Math.round(p.y * 1e5) / 1e5;
	if (p.rotation !== undefined)
		out.rotation = Math.round(normalizeRotation(p.rotation) * 100) / 100;
	if (p.scale !== undefined) out.scale = Math.round(p.scale * 100) / 100;
	if (p.z_index !== undefined) out.z_index = Math.max(0, Math.round(p.z_index));
	return out;
}

/** Degrees into (−180, 180], inside the column's ±360 range. */
export function normalizeRotation(deg: number): number {
	const r = ((((deg + 180) % 360) + 360) % 360) - 180;
	return r === -180 ? 180 : r;
}

/** Inserts a placement under the id the editor already gave it (a uuid), so
 *  the row's id never changes under the sticker once it lands. */
export async function insertPlacement(
	cardId: string,
	p: Pick<PlacedSticker, 'sticker_id' | 'foil' | 'x' | 'y' | 'rotation' | 'scale' | 'z_index'> & {
		id?: string;
		size?: number | null;
	}
): Promise<string> {
	const client = requireSupabase();
	const { data, error } = await client
		.from('sticker_placements')
		.insert({
			...wire(p),
			...(p.id ? { id: p.id } : {}),
			card_id: cardId,
			sticker_id: p.sticker_id,
			foil: p.foil,
			size: p.size ?? null,
			x: wire(p).x ?? 0.5,
			y: wire(p).y ?? 0.5
		})
		.select('id')
		.single();
	if (error) throw new Error(error.message);
	return String((data as Row).id);
}

export async function updatePlacement(id: string, patch: Partial<PlacedSticker>): Promise<void> {
	const client = requireSupabase();
	const { error } = await client.from('sticker_placements').update(wire(patch)).eq('id', id);
	if (error) throw new Error(error.message);
}

export async function deletePlacement(id: string): Promise<void> {
	const client = requireSupabase();
	const { error } = await client.from('sticker_placements').delete().eq('id', id);
	if (error) throw new Error(error.message);
}
