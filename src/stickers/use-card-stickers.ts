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
 * the screen draws and moves it from the card view. Only its twist and pinch
 * live on its placement row, and that row is replaced whenever a card save
 * changes the fandom — see `useLiveAffiliation`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PlacedSticker } from '@/card/types';
import type { SavedAffiliation } from '@/card/use-card-editor';
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
	/** Under the 20-per-card cap (the free affiliation doesn't count toward it). */
	canPlace: boolean;
	place: (entry: InventoryEntry, at: { x: number; y: number }) => void;
	update: (id: string, patch: PlacementPatch) => void;
	/** Brings a sticker to the top: the last one touched is on top. */
	raise: (id: string) => void;
	/** Takes a sticker off the card; its copy goes back to the inventory. */
	remove: (id: string) => void;
	dismissError: () => void;
	/**
	 * Live: the affiliation's rotation and scale, which only its placement row
	 * stores (0 / 1 while that row is being replaced for a new fandom). Null
	 * on-device, where the card's own affiliation carries them.
	 */
	affiliationTurn: { rotation: number; scale: number } | null;
	/** Saves a twist or pinch of the affiliation (live only). */
	updateAffiliation: (patch: PlacementPatch) => void;
}

export interface LiveTarget {
	cardId: string;
	userId: string;
}

/** The card's fandom as the editor shows it, and as its last landed save wrote it. */
export interface AffiliationState {
	current: string | null;
	saved: SavedAffiliation | null;
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
	affiliation
}: {
	/** The card row and its owner when editing live; null edits the on-device card. */
	live: LiveTarget | null;
	enabled: boolean;
	affiliation: AffiliationState;
}): CardStickers {
	const local = useLocalStickers(enabled && !live);
	const remote = useLiveStickers(enabled ? live : null);
	const turn = useLiveAffiliation(enabled ? live : null, affiliation);
	const source: Source = live
		? {
				...remote,
				affiliationTurn: turn.affiliationTurn,
				updateAffiliation: turn.updateAffiliation,
				error: remote.error ?? turn.error,
				dismissError: () => {
					remote.dismissError();
					turn.dismissError();
				}
			}
		: local;
	return { ...source, canPlace: source.placements.length < MAX_STICKERS_PER_CARD };
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
			if (onCard.length >= MAX_STICKERS_PER_CARD) return;
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
		affiliationTurn: null,
		updateAffiliation: () => {}
	};
}

// ── live ─────────────────────────────────────────────────────────────────────

function useLiveStickers(
	target: LiveTarget | null
): Omit<Source, 'affiliationTurn' | 'updateAffiliation'> {
	const [placements, placementsRef, setPlacements] = useMirror<PlacedSticker[]>([]);
	const [inventory, inventoryRef, setInventory] = useMirror<InventoryEntry[]>([]);
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
		dismissError: () => setError(null)
	};
}

// ── live: the affiliation's turn ─────────────────────────────────────────────

/** The affiliation's chain: one row per card, whatever its id is today. */
const AFFILIATION_KEY = 'affiliation';

/** Twists and pinches waiting for the affiliation's new row. */
interface Held {
	/** The fandom they were made on; they're dropped if it changes again. */
	fandom: string | null;
	patch: PlacementPatch;
}
const NOTHING_HELD: Held = { fandom: null, patch: {} };

/**
 * The affiliation's rotation and scale, live.
 *
 * Picking a fandom is a card save; when it lands, a server trigger deletes the
 * old affiliation row and inserts a new one (new id, rotation 0, scale 1). So
 * the row read at open is only good until the fandom changes. From then until
 * the editor says that save landed (`saved.rev` moves on) and the new row has
 * been read back, the sticker draws at 0 / 1, and twists and pinches are held
 * rather than sent to a row that's about to go; they go to the new row once
 * it's known. That covers a card with no affiliation at open, too. Every read
 * and write of the row takes its turn on one chain, so a write always goes to
 * the row that was read last.
 */
function useLiveAffiliation(target: LiveTarget | null, { current, saved }: AffiliationState) {
	const [row, rowRef, setRow] = useMirror<PlacedSticker | null>(null);
	/** The `saved.rev` the row was read for; −1 before the first read. */
	const [rowRev, rowRevRef, setRowRev] = useMirror(-1);
	const [held, heldRef, setHeld] = useMirror<Held>(NOTHING_HELD);
	const [error, setError] = useState<string | null>(null);
	const alive = useRef(true);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	const chains = useRef<WriteChains<PlacementPatch> | null>(null);
	const writes = useCallback(() => {
		chains.current ??= new WriteChains<PlacementPatch>({
			update: async (_key, patch) => {
				// no row: no affiliation, or a schema from before it was a placement
				const id = rowRef.current?.id;
				if (id) await updatePlacement(id, patch);
			},
			remove: async () => {},
			onError: (e) => {
				if (alive.current) setError(messageOf(e));
			}
		});
		return chains.current;
	}, [rowRef]);

	const send = useCallback(
		(patch: PlacementPatch) => {
			setRow((r) => (r ? { ...r, ...patch } : r));
			writes().update(AFFILIATION_KEY, patch);
		},
		[setRow, writes]
	);

	const cardId = target?.cardId ?? null;
	const savedRev = saved?.rev ?? -1;
	const savedFandom = saved?.value ?? null;

	// Read the row once the card has loaded, and again after every landed save
	// that replaced it.
	useEffect(() => {
		if (!cardId || savedRev < 0) return;
		writes().task(AFFILIATION_KEY, async () => {
			let read: PlacedSticker | null;
			try {
				read = (await fetchCardPlacements(cardId)).find((p) => p.is_affiliation) ?? null;
			} catch (e) {
				if (alive.current) setError(messageOf(e));
				return;
			}
			if (!alive.current) return;
			setRow(() => read);
			setRowRev(() => savedRev);
			// what was twisted on this fandom while its row was being replaced
			const waiting = heldRef.current;
			if (waiting.fandom === savedFandom && Object.keys(waiting.patch).length) {
				setHeld(() => NOTHING_HELD);
				if (read) send(waiting.patch);
			}
		});
	}, [cardId, savedRev, savedFandom, writes, setRow, setRowRev, heldRef, setHeld, send]);

	const updateAffiliation = useCallback(
		(patch: PlacementPatch) => {
			const clamped = clampPlacement(patch);
			// the row we have is the one the server has for the fandom on screen
			if (rowRevRef.current === savedRev && current === savedFandom) {
				send(clamped);
				return;
			}
			setHeld((h) => ({
				fandom: current,
				patch: { ...(h.fandom === current ? h.patch : {}), ...clamped }
			}));
		},
		[rowRevRef, savedRev, savedFandom, current, send, setHeld]
	);

	const dismissError = useCallback(() => setError(null), []);

	const known = rowRev === savedRev && current === savedFandom;
	const base = known && row ? row : { rotation: 0, scale: 1 };
	const extra = held.fandom === current ? held.patch : {};
	const rotation = extra.rotation ?? base.rotation;
	const scale = extra.scale ?? base.scale;
	const live = !!target;
	const affiliationTurn = useMemo(
		() => (live ? { rotation, scale } : null),
		[live, rotation, scale]
	);
	return {
		affiliationTurn,
		updateAffiliation,
		error,
		dismissError
	};
}
