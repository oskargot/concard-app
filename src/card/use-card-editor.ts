/**
 * Loads a card for editing, holds the draft, and writes it back on a debounce.
 *
 * ## Inherit vs. override
 *
 * `cards.display_name`, `pronouns` and `bio` are nullable, and null means "use
 * the profile's value" — one edit to a profile then moves every card that never
 * disagreed with it. The editor has to preserve that, but it also has to show
 * something in the field, so the draft always carries the *resolved* text and
 * `toRow` decides on the way out: a value equal to the profile's is written back
 * as null. Clearing a field you had overridden therefore returns it to
 * inheriting rather than pinning an empty string, which is what someone
 * retyping their own name would otherwise get stuck with.
 *
 * ## Autosave
 *
 * There is no save button (it is not in the design), so every change schedules a
 * write `SAVE_DELAY` later and each new change pushes that out. The whole
 * editable row goes in one update rather than a per-field diff: it is one user
 * editing one of their own cards, so there is no writer to race, and a single
 * statement can't leave the row half-written if the app is backgrounded.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { affiliationFor } from './card-view';
import { normalizeStyle, styleToJson, type CardStyle } from './card-style';
import { LINKS_LIVE_MAX, linksToJson, normalizeLinks } from './links';
import type { CardLink, CardView } from './types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type CardRow = Database['public']['Tables']['cards']['Row'];
type CardUpdate = Database['public']['Tables']['cards']['Update'];
type Fandom = Database['public']['Tables']['fandoms']['Row'];

/** Long enough that typing a bio is one write, short enough to feel automatic. */
const SAVE_DELAY = 800;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * The fandom the database has for this card, as of the last save that landed.
 * Saving a different one makes the server replace the affiliation's placement
 * row (a new id, rotation 0, scale 1), and `rev` counts those replacements, so
 * the sticker editor knows when to read the new row back.
 */
export interface SavedAffiliation {
	value: string | null;
	rev: number;
}

export interface CardDraft {
	/** Resolved for display; `toRow` converts back to null when it matches the profile. */
	display_name: string;
	pronouns: string;
	bio: string;
	/** The user's own name for the card. Never inherited — null is simply "unnamed". */
	label: string;
	art_url: string | null;
	art_x: number;
	art_y: number;
	art_scale: number;
	style: CardStyle;
	links: CardLink[];
	affiliation: string | null;
	affiliation_x: number;
	affiliation_y: number;
}

function toDraft(card: CardRow, profile: Profile): CardDraft {
	return {
		display_name: card.display_name ?? profile.display_name,
		pronouns: card.pronouns ?? profile.pronouns ?? '',
		bio: card.bio ?? profile.bio ?? '',
		label: card.label ?? '',
		art_url: card.art_url,
		art_x: card.art_x,
		art_y: card.art_y,
		art_scale: card.art_scale,
		style: normalizeStyle(card.style),
		links: normalizeLinks(
			'links' in card && card.links != null ? card.links : (profile.links ?? [])
		),
		affiliation: card.affiliation,
		affiliation_x: card.affiliation_x,
		affiliation_y: card.affiliation_y
	};
}

function toRow(draft: CardDraft, profile: Profile) {
	// Blank collapses to null, and so does a value identical to the profile's:
	// both mean "I am not saying anything different from my profile here".
	const override = (value: string, inherited: string | null) => {
		const v = value.trim();
		if (!v) return null;
		return v === (inherited ?? '').trim() ? null : v;
	};

	return {
		display_name: override(draft.display_name, profile.display_name),
		pronouns: override(draft.pronouns, profile.pronouns),
		bio: override(draft.bio, profile.bio),
		label: draft.label.trim() || null,
		art_url: draft.art_url,
		art_x: draft.art_x,
		art_y: draft.art_y,
		art_scale: draft.art_scale,
		style: styleToJson(draft.style),
		links: linksToJson(draft.links),
		affiliation: draft.affiliation,
		affiliation_x: draft.affiliation_x,
		affiliation_y: draft.affiliation_y
	};
}

export interface CardEditor {
	loading: boolean;
	/** Null until the card and profile have both loaded. */
	draft: CardDraft | null;
	cardId: string | null;
	view: CardView | null;
	fandoms: Fandom[];
	saveState: SaveState;
	error: string | null;
	/** True once a save proves `cards.links` is missing — links won't persist yet. */
	linksBlocked: boolean;
	/** True once the live links constraint rejected more than `LINKS_LIVE_MAX`
	 *  links, so only the first six are being saved. */
	linksCapped: boolean;
	set: (patch: Partial<CardDraft>) => void;
	setStyle: (patch: Partial<CardStyle>) => void;
	/** Write immediately rather than waiting out the debounce — used on the way out. */
	flush: () => Promise<void>;
	dismissError: () => void;
	/** Null until the card loads, and always on-device (nothing is replaced there). */
	savedAffiliation: SavedAffiliation | null;
}

