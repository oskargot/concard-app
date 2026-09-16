/**
 * Visual recipes for generative fandom stickers.
 *
 * Each category is a Concard type treatment (bundled font + fill + outline +
 * tracking), not a franchise logo. New fandoms pick a category; they do not
 * bring their own artwork. Recipes stay restrained in Stage 1: typography,
 * stroke, a small rotation/skew bias, a bar behind every word, and a vinyl
 * join between stacked lines.
 */

import { font } from '@/theme/tokens';
import {
	FANDOM_STYLE_CATEGORIES,
	type FandomCase,
	type FandomStyleCategory,
	type FandomStickerDefinition
} from './types';

export interface FandomStyleRecipe {
	fontFamily: string;
	fill: string;
	/** Coloured letter outline sitting inside the white die-cut rim. */
	outline: string;
	/** Letter-outline thickness as a fraction of font size. */
	outlineWidthRatio: number;
	/** White vinyl rim as a fraction of font size. */
	dieCutWidthRatio: number;
	/** Extra tracking as a fraction of font size (may be negative). */
	letterSpacingRatio: number;
	case: FandomCase;
	/** SVG `skewX`, in degrees. */
	skewX: number;
	/** Resting rotation, in degrees. */
	rotationBias: number;
	/** Line box as a fraction of font size. */
	lineHeightRatio: number;
	/** Cap on font size as a fraction of the sticker's target width. */
	maxFontRatio: number;
}

export const DIE_CUT_FILL = '#ffffff';

export const FANDOM_STYLE_LABELS: Record<FandomStyleCategory, string> = {
	'retro-sci-fi': 'Retro sci-fi',
	cute: 'Cute',
	fantasy: 'Fantasy',
	action: 'Action',
	horror: 'Horror',
	tech: 'Tech',
	general: 'General'
};

export const FANDOM_STYLE_RECIPES: Record<FandomStyleCategory, FandomStyleRecipe> = {
	'retro-sci-fi': {
		fontFamily: font.bodyBold,
		fill: '#45E5D5',
		outline: '#120720',
		outlineWidthRatio: 0.055,
		dieCutWidthRatio: 0.13,
		letterSpacingRatio: 0.1,
		case: 'upper',
		skewX: 0,
		rotationBias: -3,
		lineHeightRatio: 1.05,
		maxFontRatio: 0.42
	},
	cute: {
		fontFamily: font.display,
		fill: '#FF4D97',
		outline: '#5B1238',
		outlineWidthRatio: 0.08,
		dieCutWidthRatio: 0.18,
		letterSpacingRatio: 0.02,
		case: 'title',
		skewX: 0,
		rotationBias: 5,
		lineHeightRatio: 1.02,
		maxFontRatio: 0.5
	},
	fantasy: {
		fontFamily: font.displaySemi,
		fill: '#FFD98A',
		outline: '#3A1760',
		outlineWidthRatio: 0.07,
		dieCutWidthRatio: 0.15,
		letterSpacingRatio: 0.055,
		case: 'title',
		skewX: 0,
		rotationBias: -2,
		lineHeightRatio: 1.06,
		maxFontRatio: 0.46
	},
	action: {
		fontFamily: font.bodyBold,
		fill: '#FF6A3D',
		outline: '#120720',
		outlineWidthRatio: 0.09,
		dieCutWidthRatio: 0.14,
		letterSpacingRatio: -0.015,
		case: 'upper',
		skewX: -11,
		rotationBias: -6,
		lineHeightRatio: 1.02,
		maxFontRatio: 0.48
	},
	horror: {
		fontFamily: font.bodyMedium,
		fill: '#F7F0E4',
		outline: '#1A0B2E',
		outlineWidthRatio: 0.05,
		dieCutWidthRatio: 0.13,
		letterSpacingRatio: -0.02,
		case: 'upper',
		skewX: 0,
		rotationBias: 7,
		lineHeightRatio: 1.02,
		maxFontRatio: 0.4
	},
	tech: {
		fontFamily: font.bodyMedium,
		fill: '#9FFFD2',
		outline: '#0B3D38',
		outlineWidthRatio: 0.04,
		dieCutWidthRatio: 0.11,
		letterSpacingRatio: 0.14,
		case: 'upper',
		skewX: 0,
		rotationBias: 0,
		lineHeightRatio: 1.08,
		maxFontRatio: 0.38
	},
	general: {
		fontFamily: font.display,
		fill: '#F7F0E4',
		outline: '#C93878',
		outlineWidthRatio: 0.07,
		dieCutWidthRatio: 0.16,
		letterSpacingRatio: 0.045,
		case: 'upper',
		skewX: 0,
		rotationBias: -4,
		lineHeightRatio: 1.04,
		maxFontRatio: 0.48
	}
};

export function recipeFor(category: FandomStyleCategory): FandomStyleRecipe {
	return FANDOM_STYLE_RECIPES[category];
}

/**
 * Pick a Concard style category for a live fandom row.
 *
 * The shared `fandoms` table does not yet carry `style_category`; until that
 * ships, freeze a stable client-side assignment into `Affiliation` so snapshots
 * stay reproducible. Keyword hints keep familiar titles in a sensible lane;
 * everything else hashes the id across the category list.
 */
export function styleCategoryForFandom(fandom: { id: string; name: string }): FandomStyleCategory {
	const hinted = hintStyleCategory(fandom.name);
	if (hinted) return hinted;
	return FANDOM_STYLE_CATEGORIES[stableIndex(fandom.id, FANDOM_STYLE_CATEGORIES.length)];
}

function hintStyleCategory(name: string): FandomStyleCategory | null {
	const n = name.toLowerCase();
	if (/\b(trek|who|wars|dune|alien|blade runner|evangelion|cyber|sci-?fi)\b/.test(n)) {
		return 'retro-sci-fi';
	}
	if (/\b(pok[eé]mon|splatoon|sanrio|aggretsuko|cute|kawaii)\b/.test(n)) return 'cute';
	if (/\b(zelda|fantasy|dnd|d&d|meshi|witch|elf|dragon)\b/.test(n)) return 'fantasy';
	if (/\b(gate|action|fighter|naruto|one piece|jojo)\b/.test(n)) return 'action';
	if (/\b(horror|scary|slasher|resident evil|silent hill)\b/.test(n)) return 'horror';
	if (/\b(tech|robot|cyberpunk|programming|hack)\b/.test(n)) return 'tech';
	if (/\b(anime|manga|homestuck|doctor)\b/.test(n)) return 'general';
	return null;
}

function stableIndex(value: string, modulo: number): number {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return modulo === 0 ? 0 : (hash >>> 0) % modulo;
}

/** Stable-enough playground / preview ids; the catalog will own real ids later. */
export function makeFandomDefinition(
	label: string,
	styleCategory: FandomStyleCategory
): FandomStickerDefinition {
	const trimmed = label.replace(/\s+/g, ' ').trim() || 'Fandom';
	return {
		id: `fandom:${styleCategory}:${slugifyFandomLabel(trimmed)}`,
		name: trimmed,
		kind: 'fandom',
		label: trimmed,
		styleCategory
	};
}

/** Turn a frozen affiliation into the definition `StickerRenderer` expects. */
export function definitionFromAffiliation(affiliation: {
	id: string;
	name: string;
	style_category: FandomStyleCategory;
}): FandomStickerDefinition {
	return {
		id: affiliation.id,
		name: affiliation.name,
		kind: 'fandom',
		label: affiliation.name,
		styleCategory: affiliation.style_category
	};
}

export function slugifyFandomLabel(label: string): string {
	const slug = label
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'fandom';
}
