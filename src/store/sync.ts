import * as FileSystem from 'expo-file-system/legacy';

import { grantsFromCollect, snapshotToView } from '@/card/snapshot';
import { tierForMeetings } from '@/card/tiers';
import type { CardView, CollectedCard } from '@/card/types';
import { parseCollectError } from '@/lib/collect';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/lib/database.types';
import COLLECT_FIXTURE from './fixtures/collect-v4.json';
import { useConcardStore, type PendingScan } from './useConcardStore';

let syncing = false;

function record(input: Json | undefined): Record<string, unknown> {
	return input && typeof input === 'object' && !Array.isArray(input)
		? (input as Record<string, unknown>)
		: {};
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

/**
 * Dev-only fallback when Supabase isn't configured — never used in a build
 * that could ship, since `syncPendingScans` only takes this path when
 * `supabase` is null.
 *
 * Replays a real `collect_card()` response (`fixtures/collect-v4.json`,
 * printed by the concard repo's `scripts/collect-fixture.mjs` from the
 * migrated function) through the same parsing as a live collect, renamed to
 * the scanned username, and credits its sticker grants to the on-device
 * inventory — so the whole collect → grant → binder path runs offline.
 */
function demoCardFor(scan: PendingScan): CollectedCard {
	const response = COLLECT_FIXTURE as unknown as Record<string, unknown>;
	const { view } = snapshotToView(response.card_snapshot);
	const granted = grantsFromCollect(response);
	const store = useConcardStore.getState();
	for (const g of granted) store.adjustStickerInventory(g.sticker_id, g.foil, 1);
	return {
		id: `local-demo-${scan.id}`,
		card_id: null,
		owner_id: null,
		view: {
			...view,
			title: scan.username
				.split(/[-_.]/)
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' '),
			handle: scan.username
		},
		granted,
		tier: 0,
		meeting_count: 1,
		revealed: true,
		pending: false,
		first_scanned_at: scan.scanned_at,
		last_scanned_at: scan.scanned_at
	};
}

/** How many times I've collected this person before, for `tiers.ts`'s ladder.
 *  `collect_card()` records one row per collect, not a running total. */
async function meetingCountFor(collectorId: string, ownerId: string): Promise<number> {
	if (!supabase) return 1;
	const { count } = await supabase
		.from('collections')
		.select('id', { count: 'exact', head: true })
		.eq('collector_id', collectorId)
		.eq('owner_id', ownerId);
	return count ?? 1;
}

/** Permanent for this scan — retrying without a new attempt by the user can't
 *  succeed, so the queue must not jam waiting on it. */
const TERMINAL_CODES = new Set([
	'profile_not_found',
	'cannot_collect_self',
	'no_active_card',
	'cooldown'
]);

/**
 * Drains scans in order. Each entry is removed only after it has become a
 * complete binder snapshot (or been rejected as unrecoverable), so
 * interruption or app termination is safe.
 */
