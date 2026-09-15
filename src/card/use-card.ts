/**
 * Reads one card for display.
 *
 * The editor has its own hook because it owns a draft and a save cycle; this is
 * the other half — screens that only need to draw a card as it currently
 * stands. Both funnel through `cardViewFrom`, so the card My Card shows and the
 * card the editor edits can never disagree about what the row means.
 *
 * Re-reads whenever `refreshKey` changes, which is how a screen picks up edits
 * made somewhere else (expo-router keeps the previous screen mounted behind a
 * push, so returning from the editor fires no mount).
 */

import { useEffect, useState } from 'react';

import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { cardViewFrom } from './card-view';
import type { CardView } from './types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type CardRow = Database['public']['Tables']['cards']['Row'];
type Fandom = Database['public']['Tables']['fandoms']['Row'];

export function useCard(
	cardId: string | null,
	profile: Profile | null,
	refreshKey?: unknown
): { view: CardView | null; loading: boolean } {
	const [view, setView] = useState<CardView | null>(null);
	const [loading, setLoading] = useState(true);

	// Whether there is anything to load at all. Derived rather than written into
	// state from the effect: with no card or no client there is no asynchronous
	// work to track, so "not loading, nothing to show" is a fact about the
	// arguments, not a result that has to be waited for.
	const enabled = !!supabase && !!cardId && !!profile;

	useEffect(() => {
		if (!supabase || !cardId || !profile) return;
		const client = supabase;
		let active = true;

		(async () => {
			const [card, fandomList] = await Promise.all([
				client.from('cards').select('*').eq('id', cardId).maybeSingle(),
				client.from('fandoms').select('*').eq('is_active', true).order('sort_order')
			]);
			if (!active) return;

			// A card that won't load leaves the previous view in place rather than
			// blanking the screen — on hall wifi a dropped request is routine.
			if (!card.error && card.data) {
				const fandoms = (!fandomList.error && (fandomList.data as Fandom[])) || [];
				setView(cardViewFrom(card.data as CardRow, profile, fandoms));
			}
			setLoading(false);
		})();

		return () => {
			active = false;
		};
	}, [cardId, profile, refreshKey]);

	return enabled ? { view, loading } : { view: null, loading: false };
}
