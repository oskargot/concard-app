import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_STYLE } from '@/card/card-style';
import { DEMO_CARD, DEMO_CARD_ALT } from '@/card/demo-card';
import type { CardView, CollectedCard, PlacedSticker } from '@/card/types';
import type { CollectErrorCode } from '@/lib/collect';

export interface PendingScan {
	id: string;
	username: string;
	scanned_at: string;
}

export interface SyncError {
	username: string;
	code: CollectErrorCode;
	hint: string;
	retryAt: string | null;
}

export interface EditableCard extends CardView {
	id: string;
}

interface ConcardState {
	scan_queue: PendingScan[];
	binder_cache: CollectedCard[];
	/** True until the first real collections fetch or synced scan replaces the
	 *  starter demo rows — those never sit beside real meets. */
	demo_binder: boolean;
	active_card: EditableCard;
	last_sync_at: string | null;
	sync_error: SyncError | null;
	hydrated: boolean;
	enqueueScan: (payload: Omit<PendingScan, 'id'>) => boolean;
	removeScan: (id: string) => void;
	/** Drops a queued scan and its optimistic placeholder without adding a
	 *  card — used when `collect_card` fails in a way retrying won't fix
	 *  (cooldown, self-collect, no active card, unknown user). */
	rejectPendingScan: (scanId: string) => void;
	/** Resolves a queued scan into a real (or dev-fallback) binder card,
	 *  atomically replacing its optimistic placeholder. `live` clears the demo
	 *  seed rows; the dev-only `!supabase` fallback leaves them alone. */
	resolvePendingScan: (scanId: string, card: CollectedCard, opts?: { live?: boolean }) => void;
	/** Replaces the binder with a live `collections` fetch, keeping any scans
	 *  still pending sync. Demo seed rows are dropped either way. */
	replaceBinderWithLive: (cards: CollectedCard[]) => void;
	updateActiveCard: (patch: Partial<EditableCard>) => void;
	addSticker: (stickerId: string) => string;
	updateSticker: (id: string, patch: Partial<PlacedSticker>) => void;
	removeSticker: (id: string) => void;
	markSynced: () => void;
	setSyncError: (error: SyncError | null) => void;
	setHydrated: (ready: boolean) => void;
}

const now = new Date().toISOString();

const DEMO_BINDER: CollectedCard[] = [
	{
		id: 'demo-jade',
		card_id: 'demo-jade',
		owner_id: null,
		view: DEMO_CARD,
		tier: 2,
		meeting_count: 7,
		revealed: true,
		first_scanned_at: now,
		last_scanned_at: now
	},
	{
		id: 'demo-rafa',
		card_id: 'demo-rafa',
		owner_id: null,
		view: DEMO_CARD_ALT,
		tier: 1,
		meeting_count: 3,
		revealed: true,
		first_scanned_at: now,
		last_scanned_at: now
	},
	{
		id: 'demo-missing-image',
		card_id: 'demo-missing-image',
		owner_id: null,
		view: {
			...DEMO_CARD,
			title: 'Mina Park',
			handle: 'minamakes',
			pronouns: 'she/they',
			bio: 'Tiny robots, huge props. Find me near the arcade.',
			style: { ...DEFAULT_STYLE, bg: 'violet', frame: 'holo' },
			art_url: null
		},
		tier: 0,
		meeting_count: 1,
		revealed: true,
		first_scanned_at: now,
		last_scanned_at: now
	}
];

const STARTER_CARD: EditableCard = {
	id: 'local-active-card',
	title: 'Nova Vale',
	handle: 'novavale',
	pronouns: 'they/them',
	bio: 'Designer by day, side-quest enthusiast by night.',
	label: 'Convention',
	art_url: null,
	art_x: 0.5,
	art_y: 0.5,
	art_scale: 1,
	style: { ...DEFAULT_STYLE, bg: 'blush', frame: 'holo', photo_shape: 'arch' },
	affiliation: null,
	links: [
		{ url: 'https://novavale.carrd.co', handle: 'novavale' },
		{ url: 'https://bsky.app/profile/novavale.bsky.social', handle: '@novavale.bsky.social' }
	],
	stickers: [
		{
			id: 'starter-spark',
			sticker_id: 'spark',
			x: 0.84,
			y: 0.19,
			rotation: 11,
			scale: 0.9,
			z_index: 1,
			foil: 'none'
		}
	]
};

/** What a scanned-but-unsynced card shows until `collect_card` returns the
 *  real snapshot. Username is the only thing known at scan time. */
function placeholderView(username: string): CardView {
	return {
		title: username,
		handle: username,
		pronouns: null,
		bio: 'Met at the convention. Details will refresh once this syncs.',
		label: null,
		art_url: null,
		art_x: 0.5,
		art_y: 0.5,
		art_scale: 1,
		style: DEFAULT_STYLE,
		affiliation: null,
		links: [],
		stickers: []
	};
}