export async function syncPendingScans() {
	if (syncing) return;
	syncing = true;
	const store = useConcardStore.getState();
	try {
		for (const scan of [...store.scan_queue]) {
			if (!supabase) {
				store.resolvePendingScan(scan.id, demoCardFor(scan), { live: false });
				continue;
			}

			try {
				const {
					data: { session }
				} = await supabase.auth.getSession();
				const collectorId = session?.user.id;
				if (!collectorId) {
					store.setSyncError({
						username: scan.username,
						code: 'not_authenticated',
						hint: 'Sign in to collect cards.',
						retryAt: null
					});
					// No point trying the rest of the queue without a session.
					break;
				}

				const { data, error: collectError } = await supabase.rpc('collect_card', {
					target_username: scan.username
				});

				if (collectError) {
					const parsed = parseCollectError(collectError);
					store.setSyncError({ username: scan.username, ...parsed });
					if (parsed.code === 'not_authenticated') break;
					if (TERMINAL_CODES.has(parsed.code) || parsed.code === 'unknown') {
						store.rejectPendingScan(scan.id);
					}
					continue;
				}

				const result = record(data as Json);
				const { view, ownerId, cardId } = snapshotToView(result.card_snapshot);
				const granted = grantsFromCollect(result);
				const cachedView = await cachePhoto(
					view,
					typeof cardId === 'string' ? cardId : scan.username
				);
				const meetingCount = await meetingCountFor(collectorId, ownerId);
				const collectedAt =
					typeof result.collected_at === 'string' ? result.collected_at : scan.scanned_at;

				store.resolvePendingScan(
					scan.id,
					{
						id:
							typeof result.collection_id === 'string' ? result.collection_id : `synced-${scan.id}`,
						card_id: typeof cardId === 'string' ? cardId : null,
						owner_id: ownerId || null,
						view: cachedView,
						granted,
						tier: tierForMeetings(meetingCount),
						meeting_count: meetingCount,
						revealed: true,
						pending: false,
						first_scanned_at: collectedAt,
						last_scanned_at: collectedAt
					},
					{ live: true }
				);
				if (store.sync_error?.username === scan.username) store.setSyncError(null);
			} catch (err) {
				store.setSyncError({
					username: scan.username,
					code: 'unknown',
					hint: err instanceof Error ? err.message : 'Something went wrong. Try again.',
					retryAt: null
				});
				// Likely a connectivity blip mid-request — leave this and later
				// scans queued for the next connectivity event rather than
				// evicting them over a transient failure.
				break;
			}
		}
		store.markSynced();
	} finally {
		syncing = false;
	}
}

/**
 * Replaces the binder with a live read of `collections`, grouped by owner
 * (design bible §7: tier and meeting count are per collector-owner pair, not
 * per row — one row exists per collect). Called once real data is available
 * so the starter demo cards never sit beside genuine meets.
 */
export async function fetchMyCollections() {
	if (!supabase) return;
	const {
		data: { session }
	} = await supabase.auth.getSession();
	const collectorId = session?.user.id;
	if (!collectorId) return;

	// Grants live in their own table from the sticker migrations on; before
	// that, only `bonus_sticker_id` says what a collect gave.
	let result = await supabase
		.from('collections')
		.select('*, collection_sticker_grants(*)')
		.eq('collector_id', collectorId)
		.order('collected_at', { ascending: false });
	if (result.error) {
		result = (await supabase
			.from('collections')
			.select('*')
			.eq('collector_id', collectorId)
			.order('collected_at', { ascending: false })) as typeof result;
	}
	const { data, error } = result;
	if (error || !data) return;

	const byOwner = new Map<string, typeof data>();
	for (const row of data) {
		const list = byOwner.get(row.owner_id);
		if (list) list.push(row);
		else byOwner.set(row.owner_id, [row]);
	}

	const cards: CollectedCard[] = [];
	for (const [ownerId, rows] of byOwner) {
		// Rows arrive newest-first from the query above.
		const latest = rows[0];
		const oldest = rows[rows.length - 1];
		const { view } = snapshotToView(latest.card_snapshot);
		const grants = (latest as unknown as { collection_sticker_grants?: unknown[] })
			.collection_sticker_grants;
		// A grant row names the sticker; its definition is in the snapshot it came from.
		const granted = grantsFromCollect({
			...latest,
			stickers: Array.isArray(grants)
				? grants.map((g) => {
						const row = g as { sticker_id: string; foil: string; kind: string };
						const onCard = view.stickers.find((p) => p.sticker_id === row.sticker_id);
						return { ...onCard, ...row };
					})
				: undefined
		});
		const cachedView = await cachePhoto(view, latest.card_id ?? ownerId);
		const meetingCount = rows.length;
		cards.push({
			id: ownerId,
			card_id: latest.card_id,
			owner_id: ownerId,
			view: cachedView,
			granted,
			tier: tierForMeetings(meetingCount),
			meeting_count: meetingCount,
			revealed: true,
			pending: false,
			first_scanned_at: oldest.collected_at,
			last_scanned_at: latest.collected_at
		});
	}

	useConcardStore.getState().replaceBinderWithLive(cards);
}
