/**
 * Text measurement for the card face, from Outfit's real metrics.
 *
 * Card spec §9: every "will this fit" decision (the name's ellipsis, the pronoun
 * pill, link handles, where the bio breaks) comes from measuring the actual
 * font, never from an average character width. The card then draws exactly the
 * strings decided here — pre-ellipsised, pre-wrapped, one line per text node —
 * so iOS, Android and the web cannot each break a line in a different place.
 *
 * Widths are advance widths plus pair kerning plus tracking, which is what
 * CoreText, Android's Minikin and browsers all lay a single line out with.
 */

import { OUTFIT, type OutfitMetrics } from './outfit-metrics';

export type OutfitWeight = 400 | 600 | 700;

export interface TextFont {
	weight: OutfitWeight;
	/** Font size in design units. */
	size: number;
	/** Letter spacing in ems, applied after every character (CSS and RN both do). */
	tracking?: number;
}

export const ELLIPSIS = '…';

/**
 * Advance for a code point the table does not cover. Wide scripts and emoji
 * are roughly square; combining marks take no room of their own; anything
 * else Latin-ish gets the font's average lowercase advance.
 */
function fallbackAdvance(m: OutfitMetrics, cp: number): number {
	if (cp >= 0x0300 && cp <= 0x036f) return 0; // combining diacritics
	if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0; // ZWJ, variation selectors
	if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf)) return 1170; // emoji
	if (
		(cp >= 0x1100 && cp <= 0x115f) ||
		(cp >= 0x2e80 && cp <= 0xa4cf) ||
		(cp >= 0xac00 && cp <= 0xd7a3) ||
		(cp >= 0xf900 && cp <= 0xfaff) ||
		(cp >= 0xff00 && cp <= 0xff60)
	) {
		return 1000; // CJK, Hangul, full-width forms
	}
	return m.avg;
}

/** Width of `text` in design units. */
export function measureText(text: string, font: TextFont): number {
	const m = OUTFIT[font.weight];
	const tracking = (font.tracking ?? 0) * 1000;
	let total = 0;
	let prev = -1;
	for (const ch of text) {
		const cp = ch.codePointAt(0)!;
		total += (m.advances[cp] ?? fallbackAdvance(m, cp)) + tracking;
		if (prev >= 0) total += m.kern[prev * 65536 + cp] ?? 0;
		prev = cp;
	}
	return (total * font.size) / 1000;
}

export interface Fitted {
	text: string;
	/** True when the original did not fit and was cut. */
	truncated: boolean;
	/** Width of `text` as drawn. */
	width: number;
}

/**
 * The longest prefix of `text` that fits `maxWidth` with an ellipsis, or the
 * whole string when it already fits. Trailing spaces before the ellipsis are
 * dropped so a cut never reads "Alex …".
 */
export function ellipsize(text: string, maxWidth: number, font: TextFont): Fitted {
	const whole = measureText(text, font);
	if (whole <= maxWidth) return { text, truncated: false, width: whole };

	const chars = Array.from(text);
	// Binary search over the prefix length; width is monotonic in it apart
	// from kerning's tiny negative steps, which only ever make a prefix fit
	// one character later than a linear scan would, never earlier.
	let lo = 0;
	let hi = chars.length - 1;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		const candidate = chars.slice(0, mid).join('').trimEnd() + ELLIPSIS;
		if (measureText(candidate, font) <= maxWidth) lo = mid;
		else hi = mid - 1;
	}
	const out = lo > 0 ? chars.slice(0, lo).join('').trimEnd() + ELLIPSIS : '';
	return { text: out, truncated: true, width: out ? measureText(out, font) : 0 };
}

/**
 * Greedy word wrap into lines no wider than `maxWidth`.
 *
 * Breaks at spaces and explicit newlines; a single word wider than the line is
 * broken between characters rather than overflowing. Runs of spaces collapse
 * at a break, as they do in every text engine.
 */
export function wrapText(text: string, maxWidth: number, font: TextFont): string[] {
	const lines: string[] = [];
	for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
		const words = paragraph.split(/ +/).filter((w, i, all) => w || all.length === 1);
		let line = '';
		for (const word of words) {
			const candidate = line ? `${line} ${word}` : word;
			if (measureText(candidate, font) <= maxWidth) {
				line = candidate;
				continue;
			}
			if (line) lines.push(line);
			line = '';
			// The word alone is too wide for any line: split it by characters.
			if (measureText(word, font) > maxWidth) {
				let piece = '';
				for (const ch of word) {
					if (piece && measureText(piece + ch, font) > maxWidth) {
						lines.push(piece);
						piece = '';
					}
					piece += ch;
				}
				line = piece;
			} else {
				line = word;
			}
		}
		lines.push(line);
	}
	// A trailing newline should not leave a phantom empty last line.
	while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
	return lines;
}
