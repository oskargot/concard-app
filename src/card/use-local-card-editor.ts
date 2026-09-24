/**
 * The card editor's fallback when there is no Supabase card to edit: it edits
 * the on-device active card in `useConcardStore` instead.
 *
 * That happens whenever the app runs without a configured Supabase project
 * (no `.env`) or without a signed-in profile — which development builds allow,
 * since `AuthGate` stands aside in `__DEV__`. Before this existed the editor
 * waited on a client that would never arrive and spun forever. Now it edits the
 * same card Home and the Card tab draw, and the store persists it, so the
 * change is visible everywhere on this device; nothing reaches the database.
 *
 * Returns the same `CardEditor` shape as `useCardEditor`, so the screen does
 * not branch on which one it has.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useConcardStore, type EditableCard } from '../store/useConcardStore';
import { BADGE_HOME, normalizeStyle, type CardStyle } from './card-style';
import { normalizeLinks } from './links';
import type { CardView } from './types';
import type { CardDraft, CardEditor } from './use-card-editor';

function draftFrom(card: EditableCard): CardDraft {
	return {
		display_name: card.title,
		pronouns: card.pronouns ?? '',
		bio: card.bio,
		label: card.label ?? '',
		art_url: card.art_url,
		art_x: card.art_x,
		art_y: card.art_y,
		art_scale: card.art_scale,
		style: normalizeStyle(card.style),
		links: normalizeLinks(card.links),
		affiliation: card.affiliation?.id ?? null,
		affiliation_x: card.affiliation?.x ?? BADGE_HOME.x,
		affiliation_y: card.affiliation?.y ?? BADGE_HOME.y
	};
}

/** The draft as the card it describes. Blank link rows ride along; the renderer drops them. */
function viewFrom(draft: CardDraft, card: EditableCard): EditableCard {
	return {
		...card,
		title: draft.display_name,
		pronouns: draft.pronouns.trim() || null,
		bio: draft.bio,
		label: draft.label.trim() || null,
		art_url: draft.art_url,
		art_x: draft.art_x,
		art_y: draft.art_y,
		art_scale: draft.art_scale,
		style: draft.style,
		links: draft.links,
		// There is no fandom list offline, so the affiliation can only be kept,
		// moved or removed.
		affiliation:
			draft.affiliation && card.affiliation
				? { ...card.affiliation, x: draft.affiliation_x, y: draft.affiliation_y }
				: null
	};
}

export function useLocalCardEditor(enabled: boolean): CardEditor {
	const card = useConcardStore((state) => state.active_card);
	const updateActiveCard = useConcardStore((state) => state.updateActiveCard);
	const [draft, setDraft] = useState<CardDraft>(() => draftFrom(card));
	/** Skips writing the untouched draft straight back on mount. */
	const touched = useRef(false);

	// Write every change through to the store, which persists it on the device.
	useEffect(() => {
		if (!enabled || !touched.current) return;
		const { links, ...rest } = viewFrom(draft, useConcardStore.getState().active_card);
		updateActiveCard({ ...rest, links: links.filter((l) => l.url.trim()) });
	}, [draft, enabled, updateActiveCard]);

	const set = useCallback((patch: Partial<CardDraft>) => {
		touched.current = true;
		setDraft((d) => ({ ...d, ...patch }));
	}, []);

	const setStyle = useCallback((patch: Partial<CardStyle>) => {
		touched.current = true;
		setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
	}, []);

	const view = useMemo<CardView>(() => viewFrom(draft, card), [draft, card]);

	return {
		loading: false,
		draft: enabled ? draft : null,
		cardId: card.id,
		view: enabled ? view : null,
		fandoms: [],
		saveState: 'idle',
		error: null,
		linksBlocked: false,
		linksCapped: false,
		set,
		setStyle,
		flush: async () => {},
		dismissError: () => {}
	};
}
