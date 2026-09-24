/**
 * The stickers on the card being edited, and the inventory they come from.
 *
 * Every change saves as it happens, like the rest of the editor — there is no
 * save button (HANDOFF §1.4). Live, that's one `sticker_placements` insert,
 * update or delete per gesture, applied optimistically and rolled back to the
 * server's state if the write is refused (the database enforces the 20 cap,
 * the scale clamp, the bounds and inventory, whatever this screen believes).
 * On-device, the store holds the placements and a local inventory.
 *
 * The affiliation is not in `placements`: it's still edited as the card's own
 * `affiliation` columns (the schema mirrors them into its free placement), so
 * the screen draws and moves it from the card view.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PlacedSticker } from '@/card/types';
import { useConcardStore } from '@/store/useConcardStore';
import { clampStickerScale, MAX_STICKERS_PER_CARD, STICKER_BASE_WIDTH } from './constants';
import { buildInventory, placementFields, type InventoryEntry } from './inventory';
import {
	deletePlacement,
	fetchCardPlacements,
	fetchLiveInventory,
	insertPlacement,
	updatePlacement
} from './live';
import { LOCAL_CATALOG } from './local-catalog';

export type PlacementPatch = Partial<
	Pick<PlacedSticker, 'x' | 'y' | 'rotation' | 'scale' | 'z_index'>
>;

export interface CardStickers {
	loading: boolean;
	error: string | null;
	/** The card's stickers, affiliation excluded. */
	placements: PlacedSticker[];
	inventory: InventoryEntry[];
	/** Under the 20-per-card cap (the affiliation counts toward it). */
	canPlace: boolean;
	place: (entry: InventoryEntry, at: { x: number; y: number }) => void;
	update: (id: string, patch: PlacementPatch) => void;
	/** Brings a sticker to the top: the last one touched is on top. */
	raise: (id: string) => void;
	/** Takes a sticker off the card; its copy goes back to the inventory. */
	remove: (id: string) => void;
	dismissError: () => void;
	/** Live, once the schema has moved the affiliation into a placement: that
	 *  row, whose rotation and scale only it stores. Null otherwise. */
	affiliationRow: PlacedSticker | null;
	updateAffiliationRow: (patch: PlacementPatch) => void;
}

export interface LiveTarget {
	cardId: string;
	userId: string;
}

/** Keeps a placement's centre on the card and its scale in the clamp. */
export function clampPlacement<T extends PlacementPatch>(patch: T): T {
	const out = { ...patch };
	if (out.x !== undefined) out.x = Math.min(1, Math.max(0, out.x));
	if (out.y !== undefined) out.y = Math.min(1, Math.max(0, out.y));
	if (out.scale !== undefined) out.scale = clampStickerScale(out.scale);
	return out;
}

export function useCardStickers({
	live,
	enabled,
	hasAffiliation
}: {
	/** The card row and its owner when editing live; null edits the on-device card. */
	live: LiveTarget | null;
	enabled: boolean;
	/** Whether the card carries an affiliation, which counts toward the cap. */
	hasAffiliation: boolean;
}): CardStickers {
	const local = useLocalStickers(enabled && !live);
	const remote = useLiveStickers(enabled ? live : null);
	const source = live ? remote : local;
	const count = source.placements.length + (hasAffiliation ? 1 : 0);
	return { ...source, canPlace: count < MAX_STICKERS_PER_CARD };
}

type Source = Omit<CardStickers, 'canPlace'>;

function topZ(placements: PlacedSticker[]): number {
	return placements.reduce((max, p) => Math.max(max, p.z_index), 0) + 1;
}

function newPlacement(entry: InventoryEntry, at: { x: number; y: number }, z: number, id: string) {
	return {
		...placementFields(entry.sticker),
		id,
		sticker_id: entry.sticker.id,
		foil: entry.foil,
		...clampPlacement({ x: at.x, y: at.y }),
		// A little tilt, so a fresh sticker looks stuck on by hand.
		rotation: Math.round(Math.random() * 12 - 6),
		scale: 1,
		size: STICKER_BASE_WIDTH,
		z_index: z
	} as PlacedSticker;
}

// ── on-device ────────────────────────────────────────────────────────────────