/** Drops the seed demo rows once real data is about to take their place. */
function withoutDemos(cards: CollectedCard[]): CollectedCard[] {
	return cards.filter((card) => !card.id.startsWith('demo-'));
}

export const useConcardStore = create<ConcardState>()(
	persist(
		(set, get) => ({
			scan_queue: [],
			binder_cache: DEMO_BINDER,
			demo_binder: true,
			active_card: STARTER_CARD,
			last_sync_at: null,
			sync_error: null,
			hydrated: false,
			enqueueScan: (payload) => {
				const duplicate = get().scan_queue.some(
					(scan) =>
						scan.username === payload.username && Date.now() - Date.parse(scan.scanned_at) < 5000
				);
				if (duplicate) return false;
				const id = `${payload.username}-${Date.now()}`;
				const placeholder: CollectedCard = {
					id: `local-${id}`,
					card_id: null,
					owner_id: null,
					view: placeholderView(payload.username),
					tier: 0,
					meeting_count: 1,
					revealed: true,
					pending: true,
					first_scanned_at: payload.scanned_at,
					last_scanned_at: payload.scanned_at
				};
				set((state) => ({
					scan_queue: [...state.scan_queue, { ...payload, id }],
					binder_cache: [placeholder, ...state.binder_cache]
				}));
				return true;
			},
			removeScan: (id) =>
				set((state) => ({ scan_queue: state.scan_queue.filter((scan) => scan.id !== id) })),
			rejectPendingScan: (scanId) =>
				set((state) => ({
					binder_cache: state.binder_cache.filter((item) => item.id !== `local-${scanId}`),
					scan_queue: state.scan_queue.filter((scan) => scan.id !== scanId)
				})),
			resolvePendingScan: (scanId, card, opts) =>
				set((state) => {
					const withoutPlaceholder = state.binder_cache.filter(
						(item) => item.id !== `local-${scanId}`
					);
					const live = opts?.live ?? false;
					const base =
						live && state.demo_binder ? withoutDemos(withoutPlaceholder) : withoutPlaceholder;
					const current = card.owner_id
						? base.find((item) => item.owner_id === card.owner_id)
						: undefined;
					const merged: CollectedCard = current
						? {
								...card,
								first_scanned_at:
									current.first_scanned_at < card.first_scanned_at
										? current.first_scanned_at
										: card.first_scanned_at
							}
						: card;
					return {
						demo_binder: live ? false : state.demo_binder,
						binder_cache: current
							? base.map((item) => (item.id === current.id ? merged : item))
							: [merged, ...base],
						scan_queue: state.scan_queue.filter((scan) => scan.id !== scanId)
					};
				}),
			replaceBinderWithLive: (cards) =>
				set((state) => ({
					demo_binder: false,
					binder_cache: [...cards, ...state.binder_cache.filter((item) => item.pending)]
				})),
			updateActiveCard: (patch) =>
				set((state) => ({ active_card: { ...state.active_card, ...patch } })),
			addSticker: (stickerId) => {
				const id = `placed-${stickerId}-${Date.now()}`;
				set((state) => ({
					active_card: {
						...state.active_card,
						stickers: [
							...state.active_card.stickers,
							{
								id,
								sticker_id: stickerId,
								x: 0.5,
								y: 0.45,
								rotation: -6 + Math.random() * 12,
								scale: 1,
								z_index: state.active_card.stickers.length + 1,
								foil: 'none'
							}
						]
					}
				}));
				return id;
			},
			updateSticker: (id, patch) =>
				set((state) => ({
					active_card: {
						...state.active_card,
						stickers: state.active_card.stickers.map((sticker) =>
							sticker.id === id ? { ...sticker, ...patch } : sticker
						)
					}
				})),
			removeSticker: (id) =>
				set((state) => ({
					active_card: {
						...state.active_card,
						stickers: state.active_card.stickers.filter((sticker) => sticker.id !== id)
					}
				})),
			markSynced: () => set({ last_sync_at: new Date().toISOString() }),
			setSyncError: (error) => set({ sync_error: error }),
			setHydrated: (hydrated) => set({ hydrated })
		}),
		{
			name: 'concard-v1',
			storage: createJSONStorage(() => AsyncStorage),
			partialize: ({ scan_queue, binder_cache, demo_binder, active_card, last_sync_at }) => ({
				scan_queue,
				binder_cache,
				demo_binder,
				active_card,
				last_sync_at
			}),
			onRehydrateStorage: () => (state) => state?.setHydrated(true)
		}
	)
);
