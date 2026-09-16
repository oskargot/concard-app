/**
 * Deterministic layout for generative fandom stickers.
 *
 * Measures with the bundled font advance tables (not on-layout callbacks) so
 * a given name + category + width always produces the same SVG. Long names
 * wrap up to three lines when that keeps type larger; otherwise the font
 * shrinks to fit. The viewBox is the axis-aligned bounds of the stroked,
 * skewed, rotated letterforms so the white rim is never clipped.
 */

import { FONT_METRICS, glyphAdvance } from './font-metrics';
import { DIE_CUT_FILL, type FandomStyleRecipe } from './fandom-styles';
import type { FandomCase } from './types';

const MAX_LINES = 3;
const MIN_FONT = 4;
const SIZE_ITERS = 5;

export interface FandomLaidLine {
	text: string;
	width: number;
	x: number;
	baseline: number;
}

/** White vinyl rectangle — behind a word, or joining stacked lines. */
export interface FandomVinylRect {
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
}

export interface FandomLayout {
	lines: FandomLaidLine[];
	/**
	 * Smaller than the letters, painted behind every word so gaps inside
	 * Homestuck / Zelda / etc. fill without reading as a label plate.
	 */
	bars: FandomVinylRect[];
	/** Fills the hole between stacked lines. Empty when there is only one line. */
	joins: FandomVinylRect[];
	fontFamily: string;
	fontSize: number;
	letterSpacing: number;
	fill: string;
	outline: string;
	dieCut: string;
	/** Centred stroke used for the white vinyl blob. */
	whiteStroke: number;
	/** Centred stroke used for the coloured letter outline. */
	colorStroke: number;
	rotation: number;
	skewX: number;
	/** Centre of the untransformed letter box — SVG rotate/skew origin. */
	origin: { x: number; y: number };
	viewBox: { x: number; y: number; width: number; height: number };
	shadow: { dx: number; dy: number; color: string };
}

const SMALL_TITLE_WORDS = new Set(['a', 'an', 'and', 'of', 'the', 'to', 'for', 'in', 'on', 'vs']);

export function applyFandomCase(text: string, treatment: FandomCase): string {
	const trimmed = text.replace(/\s+/g, ' ').trim();
	if (!trimmed) return '';
	if (treatment === 'upper') return trimmed.toUpperCase();
	if (treatment === 'lower') return trimmed.toLowerCase();
	if (treatment === 'preserve') return trimmed;
	return trimmed
		.split(' ')
		.map((word, index) => titleWord(word, index === 0))
		.join(' ');
}

function titleWord(word: string, first: boolean): string {
	if (!word) return word;
	// Keep roman numerals and other short all-caps tokens (XIV, BG3) intact.
	if (word.length > 1 && /^[IVXLCDM]+$/i.test(word)) return word.toUpperCase();
	if (word.length <= 5 && word === word.toUpperCase() && /\d/.test(word)) return word;
	const lower = word.toLocaleLowerCase();
	if (!first && SMALL_TITLE_WORDS.has(lower)) return lower;
	return (word[0]?.toLocaleUpperCase() ?? '') + word.slice(1).toLocaleLowerCase();
}

export function measureLine(
	text: string,
	fontSize: number,
	fontFamily: string,
	letterSpacingRatio: number
): number {
	if (!text) return 0;
	let em = 0;
	let count = 0;
	for (const ch of text) {
		em += glyphAdvance(fontFamily, ch);
		count += 1;
	}
	em += letterSpacingRatio * Math.max(0, count - 1);
	return em * fontSize;
}

export function layoutFandomSticker(
	label: string,
	recipe: FandomStyleRecipe,
	width: number
): FandomLayout | null {
	const display = applyFandomCase(label, recipe.case);
	if (!display || width <= 1) return null;

	const words = display.split(' ').filter(Boolean);
	if (!words.length) return null;

	const readable = Math.max(12, width * 0.16);
	let best: FandomLayout | null = null;
	const maxParts = Math.min(MAX_LINES, words.length);

	for (let parts = 1; parts <= maxParts; parts++) {
		let bestAtParts: FandomLayout | null = null;
		for (const texts of wordPartitions(words, parts)) {
			const layout = layoutFromLines(texts, recipe, width);
			if (!layout) continue;
			if (!bestAtParts || layout.fontSize > bestAtParts.fontSize) bestAtParts = layout;
		}
		if (!bestAtParts) continue;
		if (!best || prefersLayout(bestAtParts, best, readable)) best = bestAtParts;
		if (best.fontSize >= readable) break;
	}

	return best;
}

/** Prefer fewer lines once type is readable; otherwise take the larger type. */
function prefersLayout(next: FandomLayout, prev: FandomLayout, readable: number): boolean {
	const nextOk = next.fontSize >= readable;
	const prevOk = prev.fontSize >= readable;
	if (nextOk !== prevOk) return nextOk;
	if (nextOk && next.lines.length !== prev.lines.length) {
		return next.lines.length < prev.lines.length;
	}
	return next.fontSize > prev.fontSize;
}

