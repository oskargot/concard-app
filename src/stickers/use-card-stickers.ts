/**
 * The stickers on the card being edited, and the inventory they come from.
 *
 * Every change saves as it happens, like the rest of the editor — there is no
 * save button (HANDOFF §1.4). Live, that's one `sticker_placements` insert,
 * update or delete per gesture, applied optimistically. Each sticker's writes
 * go through its own serial chain (`write-chain.ts`), so a move made while the
 * sticker is still being inserted, or two quick drags, land in the order they
 * were made. If a write is refused (the database enforces the 20 cap, the
 * scale clamp, the bounds and inventory, whatever this screen believes), the
 * screen says why and, once no write is in flight, snaps back to the server's
 * state. On-device, the store holds the placements and a local inventory.
 *
 * A new placement's id is made here, not by the database, so it is the same
 * before and after the insert lands: the sticker never remounts under a
 * finger, and its wobble (seeded by the id) is the one every other view of
 * the card draws.
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
import { WriteChains } from './write-chain';

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

/**
 * A random (v4) uuid. `sticker_placements.id` is a uuid the database would
 * otherwise default; making it here means the row's id is known before the
 * insert lands.
 */
export function newPlacementId(): string {
	const bytes = new Uint8Array(16);
	const crypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => unknown } })
		.crypto;
	if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
	else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

const NO_SPARE = 'You don’t have a spare copy of that sticker.';

function spareOf(inventory: InventoryEntry[], entry: InventoryEntry): number {
	return (
		inventory.find((e) => e.sticker.id === entry.sticker.id && e.foil === entry.foil)?.available ??
		0
	);
}

/**
 * State that callbacks can also read as it is right now, between renders: two
 * taps in one frame must each see what the other did.
 */
function useMirror<T>(initial: T) {
	const [value, setValue] = useState(initial);
	const ref = useRef(initial);
	const set = useCallback((next: (prev: T) => T) => {
		ref.current = next(ref.current);
		setValue(ref.current);
	}, []);
	return [value, ref, set] as const;
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
			// From the store as it is now, not this render: a double tap mustn't
			// place two stickers from one spare copy.
			const state = useConcardStore.getState();
			const onCard = state.active_card.stickers.filter((p) => !p.is_affiliation);
			if (spareOf(buildInventory(state.sticker_inventory, onCard, LOCAL_CATALOG), entry) < 1) {
				setError(NO_SPARE);
				return;
			}
			placeSticker(newPlacement(entry, at, topZ(onCard), `local-${newPlacementId()}`));
		},
		[enabled, placeSticker]
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
	const [placements, placementsRef, setPlacements] = useMirror<PlacedSticker[]>([]);
	const [inventory, inventoryRef, setInventory] = useMirror<InventoryEntry[]>([]);
	const [affiliationRow, setAffiliationRow] = useState<PlacedSticker | null>(null);
	const [loading, setLoading] = useState(!!target);
	const [error, setError] = useState<string | null>(null);
	const alive = useRef(true);

	const cardId = target?.cardId ?? null;
	const userId = target?.userId ?? null;

	/** Bumped to refetch from the server (after a refused write). */
	const [generation, setGeneration] = useState(0);
	/** A write was refused: refetch once every chain has settled. */
	const refetchWhenIdle = useRef(false);

	/** Every placement's write chain; made on first use, kept for the screen's life. */
	const chains = useRef<WriteChains<PlacementPatch> | null>(null);
	const writes = useCallback(() => {
		chains.current ??= new WriteChains<PlacementPatch>({
			update: (id, patch) => updatePlacement(id, patch),
			remove: (id) => deletePlacement(id),
			onError: (e) => {
				if (!alive.current) return;
				setError(messageOf(e));
				refetchWhenIdle.current = true;
			},
			// Refetching while a write is in flight could drop a sticker that's
			// still being inserted, so the snap-back waits for them all.
			onIdle: () => {
				if (!refetchWhenIdle.current || !alive.current) return;
				refetchWhenIdle.current = false;
				setGeneration((g) => g + 1);
			}
		});
		return chains.current;
	}, []);

	useEffect(() => {
		alive.current = true;
		if (!cardId || !userId) return;
		let current = true;
		const epoch = writes().epoch;
		Promise.all([fetchCardPlacements(cardId), fetchLiveInventory(userId)]).then(
			([p, inv]) => {
				if (!current) return;
				// A write was queued while this was out, so the answer may not have
				// it yet: ask again once the writes have settled.
				if (writes().epoch !== epoch) {
					if (writes().busy()) refetchWhenIdle.current = true;
					else setGeneration((g) => g + 1);
					return;
				}
				setPlacements(() => p.filter((s) => !s.is_affiliation));
				setAffiliationRow(p.find((s) => s.is_affiliation) ?? null);
				setInventory(() => inv);
				setLoading(false);
			},
			(e: unknown) => {
				if (!current) return;
				setError(messageOf(e));
				setLoading(false);
			}
		);
		return () => {
			current = false;
			alive.current = false;
		};
	}, [cardId, userId, generation, writes, setPlacements, setInventory]);

	/** Keeps the drawer's counts honest without waiting for a refetch. */
	const adjustAvailable = useCallback(
		(stickerId: string, foil: string, delta: number) =>
			setInventory((inv) =>
				inv.map((e) =>
					e.sticker.id === stickerId && e.foil === foil
						? { ...e, placed: e.placed - delta, available: e.available + delta }
						: e
				)
			),
		[setInventory]
	);

	const place = useCallback(
		(entry: InventoryEntry, at: { x: number; y: number }) => {
			if (!cardId) return;
			// The mirrors, not this render's copies: a double tap must see the
			// first tap's sticker and the copy it used.
			if (placementsRef.current.length >= MAX_STICKERS_PER_CARD) return;
			if (spareOf(inventoryRef.current, entry) < 1) {
				setError(NO_SPARE);
				return;
			}
			const placed = newPlacement(entry, at, topZ(placementsRef.current), newPlacementId());
			setPlacements((ps) => [...ps, placed]);
			adjustAvailable(entry.sticker.id, entry.foil, -1);
			writes().insert(placed.id!, () => insertPlacement(cardId, placed));
		},
		[cardId, writes, placementsRef, inventoryRef, setPlacements, adjustAvailable]
	);

	const update = useCallback(
		(id: string, patch: PlacementPatch) => {
			const clamped = clampPlacement(patch);
			setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, ...clamped } : p)));
			// waits for the insert (and any earlier move) if they're still in flight
			writes().update(id, clamped);
		},
		[writes, setPlacements]
	);

	const remove = useCallback(
		(id: string) => {
			const gone = placementsRef.current.find((p) => p.id === id);
			if (!gone) return;
			setPlacements((ps) => ps.filter((p) => p.id !== id));
			adjustAvailable(gone.sticker_id, gone.foil, +1);
			// after the insert, if it's still in flight, so the row doesn't outlive it
			writes().remove(id);
		},
		[writes, placementsRef, setPlacements, adjustAvailable]
	);

	return {
		loading,
		error,
		placements,
		inventory,
		place,
		update,
		raise: (id) => {
			const top = topZ(placementsRef.current);
			const p = placementsRef.current.find((s) => s.id === id);
			if (p && p.z_index < top - 1) update(id, { z_index: top });
		},
		remove,
		dismissError: () => setError(null),
		affiliationRow,
		updateAffiliationRow: (patch) => {
			if (!affiliationRow?.id) return;
			const clamped = clampPlacement(patch);
			setAffiliationRow({ ...affiliationRow, ...clamped });
			writes().update(affiliationRow.id, clamped);
		}
	};
}
