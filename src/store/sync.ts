import * as FileSystem from 'expo-file-system/legacy';

import { normalizeStyle } from '@/card/card-style';
import { affiliationFromUnknown } from '@/card/card-view';
import { DEMO_CARD } from '@/card/demo-card';
import type { CardView, CollectedCard } from '@/card/types';
import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/lib/database.types';
import { useConcardStore, type PendingScan } from './useConcardStore';

type Fandom = Database['public']['Tables']['fandoms']['Row'];

let syncing = false;

function record(input: Json | undefined): Record<string, unknown> {
	return input && typeof input === 'object' && !Array.isArray(input)
		? (input as Record<string, unknown>)
		: {};
}

function snapshotToView(snapshot: Json, username: string, fandoms: Fandom[]): CardView {
	const value = record(snapshot);
	const profile = record(value.profile as Json);
	const card = record((value.card as Json) ?? snapshot);
	return {
		title:
			String(card.display_name ?? profile.display_name ?? value.display_name ?? username) ||
			username,
		handle: String(profile.username ?? value.username ?? username),
		pronouns: (card.pronouns ?? profile.pronouns ?? null) as string | null,
		bio: String(card.bio ?? profile.bio ?? ''),
		label: (card.label ?? null) as string | null,
		art_url: (card.art_url ?? null) as string | null,
		art_x: Number(card.art_x ?? 0.5),
		art_y: Number(card.art_y ?? 0.5),
		art_scale: Number(card.art_scale ?? 1),
		style: normalizeStyle(card.style),
		affiliation: affiliationFromUnknown(
			value.affiliation ?? card.affiliation,
			card.affiliation_x ?? value.affiliation_x,
			card.affiliation_y ?? value.affiliation_y,
			fandoms
		),
		links: Array.isArray(profile.links) ? (profile.links as CardView['links']) : [],
		stickers: Array.isArray(value.stickers) ? (value.stickers as CardView['stickers']) : []
	};
}

function safeName(value: string) {
	return value.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}

async function cachePhoto(view: CardView, cardId: string): Promise<CardView> {
	if (!view.art_url || view.art_url.startsWith('file://') || !FileSystem.cacheDirectory)
		return view;
	const extension = view.art_url.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] ?? 'jpg';
	const uri = `${FileSystem.cacheDirectory}concard-${safeName(cardId)}.${extension}`;
	try {
		const existing = await FileSystem.getInfoAsync(uri);
		if (!existing.exists) await FileSystem.downloadAsync(view.art_url, uri);
		return { ...view, art_url: uri };
	} catch {
		// The card remains useful without its photo and the binder intentionally
		// renders that state as a skeleton instead of a broken remote image.
		return { ...view, art_url: null };
	}
}

function demoCardFor(scan: PendingScan): CollectedCard {
	const view: CardView = {
		...DEMO_CARD,
		title: scan.username
			.split(/[-_.]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' '),
		handle: scan.username,
		bio: 'Met offline at the convention. Details will refresh on the next sync.'
	};
	return {
		id: `local-${scan.id}`,
		card_id: scan.card_id,
		view,
		tier: 0,
		meeting_count: 1,
		revealed: true,
		first_scanned_at: scan.scanned_at,
		last_scanned_at: scan.scanned_at
	};
}

/**
 * Drains scans in order. Each entry is removed only after it has become a
 * complete binder snapshot, so interruption or app termination is safe.
 */
export async function syncPendingScans() {
	if (syncing) return;
	syncing = true;
	const store = useConcardStore.getState();
	try {
		let fandoms: Fandom[] = [];
		if (supabase) {
			const fandomList = await supabase
				.from('fandoms')
				.select('*')
				.eq('is_active', true)
				.order('sort_order');
			if (!fandomList.error && fandomList.data) fandoms = fandomList.data;
		}

		for (const scan of [...store.scan_queue]) {
			if (!supabase) {
				store.cacheCard(demoCardFor(scan));
				store.removeScan(scan.id);
				continue;
			}

			const { error: collectError } = await supabase.rpc('collect_card', {
				target_username: scan.username
			});
			if (collectError) throw collectError;

			const { data, error } = await supabase
				.from('collections')
				.select('*')
				.eq('card_id', scan.card_id)
				.order('collected_at', { ascending: false })
				.limit(1)
				.maybeSingle();
			if (error) throw error;
			if (!data) throw new Error('The collected card was not returned by Supabase.');

			const view = await cachePhoto(
				snapshotToView(data.card_snapshot, scan.username, fandoms),
				scan.card_id
			);
			store.cacheCard({
				id: data.id,
				card_id: data.card_id,
				view,
				tier: 0,
				meeting_count: 1,
				revealed: true,
				first_scanned_at: data.collected_at,
				last_scanned_at: data.collected_at
			});
			store.removeScan(scan.id);
		}
		store.markSynced();
	} finally {
		syncing = false;
	}
}
