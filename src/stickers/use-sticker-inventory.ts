/**
 * Everything the person owns, for the Stickers tab, and combining.
 *
 * Signed in with Supabase: the live inventory (./live.ts) and the
 * `combine_stickers()` RPC, which checks everything itself — two *spare*
 * copies of one sticker at one foil, below the mosaic ceiling — and never
 * trusts this screen. Otherwise: the on-device inventory, combined the same
 * way against the store, counting the on-device card's placements as in use.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { nextStickerFoil, normalizeStickerFoil, type StickerFoil } from '@/card/tiers';
import { supabase } from '@/lib/supabase';
import { useConcardStore } from '@/store/useConcardStore';
import { buildInventory, type InventoryEntry } from './inventory';
import { fetchLiveInventory } from './live';
import { LOCAL_CATALOG } from './local-catalog';

export interface StickerInventory {
	live: boolean;
	loading: boolean;
	error: string | null;
	entries: InventoryEntry[];
	/** Two spare copies → one at the next foil. Resolves to the new foil. */
	combine: (entry: InventoryEntry) => Promise<StickerFoil>;
	refresh: () => void;
}

export function canCombine(entry: InventoryEntry): boolean {
	return entry.available >= 2 && nextStickerFoil(entry.foil) !== null;
}

export function useStickerInventory(): StickerInventory {
	const { session } = useAuth();
	const userId = supabase && session ? session.user.id : null;

	const rows = useConcardStore((s) => s.sticker_inventory);
	const placed = useConcardStore((s) => s.active_card.stickers);
	const adjust = useConcardStore((s) => s.adjustStickerInventory);
	const localEntries = useMemo(() => buildInventory(rows, placed, LOCAL_CATALOG), [rows, placed]);

	const [liveEntries, setLiveEntries] = useState<InventoryEntry[]>([]);
	const [loading, setLoading] = useState(!!userId);
	const [error, setError] = useState<string | null>(null);
	const [generation, setGeneration] = useState(0);
	const refresh = useCallback(() => setGeneration((g) => g + 1), []);

	useEffect(() => {
		if (!userId) return;
		let current = true;
		fetchLiveInventory(userId).then(
			(entries) => {
				if (!current) return;
				setLiveEntries(entries);
				setError(null);
				setLoading(false);
			},
			(e: unknown) => {
				if (!current) return;
				setError(e instanceof Error ? e.message : String(e));
				setLoading(false);
			}
		);
		return () => {
			current = false;
		};
	}, [userId, generation]);

	const combine = useCallback(
		async (entry: InventoryEntry): Promise<StickerFoil> => {
			const next = nextStickerFoil(entry.foil);
			if (!next) throw new Error('That sticker is already as shiny as it gets.');
			if (userId && supabase) {
				const { data, error: rpcError } = await supabase.rpc('combine_stickers', {
					p_sticker_id: entry.sticker.id,
					p_foil: entry.foil
				});
				if (rpcError) throw new Error(rpcError.hint ?? rpcError.message);
				refresh();
				return normalizeStickerFoil((data as { foil?: unknown } | null)?.foil ?? next);
			}
			if (entry.available < 2) {
				throw new Error('You need two spare copies of the same sticker, at the same foil.');
			}
			adjust(entry.sticker.id, entry.foil, -2);
			adjust(entry.sticker.id, next, +1);
			return next;
		},
		[userId, adjust, refresh]
	);

	return {
		live: !!userId,
		loading: userId ? loading : false,
		error: userId ? error : null,
		entries: userId ? liveEntries : localEntries,
		combine,
		refresh
	};
}
