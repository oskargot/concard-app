/**
 * Reading and writing the card's links.
 *
 * The same shape on both sides of the wire as `card-style.ts` handles for
 * style: `normalizeLinks` takes untrusted JSON out of the `cards.links` column
 * (or a snapshot, or an older persisted binder) and `linksToJson` puts a valid
 * array back, so a row written by the web app, an older app build, or a
 * hand-edited jsonb can never crash the renderer.
 *
 * Card spec §8 stores a link as `url`, `handle` (user-editable, pre-filled from
 * the url) and `position`. The icon is derived from the domain when drawn and
 * never stored. Links written before the spec have a `label` instead of a
 * `handle`; it is read as the handle.
 */

import { LINKS } from './layout/spec';
import { linkInfo } from './link-platforms';
import type { CardLink } from './types';

/** Two columns of four (card spec §3.5). */
export const MAX_LINKS = LINKS.max;
/**
 * What the live `cards_links_valid` constraint allows until
 * `20260923000000_card_spec_v2.sql` raises it to 8. The editor still lets
 * someone add eight; `useCardEditor` saves the first six and says so.
 */
export const LINKS_LIVE_MAX = 6;
export const LINK_HANDLE_MAX = 40;
export const LINK_URL_MAX = 300;

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Read a link list out of untrusted JSON, dropping anything malformed. */
export function normalizeLinks(input: unknown): CardLink[] {
	if (!Array.isArray(input)) return [];
	const out: (CardLink & { order: number })[] = [];
	input.forEach((raw, i) => {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
		const e = raw as Record<string, unknown>;
		// A link with no url is not a link.
		if (!isNonEmpty(e.url)) return;
		const handle =
			typeof e.handle === 'string' ? e.handle : typeof e.label === 'string' ? e.label : '';
		out.push({
			url: e.url.trim().slice(0, LINK_URL_MAX),
			handle: handle.slice(0, LINK_HANDLE_MAX),
			order: typeof e.position === 'number' && Number.isFinite(e.position) ? e.position : i
		});
	});
	return out
		.sort((a, b) => a.order - b.order)
		.slice(0, MAX_LINKS)
		.map(({ url, handle }) => ({ url, handle }));
}

/**
 * The list as plain records, for writing to the `links` jsonb column.
 *
 * Same reason `styleToJson` exists: `CardLink` is a closed interface, which
 * Supabase's `Json` type rejects for having no index signature.
 *
 * `label` is written as a copy of the handle because the live constraint still
 * requires it, and the not-yet-ported web card still reads it.
 *
 * Rows with a blank url are dropped rather than sent: the editor keeps empty
 * rows around as a place to type, and those are drafts, not links.
 */
export function linksToJson(links: CardLink[]): Record<string, string | number>[] {
	return links
		.filter((l) => l.url.trim().length > 0)
		.slice(0, MAX_LINKS)
		.map((l, position) => {
			const handle = displayHandle(l).slice(0, LINK_HANDLE_MAX);
			return {
				url: normalizeUrl(l.url).slice(0, LINK_URL_MAX),
				handle,
				label: handle,
				position
			};
		});
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

/** The short form of a url, for accessibility labels. */
export function displayUrl(url: string): string {
	return url
		.trim()
		.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
		.replace(/^www\./i, '')
		.replace(/\/+$/, '');
}

/**
 * The text a pill shows: the handle as the user left it, or — when they
 * cleared it — what the url itself suggests, so a pill is never blank.
 */
export function displayHandle(link: CardLink): string {
	const handle = link.handle.trim();
	if (handle) return handle;
	return linkInfo(link.url)?.handle ?? displayUrl(link.url);
}

/** An empty row for the editor to render — a place to type, not yet a link. */
export const blankLink = (): CardLink => ({ url: '', handle: '' });
