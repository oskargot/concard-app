/**
 * Collection snapshots → what the app draws, and what a collect granted.
 *
 * `collect_card()` freezes the card as JSON on the collection row. Versions:
 *  - v2/v3: top-level title / bio / pronouns / art_* / style / links /
 *    stickers (placement only) / owner, plus `affiliation` as
 *    {id, name, mark, colours, x, y}.
 *  - v4 (migration 20260924000004): each sticker also carries what it *is* —
 *    `kind`, deco asset paths + aspect, fandom label + style category — and the
 *    affiliation is among them as `is_affiliation`. `affiliation` is still
 *    written, now with its `style_category`. Each sticker also carries its
 *    placement's `id`, which seeds its wobble (`stickerRotation`) exactly as
 *    it does on the owner's own card; older snapshots have none, and fall
 *    back to a seed of their own.
 * Older snapshots stay drawable: stickers without definitions resolve through
 * `definitionForPlacement` (bundled fixture art, then a glyph), and an
 * affiliation without a style category gets the renderer's own guess.
 *
 * The collect response also lists what was granted (`stickers`: one deco and
 * one fandom at most); before the migration only `bonus_sticker_id` exists.
 */

import { normalizeStickerFoil } from './tiers';
import { normalizeStyle } from './card-style';
import { normalizeLinks } from './links';
import { styleCategoryOf } from '../stickers/fandoms';
import { isFandomStickerId } from '../stickers/definitions';
import type { Affiliation, CardView, PlacedSticker } from './types';

type Obj = Record<string, unknown>;

function obj(input: unknown): Obj {
	return input && typeof input === 'object' && !Array.isArray(input) ? (input as Obj) : {};
}
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown, fallback: number): number => {
	const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
	return Number.isFinite(n) ? n : fallback;
};

/** A sticker as a snapshot (or a grant) describes it. */
export function placedFromSnapshot(input: unknown, index = 0): PlacedSticker {
	const e = obj(input);
	const stickerId = str(e.sticker_id) ?? 'unknown';
	const kind =
		(str(e.kind) as 'deco' | 'fandom' | undefined) ??
		(isFandomStickerId(stickerId) ? 'fandom' : 'deco');
	const style = str(e.style_category);
	return {
		// the placement's own id, so a collector's copy wobbles like the owner's
		id: str(e.id) ?? `${stickerId}-${index}`,
		sticker_id: stickerId,
		x: num(e.x, 0.5),
		y: num(e.y, 0.5),
		rotation: num(e.rotation, 0),
		scale: num(e.scale, 1),
		z_index: num(e.z_index, index),
		foil: normalizeStickerFoil(e.foil),
		size: e.size == null ? null : num(e.size, 0.24),
		is_affiliation: e.is_affiliation === true,
		kind,
		name: str(e.name),
		full_path: str(e.full_path) ?? null,
		mask_path: str(e.mask_path) ?? null,
		thumb_path: str(e.thumb_path) ?? null,
		art_aspect: e.art_aspect == null ? null : num(e.art_aspect, 1),
		glyph: str(e.glyph) ?? null,
		fandom_id: str(e.fandom_id) ?? null,
		label: str(e.label),
		style_category:
			kind === 'fandom'
				? styleCategoryOf({
						id: str(e.fandom_id) ?? stickerId,
						name: str(e.label) ?? str(e.name) ?? stickerId,
						style_category: style
					})
				: undefined
	};
}

function affiliationFromSnapshot(input: unknown): Affiliation | null {
	const a = obj(input);
	const id = str(a.id);
	const name = str(a.name);
	if (!id || !name) return null;
	return {
		id,
		name,
		style_category: styleCategoryOf({ id, name, style_category: str(a.style_category) }),
		x: num(a.x, 0.8),
		y: num(a.y, 0.86),
		rotation: 0,
		scale: 1,
		foil: 'none'
	};
}

export function snapshotToView(snapshot: unknown): {
	view: CardView;
	ownerId: string;
	cardId: string | null;
} {
	const s = obj(snapshot);
	const owner = obj(s.owner);
	const stickers = Array.isArray(s.stickers)
		? s.stickers.map((e, i) => placedFromSnapshot(e, i))
		: [];
	const view: CardView = {
		title: String(s.title ?? owner.display_name ?? owner.username ?? 'Someone'),
		handle: String(owner.username ?? ''),
		pronouns: (str(s.pronouns) ?? null) as string | null,
		bio: String(s.bio ?? ''),
		label: null,
		art_url: str(s.art_url) ?? null,
		art_x: num(s.art_x, 0.5),
		art_y: num(s.art_y, 0.5),
		art_scale: num(s.art_scale, 1),
		style: normalizeStyle(s.style),
		// v4 carries the affiliation as a placement; CardOverlay draws that one
		// and skips this. Older snapshots only have this.
		affiliation: affiliationFromSnapshot(s.affiliation),
		// Normalised: pre-spec snapshots carry `label` where handles now live.
		links: normalizeLinks(s.links),
		stickers
	};
	return { view, ownerId: String(owner.id ?? ''), cardId: str(s.card_id) ?? null };
}

/**
 * What a collect granted, each with enough to draw it. v4 responses list
 * them; older ones name one `bonus_sticker_id`, drawn from the snapshot's copy
 * of it when there is one.
 */
export function grantsFromCollect(result: unknown): PlacedSticker[] {
	const r = obj(result);
	if (Array.isArray(r.stickers)) return r.stickers.map((g, i) => placedFromSnapshot(g, i));
	const bonus = str(r.bonus_sticker_id);
	if (!bonus) return [];
	const snap = obj(r.card_snapshot);
	const onCard = Array.isArray(snap.stickers)
		? snap.stickers.find((e) => obj(e).sticker_id === bonus)
		: undefined;
	return [placedFromSnapshot({ ...obj(onCard), sticker_id: bonus, foil: r.bonus_foil })];
}