export function useCardEditor(cardId: string | null, profile: Profile | null): CardEditor {
	const [loading, setLoading] = useState(true);
	const [draft, setDraft] = useState<CardDraft | null>(null);
	const [fandoms, setFandoms] = useState<Fandom[]>([]);
	const [saveState, setSaveState] = useState<SaveState>('idle');
	const [error, setError] = useState<string | null>(null);
	/**
	 * Kept apart from `error`, which is transient and cleared by the next
	 * successful save. This one is a standing fact about the database — the
	 * migration is either applied or it isn't — and a note that erased itself a
	 * second after appearing would be worse than none.
	 */
	const [linksBlocked, setLinksBlocked] = useState(false);
	/** Same kind of standing fact: the live constraint still caps links at six. */
	const [linksCapped, setLinksCapped] = useState(false);
	const capLinks = useRef(false);
	const [savedAffiliation, setSavedAffiliation] = useState<SavedAffiliation | null>(null);

	/** The newest draft, readable from a timer without re-arming it on every keystroke. */
	const latest = useRef<CardDraft | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	/** Suppresses the save that loading the card would otherwise trigger. */
	const dirty = useRef(false);
	/** Set once a column turns out to be missing, so we stop sending it. */
	const missingCardColumns = useRef<Set<string>>(new Set());

	/**
	 * The profile, read through a ref rather than a dependency.
	 *
	 * `AuthProvider` replaces the profile object whenever supabase-js refreshes
	 * the session, which it does on a timer and on every return from background.
	 * Depending on its identity would re-run the load below and overwrite whatever
	 * was being typed with the row as it stands in the database — losing work at
	 * an interval the user has no way to predict. Only the *presence* of a profile
	 * is a real input here, and that is a boolean.
	 */
	const profileRef = useRef(profile);
	useEffect(() => {
		profileRef.current = profile;
	}, [profile]);

	useEffect(() => {
		latest.current = draft;
	}, [draft]);

	// Whether the card can be loaded yet. Derived rather than pushed into state
	// from the effect: "no card id" is a fact about the arguments, and "waiting on
	// the profile" is a fact about the profile — neither needs a render to settle.
	const hasProfile = !!profile;
	const ready = !!supabase && !!cardId && hasProfile;
	const waiting = !!cardId && !ready;

	// Load the card, plus the fandom list the affiliation row picks from.
	useEffect(() => {
		const owner = profileRef.current;
		if (!supabase || !cardId || !owner) return;
		const client = supabase;
		let active = true;

		(async () => {
			const [card, fandomList] = await Promise.all([
				client.from('cards').select('*').eq('id', cardId).maybeSingle(),
				client.from('fandoms').select('*').eq('is_active', true).order('sort_order')
			]);
			if (!active) return;

			if (card.error) {
				setError(card.error.hint ?? card.error.message);
			} else if (card.data) {
				dirty.current = false;
				setDraft(toDraft(card.data as CardRow, owner));
				setSavedAffiliation({ value: (card.data as CardRow).affiliation, rev: 0 });
			} else {
				// No row and no error: deleted, or not this user's. Say so rather than
				// leave the screen spinning on a draft that will never arrive.
				setError('That card could not be found.');
			}
			// A missing fandom table is not worth blocking the editor over — the
			// affiliation row just has nothing to offer.
			if (!fandomList.error && fandomList.data) setFandoms(fandomList.data as Fandom[]);
			setLoading(false);
		})();

		return () => {
			active = false;
		};
	}, [cardId, hasProfile]);

	const save = useCallback(async () => {
		const current = latest.current;
		const owner = profileRef.current;
		if (!supabase || !cardId || !owner || !current || !dirty.current) return;

		dirty.current = false;
		setSaveState('saving');

		const row = toRow(current, owner);
		const payload: CardUpdate = { ...row };
		if (capLinks.current) payload.links = row.links.slice(0, LINKS_LIVE_MAX);
		for (const col of missingCardColumns.current) {
			delete payload[col as keyof CardUpdate];
		}

		let err = (await supabase.from('cards').update(payload).eq('id', cardId)).error;

		// PostgREST 204: a field in the payload is not in the live schema. Drop
		// that column and retry rather than failing the whole save — the live
		// project is behind the app types until the inherit/links migrations land.
		while (err) {
			// The live `cards_links_valid` allows six links until the card spec
			// migration raises it to eight. Save the first six rather than lose
			// every other field in the same write.
			if (isLinksCapViolation(err) && !capLinks.current && row.links.length > LINKS_LIVE_MAX) {
				capLinks.current = true;
				setLinksCapped(true);
				payload.links = row.links.slice(0, LINKS_LIVE_MAX);
				err = (await supabase.from('cards').update(payload).eq('id', cardId)).error;
				continue;
			}
			const missing = missingCardColumn(err);
			if (!missing || missingCardColumns.current.has(missing)) break;
			missingCardColumns.current.add(missing);
			if (missing === 'links') setLinksBlocked(true);
			delete payload[missing as keyof CardUpdate];
			err = (await supabase.from('cards').update(payload).eq('id', cardId)).error;
		}
		if (capLinks.current && row.links.length <= LINKS_LIVE_MAX) setLinksCapped(false);

		if (err) {
			// Failed: the draft is still unsaved, so the next change must retry it.
			dirty.current = true;
			setSaveState('error');
			setError(err.hint ?? err.message);
			return;
		}
		// The card row landed: if its fandom changed, so did its affiliation row.
		setSavedAffiliation((saved) =>
			saved && saved.value !== row.affiliation
				? { value: row.affiliation, rev: saved.rev + 1 }
				: saved
		);

		const profilePatch = profileFallback(current, missingCardColumns.current);
		if (profilePatch) {
			const { error: profileErr } = await supabase
				.from('profiles')
				.update(profilePatch)
				.eq('id', owner.id);
			if (profileErr) {
				dirty.current = true;
				setSaveState('error');
				setError(profileErr.hint ?? profileErr.message);
				return;
			}
		}

		setSaveState('saved');
		setError(null);
	}, [cardId]);

	const schedule = useCallback(() => {
		dirty.current = true;
		setSaveState('saving');
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			timer.current = null;
			void save();
		}, SAVE_DELAY);
	}, [save]);

	const set = useCallback(
		(patch: Partial<CardDraft>) => {
			setDraft((d) => {
				if (!d) return d;
				const next = { ...d, ...patch };
				latest.current = next;
				return next;
			});
			schedule();
		},
		[schedule]
	);

	const setStyle = useCallback(
		(patch: Partial<CardStyle>) => {
			setDraft((d) => {
				if (!d) return d;
				const next = { ...d, style: { ...d.style, ...patch } };
				latest.current = next;
				return next;
			});
			schedule();
		},
		[schedule]
	);

	const flush = useCallback(async () => {
		if (timer.current) {
			clearTimeout(timer.current);
			timer.current = null;
		}
		await save();
	}, [save]);

	// Leaving with a write still pending would lose it.
	useEffect(() => {
		return () => {
			if (timer.current) {
				clearTimeout(timer.current);
				timer.current = null;
				void save();
			}
		};
	}, [save]);

	const view = useMemo<CardView | null>(() => {
		if (!draft || !profile) return null;
		return {
			title: draft.display_name,
			handle: profile.username,
			pronouns: draft.pronouns || null,
			bio: draft.bio,
			label: draft.label || null,
			art_url: draft.art_url,
			art_x: draft.art_x,
			art_y: draft.art_y,
			art_scale: draft.art_scale,
			style: draft.style,
			affiliation: affiliationFor(
				draft.affiliation,
				draft.affiliation_x,
				draft.affiliation_y,
				fandoms
			),
			links: draft.links,
			stickers: []
		};
	}, [draft, profile, fandoms]);

	return {
		loading: ready ? loading : waiting,
		draft,
		cardId,
		view,
		fandoms,
		saveState,
		error,
		linksBlocked,
		linksCapped,
		set,
		setStyle,
		flush,
		dismissError: useCallback(() => setError(null), []),
		savedAffiliation
	};
}

