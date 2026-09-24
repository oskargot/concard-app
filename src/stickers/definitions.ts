/**
 * What a sticker *is*, from whatever describes it.
 *
 * Placements (live, joined with `stickers`) and v4 snapshots carry the
 * definition's fields themselves; `definitionForPlacement` turns them into a
 * `StickerDefinition` the renderer can draw. For deco art it falls back to the
 * bundled fixture with the same id (the same bake, so the same pixels), then
 * to the prototype emoji glyph, so older placements and snapshots still draw.
 */

import type { PlacedSticker } from '@/card/types';
import { stickerAsset } from './assets';
import { styleCategoryForFandom } from './fandom-styles';
import { FIXTURE_STICKERS, type FixtureSticker } from './fixtures.generated';
import {
	FANDOM_STYLE_CATEGORIES,
	type DecoStickerDefinition,
	type FandomStickerDefinition,
	type FandomStyleCategory,
	type StickerDefinition
} from './types';

const FIXTURES_BY_ID = new Map<string, FixtureSticker>(FIXTURE_STICKERS.map((f) => [f.id, f]));

/** The prototype emoji stickers, for ids that have no baked art anywhere. */
const LEGACY_GLYPHS: Record<string, string> = {
	star: '⭐',
	cat: '🐱',
	dragon: '🐉',
	rainbow: '🌈',
	heart: '❤️',
	fire: '🔥',
	rocket: '🚀',
	dice: '🎲',
	crown: '👑',
	sushi: '🍣',
	sparkles: '✨',
	ufo: '🛸'
};

/** Fandom stickers are the `stickers` rows `fandom-<fandoms.id>`. */
export const FANDOM_STICKER_PREFIX = 'fandom-';

export function fandomStickerId(fandomId: string): string {
	return `${FANDOM_STICKER_PREFIX}${fandomId}`;
}

export function isFandomStickerId(id: string): boolean {
	return id.startsWith(FANDOM_STICKER_PREFIX);
}

function isStyleCategory(value: unknown): value is FandomStyleCategory {
	return FANDOM_STYLE_CATEGORIES.includes(value as FandomStyleCategory);
}

export interface DecoFields {
	id: string;
	name?: string | null;
	full_path?: string | null;
	mask_path?: string | null;
	thumb_path?: string | null;
	art_aspect?: number | null;
	glyph?: string | null;
}

export function decoDefinition(row: DecoFields): DecoStickerDefinition {
	const fixture = FIXTURES_BY_ID.get(row.id);
	const paths = row.full_path ? row : fixture;
	const full = stickerAsset(paths?.full_path);
	const mask = stickerAsset(paths?.mask_path);
	const thumb = stickerAsset(paths?.thumb_path);
	return {
		id: row.id,
		name: row.name ?? fixture?.name ?? titleCase(row.id),
		kind: 'deco',
		assets:
			full && mask && thumb ? { full, mask, thumb, aspect: Number(paths?.art_aspect) || 1 } : null,
		glyph: row.glyph ?? LEGACY_GLYPHS[row.id] ?? null
	};
}

export interface FandomFields {
	id: string;
	label?: string | null;
	name?: string | null;
	fandom_id?: string | null;
	style_category?: string | null;
}

export function fandomDefinition(row: FandomFields): FandomStickerDefinition {
	const label = row.label ?? row.name ?? row.id.replace(FANDOM_STICKER_PREFIX, '');
	return {
		id: row.id,
		name: label,
		kind: 'fandom',
		label,
		styleCategory: isStyleCategory(row.style_category)
			? row.style_category
			: styleCategoryForFandom({ id: row.fandom_id ?? row.id, name: label })
	};
}

export function definitionForPlacement(placed: PlacedSticker): StickerDefinition {
	const kind = placed.kind ?? (isFandomStickerId(placed.sticker_id) ? 'fandom' : 'deco');
	if (kind === 'fandom') {
		return fandomDefinition({
			id: placed.sticker_id,
			label: placed.label,
			name: placed.name,
			fandom_id: placed.fandom_id,
			style_category: placed.style_category
		});
	}
	return decoDefinition({
		id: placed.sticker_id,
		name: placed.name,
		full_path: placed.full_path,
		mask_path: placed.mask_path,
		thumb_path: placed.thumb_path,
		art_aspect: placed.art_aspect,
		glyph: placed.glyph
	});
}

function titleCase(id: string): string {
	return id.replace(
		/(^|-)([a-z])/g,
		(_m, sep: string, c: string) => (sep ? ' ' : '') + c.toUpperCase()
	);
}
