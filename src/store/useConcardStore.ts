import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_STYLE } from '@/card/card-style';
import { DEMO_CARD, DEMO_CARD_ALT } from '@/card/demo-card';
import type { CardView, CollectedCard, PlacedSticker } from '@/card/types';

export interface PendingScan {
	id: string;
	username: string;
	card_id: string;
	scanned_at: string;
}

export interface EditableCard extends CardView {
	id: string;
}

interface ConcardState {
	scan_queue: PendingScan[];
	binder_cache: CollectedCard[];
	active_card: EditableCard;
	last_sync_at: string | null;
	hydrated: boolean;
	enqueueScan: (payload: Omit<PendingScan, 'id'>) => boolean;
	removeScan: (id: string) => void;
	cacheCard: (card: CollectedCard) => void;
	updateActiveCard: (patch: Partial<EditableCard>) => void;
	addSticker: (stickerId: string) => string;
	updateSticker: (id: string, patch: Partial<PlacedSticker>) => void;
	removeSticker: (id: string) => void;
	markSynced: () => void;
	setHydrated: (ready: boolean) => void;
}

const now = new Date().toISOString();

const DEMO_BINDER: CollectedCard[] = [
	{
		id: 'demo-jade',
		card_id: 'demo-jade',
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
		{ label: 'Portfolio', url: 'https://example.com' },
		{ label: 'Bluesky', url: 'https://bsky.app' }
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

export const useConcardStore = create<ConcardState>()(
	persist(
		(set, get) => ({
			scan_queue: [],
			binder_cache: DEMO_BINDER,
			active_card: STARTER_CARD,
			last_sync_at: null,
			hydrated: false,
			enqueueScan: (payload) => {
				const duplicate = get().scan_queue.some(
					(scan) =>
						scan.username === payload.username &&
						scan.card_id === payload.card_id &&
						Date.now() - Date.parse(scan.scanned_at) < 5000
				);
				if (duplicate) return false;
				set((state) => ({
					scan_queue: [...state.scan_queue, { ...payload, id: `${payload.card_id}-${Date.now()}` }]
				}));
				return true;
			},
			removeScan: (id) =>
				set((state) => ({ scan_queue: state.scan_queue.filter((scan) => scan.id !== id) })),
			cacheCard: (card) =>
				set((state) => {
					const current = state.binder_cache.find((item) => item.card_id === card.card_id);
					return {
						binder_cache: current
							? state.binder_cache.map((item) => (item.id === current.id ? card : item))
							: [card, ...state.binder_cache]
					};
				}),
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
			setHydrated: (hydrated) => set({ hydrated })
		}),
		{
			name: 'concard-v1',
			storage: createJSONStorage(() => AsyncStorage),
			partialize: ({ scan_queue, binder_cache, active_card, last_sync_at }) => ({
				scan_queue,
				binder_cache,
				active_card,
				last_sync_at
			}),
			onRehydrateStorage: () => (state) => state?.setHydrated(true)
		}
	)
);
