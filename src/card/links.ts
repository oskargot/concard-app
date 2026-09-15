/**
 * Reading and writing the card's link chips.
 *
 * The same shape on both sides of the wire as `card-style.ts` handles for
 * style: `normalizeLinks` takes untrusted JSON out of the `cards.links` column
 * and `linksToJson` puts a valid array back, so a row written by the web app,
 * an older app build, or a hand-edited jsonb can never crash the renderer.
 *
 * The caps here mirror the `cards_links_valid` check constraint
 * (`supabase/migrations/20260915000000_card_links_and_art.sql`) — if one moves,
 * the other has to move with it, or the editor will happily compose a value the
 * database then rejects.
 */

import type { CardLink } from './types';

/** Also the constraint's limit. `CardFace` draws three and rolls the rest into "+N more". */
export const MAX_LINKS = 6;
export const LINK_LABEL_MAX = 40;
export const LINK_URL_MAX = 300;

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Read a link list out of untrusted JSON, dropping anything malformed. */
export function normalizeLinks(input: unknown): CardLink[] {
	if (!Array.isArray(input)) return [];
	const out: CardLink[] = [];
	for (const raw of input) {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
		const e = raw as Record<string, unknown>;
		// A link with no url is not a link. A missing label is fine — the face
		// falls back to the bare domain, same as the web card.
		if (!isNonEmpty(e.url)) continue;
		out.push({
			label: typeof e.label === 'string' ? e.label.slice(0, LINK_LABEL_MAX) : '',
			url: e.url.trim().slice(0, LINK_URL_MAX),
			icon: isNonEmpty(e.icon) ? e.icon : null
		});
		if (out.length === MAX_LINKS) break;
	}
	return out;
}

/**
 * The list as plain records, for writing to the `links` jsonb column.
 *
 * Same reason `styleToJson` exists: `CardLink` is a closed interface, which
 * Supabase's `Json` type rejects for having no index signature. Naming every
 * key explicitly also means a field added to `CardLink` can't be silently
 * dropped on the way to the database — it won't compile until it's handled.
 *
 * Rows with a blank url are dropped rather than sent: the editor keeps empty
 * rows around as a place to type, and those are drafts, not links.
 */
export function linksToJson(links: CardLink[]): Record<string, string | null>[] {
	return links
		.filter((l) => l.url.trim().length > 0)
		.slice(0, MAX_LINKS)
		.map((l) => ({
			label: l.label.trim().slice(0, LINK_LABEL_MAX),
			url: normalizeUrl(l.url).slice(0, LINK_URL_MAX),
			icon: l.icon ?? null
		}));
}

/**
 * What someone typed, as something openable.
 *
 * People type `instagram.com/name`, not `https://instagram.com/name`. Assuming
 * https is right far more often than it is wrong, and leaving a scheme-less
 * string in the column would hand the web card a relative href.
 */
export function normalizeUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) return '';
	// mailto:, tel: and friends are already complete; only a bare host needs help.
	if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
	return `https://${trimmed.replace(/^\/+/, '')}`;
}

/** The short form shown on a chip when a link has no label of its own. */
export function displayUrl(url: string): string {
	return url
		.trim()
		.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
		.replace(/^www\./i, '')
		.replace(/\/+$/, '');
}

/** An empty row for the editor to render — a place to type, not yet a link. */
export const blankLink = (): CardLink => ({ label: '', url: '', icon: null });