function useLocalStickers(enabled: boolean): Source {
	const stickers = useConcardStore((s) => s.active_card.stickers);
	const rows = useConcardStore((s) => s.sticker_inventory);
	const placeSticker = useConcardStore((s) => s.placeSticker);
	const updateSticker = useConcardStore((s) => s.updateSticker);
	const removeSticker = useConcardStore((s) => s.removeSticker);
	const [error, setError] = useState<string | null>(null);

	const placements = useMemo(() => stickers.filter((p) => !p.is_affiliation), [stickers]);
	const inventory = useMemo(
		() => buildInventory(rows, placements, LOCAL_CATALOG),
		[rows, placements]
	);

	const place = useCallback(
		(entry: InventoryEntry, at: { x: number; y: number }) => {
			if (!enabled) return;
			const current = inventory.find(
				(e) => e.sticker.id === entry.sticker.id && e.foil === entry.foil
			);
			if (!current || current.available < 1) {
				setError('You don’t have a spare copy of that sticker.');
				return;
			}
			placeSticker(
				newPlacement(entry, at, topZ(placements), `local-${entry.sticker.id}-${Date.now()}`)
			);
		},
		[enabled, inventory, placements, placeSticker]
	);

	return {
		loading: false,
		error,
		placements,
		inventory,
		place,
		update: (id, patch) => updateSticker(id, clampPlacement(patch)),
		raise: (id) => {
			const top = topZ(placements);
			const p = placements.find((s) => s.id === id);
			if (p && p.z_index < top - 1) updateSticker(id, { z_index: top });
		},
		remove: removeSticker,
		dismissError: () => setError(null),
		affiliationRow: null,
		updateAffiliationRow: () => {}
	};
}

// ── live ─────────────────────────────────────────────────────────────────────

function useLiveStickers(target: LiveTarget | null): Source {
	const [placements, setPlacements] = useState<PlacedSticker[]>([]);
	const [affiliationRow, setAffiliationRow] = useState<PlacedSticker | null>(null);
	const [inventory, setInventory] = useState<InventoryEntry[]>([]);
	const [loading, setLoading] = useState(!!target);
	const [error, setError] = useState<string | null>(null);
	const alive = useRef(true);

	const cardId = target?.cardId ?? null;
	const userId = target?.userId ?? null;

	/** Bumped to refetch from the server (after a refused write). */
	const [generation, setGeneration] = useState(0);
	const reload = useCallback(() => setGeneration((g) => g + 1), []);

	useEffect(() => {
		alive.current = true;
		if (!cardId || !userId) return;
		let current = true;
		Promise.all([fetchCardPlacements(cardId), fetchLiveInventory(userId)]).then(
			([p, inv]) => {
				if (!current) return;
				setPlacements(p.filter((s) => !s.is_affiliation));
				setAffiliationRow(p.find((s) => s.is_affiliation) ?? null);
				setInventory(inv);
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
			alive.current = false;
		};
	}, [cardId, userId, generation]);

	/** Runs a write; on failure, says why and snaps back to what the server has. */
	const commit = useCallback(
		(write: () => Promise<unknown>) => {
			write().catch((e: unknown) => {
				if (!alive.current) return;
				setError(e instanceof Error ? e.message : String(e));
				reload();
			});
		},
		[reload]
	);

	/** Keeps the drawer's counts honest without waiting for a refetch. */
	const adjustAvailable = (stickerId: string, foil: string, delta: number) =>
		setInventory((inv) =>
			inv.map((e) =>
				e.sticker.id === stickerId && e.foil === foil
					? { ...e, placed: e.placed - delta, available: e.available + delta }
					: e
			)
		);

	const place = useCallback(
		(entry: InventoryEntry, at: { x: number; y: number }) => {
			if (!cardId) return;
			const current = inventory.find(
				(e) => e.sticker.id === entry.sticker.id && e.foil === entry.foil
			);
			if (!current || current.available < 1) {
				setError('You don’t have a spare copy of that sticker.');
				return;
			}
			const tempId = `pending-${entry.sticker.id}-${Date.now()}`;
			const placed = newPlacement(entry, at, topZ(placements), tempId);
			setPlacements((ps) => [...ps, placed]);
			adjustAvailable(entry.sticker.id, entry.foil, -1);
			commit(async () => {
				const id = await insertPlacement(cardId, placed);
				if (alive.current) {
					setPlacements((ps) => ps.map((p) => (p.id === tempId ? { ...p, id } : p)));
				}
			});
		},
		[cardId, inventory, placements, commit]
	);

	const update = useCallback(
		(id: string, patch: PlacementPatch) => {
			const clamped = clampPlacement(patch);
			setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, ...clamped } : p)));
			// a sticker still being inserted gets its final spot on the next move
			if (id.startsWith('pending-')) return;
			commit(() => updatePlacement(id, clamped));
		},
		[commit]
	);

	const remove = useCallback(
		(id: string) => {
			const gone = placements.find((p) => p.id === id);
			if (!gone) return;
			setPlacements((ps) => ps.filter((p) => p.id !== id));
			adjustAvailable(gone.sticker_id, gone.foil, +1);
			if (id.startsWith('pending-')) return;
			commit(() => deletePlacement(id));
		},
		[placements, commit]
	);

	return {
		loading,
		error,
		placements,
		inventory,
		place,
		update,
		raise: (id) => {
			const top = topZ(placements);
			const p = placements.find((s) => s.id === id);
			if (p && p.z_index < top - 1) update(id, { z_index: top });
		},
		remove,
		dismissError: () => setError(null),
		affiliationRow,
		updateAffiliationRow: (patch) => {
			if (!affiliationRow?.id) return;
			const clamped = clampPlacement(patch);
			setAffiliationRow({ ...affiliationRow, ...clamped });
			commit(() => updatePlacement(affiliationRow.id!, clamped));
		}
	};
}
