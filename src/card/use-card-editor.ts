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
import { linksToJson, normalizeLinks } from './links';
import type { CardLink, CardView } from './types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type CardRow = Database['public']['Tables']['cards']['Row'];
type CardUpdate = Database['public']['Tables']['cards']['Update'];
type Fandom = Database['public']['Tables']['fandoms']['Row'];

/** Long enough that typing a bio is one write, short enough to feel automatic. */
const SAVE_DELAY = 800;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

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
		links: normalizeLinks(card.links),
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
	set: (patch: Partial<CardDraft>) => void;
	setStyle: (patch: Partial<CardStyle>) => void;
	/** Write immediately rather than waiting out the debounce — used on the way out. */
	flush: () => Promise<void>;
	dismissError: () => void;
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

	/** The newest draft, readable from a timer without re-arming it on every keystroke. */
	const latest = useRef<CardDraft | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	/** Suppresses the save that loading the card would otherwise trigger. */
	const dirty = useRef(false);
	/** Set once the `links` column turns out to be missing, so we stop sending it. */
	const noLinksColumn = useRef(false);

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

		const { links, ...rest } = toRow(current, owner);
		const payload: CardUpdate = noLinksColumn.current ? rest : { ...rest, links };

		let { error: err } = await supabase.from('cards').update(payload).eq('id', cardId);

		// The `links` column ships in a migration this repo does not own (see
		// supabase/migrations/20260915000000). Until it is applied, drop that one
		// field and save the rest rather than failing every write — the editor is
		// still worth having for style, photo and text on the day before.
		if (err && isMissingLinksColumn(err)) {
			setLinksBlocked(true);
			noLinksColumn.current = true;
			({ error: err } = await supabase.from('cards').update(rest).eq('id', cardId));
		}

		if (err) {
			// Failed: the draft is still unsaved, so the next change must retry it.
			dirty.current = true;
			setSaveState('error');
			setError(err.hint ?? err.message);
			return;
		}

		setSaveState('saved');
		// A save that works clears whatever the last failure said, or the screen
		// would go on showing an error about work that has since gone through.
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
		set,
		setStyle,
		flush,
		dismissError: useCallback(() => setError(null), [])
	};
}

/** PostgREST's two ways of saying the column isn't there yet. */
function isMissingLinksColumn(err: { code?: string; message?: string }): boolean {
	if (err.code === 'PGRST204' || err.code === '42703') return true;
	return /column .*links.* does not exist/i.test(err.message ?? '');
}