/** Every way to split `words` into `parts` non-empty contiguous groups. */
function wordPartitions(words: string[], parts: number): string[][] {
	if (parts < 1 || words.length < parts) return [];
	if (parts === 1) return [[words.join(' ')]];
	const out: string[][] = [];
	const maxTake = words.length - (parts - 1);
	for (let take = 1; take <= maxTake; take++) {
		const head = words.slice(0, take).join(' ');
		for (const rest of wordPartitions(words.slice(take), parts - 1)) {
			out.push([head, ...rest]);
		}
	}
	return out;
}

function layoutFromLines(
	texts: string[],
	recipe: FandomStyleRecipe,
	width: number
): FandomLayout | null {
	const maxFont = Math.max(MIN_FONT, width * (recipe.maxFontRatio || 0.45));
	const longestEm = Math.max(
		...texts.map((text) => measureLine(text, 1, recipe.fontFamily, recipe.letterSpacingRatio))
	);
	if (longestEm <= 0) return null;

	let fontSize = maxFont;
	for (let i = 0; i < SIZE_ITERS; i++) {
		const { whiteStroke } = strokeFor(fontSize, recipe);
		const inner = Math.max(8, width - whiteStroke - Math.abs(fontSize * 0.08));
		fontSize = Math.min(maxFont, Math.max(MIN_FONT, inner / longestEm));
	}

	let layout = assembleLayout(texts, recipe, fontSize);
	if (!layout) return null;
	if (layout.viewBox.width > width + 0.05) {
		const scaled = fontSize * (width / layout.viewBox.width);
		layout = assembleLayout(texts, recipe, Math.max(MIN_FONT, scaled));
	}
	return layout;
}

function strokeFor(fontSize: number, recipe: FandomStyleRecipe) {
	const outline = Math.max(0.55, fontSize * recipe.outlineWidthRatio);
	const dieCut = Math.max(1.8, fontSize * recipe.dieCutWidthRatio);
	return {
		outline,
		dieCut,
		colorStroke: outline * 2,
		whiteStroke: 2 * (outline + dieCut)
	};
}

function assembleLayout(
	texts: string[],
	recipe: FandomStyleRecipe,
	fontSize: number
): FandomLayout | null {
	const metrics = FONT_METRICS[recipe.fontFamily];
	const ascender = metrics?.ascender ?? 0.95;
	const descender = metrics?.descender ?? -0.25;
	const { colorStroke, whiteStroke } = strokeFor(fontSize, recipe);

	const lineHeight = fontSize * recipe.lineHeightRatio;
	const emHeight = fontSize * (ascender - descender);
	const lineWidths = texts.map((text) =>
		measureLine(text, fontSize, recipe.fontFamily, recipe.letterSpacingRatio)
	);
	const contentWidth = Math.max(...lineWidths, 0);
	const contentHeight = emHeight + Math.max(0, texts.length - 1) * lineHeight;
	if (contentWidth <= 0 || contentHeight <= 0) return null;

	const pad = whiteStroke / 2 + 1.2;
	const shadowDx = Math.max(1.1, fontSize * 0.045);
	const shadowDy = Math.max(1.6, fontSize * 0.075);

	const lines: FandomLaidLine[] = texts.map((text, i) => {
		const lineWidth = lineWidths[i] ?? 0;
		return {
			text,
			width: lineWidth,
			x: (contentWidth - lineWidth) / 2,
			baseline: i * lineHeight + fontSize * ascender
		};
	});
	const joins = stackJoins(lines, fontSize, whiteStroke);
	const bars = wordBars(
		lines,
		fontSize,
		recipe.fontFamily,
		recipe.letterSpacingRatio * fontSize,
		whiteStroke
	);

	const cx = contentWidth / 2;
	const cy = contentHeight / 2;
	const untransformed = {
		x: -pad,
		y: -pad,
		width: contentWidth + pad * 2 + shadowDx,
		height: contentHeight + pad * 2 + shadowDy
	};
	const viewBox = transformedAabb(untransformed, cx, cy, recipe.rotationBias, recipe.skewX);

	return {
		lines,
		bars,
		joins,
		fontFamily: recipe.fontFamily,
		fontSize,
		letterSpacing: recipe.letterSpacingRatio * fontSize,
		fill: recipe.fill,
		outline: recipe.outline,
		dieCut: DIE_CUT_FILL,
		whiteStroke,
		colorStroke,
		rotation: recipe.rotationBias,
		skewX: recipe.skewX,
		origin: { x: cx, y: cy },
		viewBox,
		shadow: { dx: shadowDx, dy: shadowDy, color: 'rgba(18, 7, 32, 0.38)' }
	};
}

const CAP_HEIGHT = 0.7;

/**
 * A bar through the middle of each word, shorter and narrower than the
 * letter box so it only shows in the holes between glyphs. One-letter marks
 * (X) skip it — there is no gap to fill.
 */