/** A check violation (23514) on the links shape constraint. */
function isLinksCapViolation(err: { code?: string; message?: string }): boolean {
	return err.code === '23514' && /cards_links_valid/.test(err.message ?? '');
}

/** PostgREST 204 names the missing column; 42703 is the Postgres equivalent. */
function missingCardColumn(err: { code?: string; message?: string }): string | null {
	const named = /Could not find the '([^']+)' column of 'cards'/i.exec(err.message ?? '');
	if (named) return named[1];
	const pg = /column ["']?cards\.([^"'\s]+)["']? does not exist/i.exec(err.message ?? '');
	if (pg) return pg[1];
	if (err.code === 'PGRST204' || err.code === '42703') {
		const anyCol = /'([^']+)' column/i.exec(err.message ?? '');
		return anyCol?.[1] ?? null;
	}
	return null;
}

/**
 * Fields the card would have stored, written to the profile instead when the
 * live `cards` table does not have them yet. Name/bio/pronouns already live on
 * the profile as the inherit defaults; `profiles.links` is the same idea until
 * `cards.links` exists.
 */
function profileFallback(
	draft: CardDraft,
	missing: Set<string>
): Database['public']['Tables']['profiles']['Update'] | null {
	const patch: Database['public']['Tables']['profiles']['Update'] = {};
	if (missing.has('display_name') && draft.display_name.trim()) {
		patch.display_name = draft.display_name.trim();
	}
	if (missing.has('pronouns')) {
		patch.pronouns = draft.pronouns.trim() || null;
	}
	if (missing.has('bio')) {
		patch.bio = draft.bio.trim();
	}
	if (missing.has('links')) {
		patch.links = linksToJson(draft.links);
	}
	return Object.keys(patch).length ? patch : null;
}