function wordBars(
	lines: FandomLaidLine[],
	fontSize: number,
	fontFamily: string,
	letterSpacing: number,
	whiteStroke: number
): FandomVinylRect[] {
	const insetX = Math.max(whiteStroke * 0.4, fontSize * 0.18);
	const cap = fontSize * CAP_HEIGHT;
	const height = cap * 0.56;
	const insetTop = (cap - height) / 2;
	if (height < fontSize * 0.14) return [];

	const bars: FandomVinylRect[] = [];
	for (const line of lines) {
		for (const word of wordsOnLine(line, fontSize, fontFamily, letterSpacing)) {
			const width = word.width - insetX * 2;
			if (width < fontSize * 0.14) continue;
			bars.push({
				x: word.x + insetX,
				y: line.baseline - cap + insetTop,
				width,
				height,
				rx: Math.min(fontSize * 0.08, Math.min(width, height) * 0.22)
			});
		}
	}
	return bars;
}

/** Glyph-advance walk so each word's bar lines up with the SVG `Text` run. */
function wordsOnLine(
	line: FandomLaidLine,
	fontSize: number,
	fontFamily: string,
	letterSpacing: number
): { x: number; width: number }[] {
	const chars = [...line.text];
	const words: { x: number; width: number }[] = [];
	let x = line.x;
	let i = 0;
	while (i < chars.length) {
		const ch = chars[i];
		if (ch === ' ' || ch === undefined) {
			if (ch === ' ') {
				x += glyphAdvance(fontFamily, ch) * fontSize;
				if (i < chars.length - 1) x += letterSpacing;
			}
			i += 1;
			continue;
		}

		const startX = x;
		while (i < chars.length && chars[i] !== ' ') {
			x += glyphAdvance(fontFamily, chars[i]!) * fontSize;
			const last = i === chars.length - 1;
			i += 1;
			if (!last) x += letterSpacing;
		}
		let endX = x;
		if (i < chars.length && chars[i] === ' ') endX = x - letterSpacing;
		words.push({ x: startX, width: Math.max(0, endX - startX) });
	}
	return words;
}

/**
 * White vinyl between stacked lines only. Width is the shorter word, inset so
 * the bar stays inside that word's letter stroke instead of poking out as a
 * rectangle.
 */
function stackJoins(
	lines: FandomLaidLine[],
	fontSize: number,
	whiteStroke: number
): FandomVinylRect[] {
	if (lines.length < 2) return [];

	const inset = Math.max(whiteStroke * 0.32, fontSize * 0.08);
	const tuck = fontSize * 0.22;
	const joins: FandomVinylRect[] = [];

	for (let i = 1; i < lines.length; i++) {
		const above = lines[i - 1];
		const below = lines[i];
		if (!above || !below) continue;

		const overlapLeft = Math.max(above.x, below.x);
		const overlapRight = Math.min(above.x + above.width, below.x + below.width);
		const shorter = overlapRight - overlapLeft;
		const width = shorter - inset * 2;
		if (width < fontSize * 0.18) continue;

		// Sit on the cap of the lower line and tuck into both letter bodies so
		// the bar is hidden except where a gap would otherwise show through.
		const aboveBottom = above.baseline + fontSize * 0.06;
		const belowTop = below.baseline - fontSize * CAP_HEIGHT;
		const y = aboveBottom - tuck;
		const height = belowTop + tuck - y;
		if (height <= 0) continue;

		joins.push({
			x: (overlapLeft + overlapRight) / 2 - width / 2,
			y,
			width,
			height,
			rx: Math.min(fontSize * 0.12, Math.min(width, height) * 0.28)
		});
	}

	return joins;
}

function transformedAabb(
	rect: { x: number; y: number; width: number; height: number },
	cx: number,
	cy: number,
	rotationDeg: number,
	skewXDeg: number
): { x: number; y: number; width: number; height: number } {
	const corners = [
		{ x: rect.x, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y + rect.height },
		{ x: rect.x, y: rect.y + rect.height }
	].map((pt) => transformPoint(pt.x, pt.y, cx, cy, rotationDeg, skewXDeg));

	let minX = corners[0]!.x;
	let maxX = corners[0]!.x;
	let minY = corners[0]!.y;
	let maxY = corners[0]!.y;
	for (const pt of corners) {
		if (pt.x < minX) minX = pt.x;
		if (pt.x > maxX) maxX = pt.x;
		if (pt.y < minY) minY = pt.y;
		if (pt.y > maxY) maxY = pt.y;
	}

	const slack = 1.5;
	return {
		x: minX - slack,
		y: minY - slack,
		width: maxX - minX + slack * 2,
		height: maxY - minY + slack * 2
	};
}

function transformPoint(
	x: number,
	y: number,
	cx: number,
	cy: number,
	rotationDeg: number,
	skewXDeg: number
): { x: number; y: number } {
	let lx = x - cx;
	let ly = y - cy;
	lx += ly * Math.tan((skewXDeg * Math.PI) / 180);
	const r = (rotationDeg * Math.PI) / 180;
	const cos = Math.cos(r);
	const sin = Math.sin(r);
	return {
		x: lx * cos - ly * sin + cx,
		y: lx * sin + ly * cos + cy
	};
}

/** @internal exported for the playground's size math */
export function stickerHeight(layout: FandomLayout, width: number): number {
	if (layout.viewBox.width <= 0) return width * 0.4;
	return (width * layout.viewBox.height) / layout.viewBox.width;
}
