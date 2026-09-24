import { useMemo, useState } from 'react';
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardBack } from '@/card/CardBack';
import { CardFace } from '@/card/CardFace';
import { CardShell } from '@/card/CardShell';
import { FlipCard, StaticCard } from '@/card/FlipCard';
import { CardOverlay } from '@/card/CardOverlay';
import { foilForTier, meetingsToNextTier, tierLabel } from '@/card/tiers';
import type { CollectedCard } from '@/card/types';
import { formatRetryIn } from '@/lib/collect';
import { SITE_ORIGIN } from '@/lib/env';
import { profileUrl } from '@/lib/username';
import { useConcardStore } from '@/store/useConcardStore';
import { palette } from '@/theme/palette';
import { radius, shadow, space, type } from '@/theme/tokens';
import { Chip, CountBadge, IconCircle, ScreenHeader } from '@/ui';

type Sort = 'recent' | 'az' | 'holo';

const SORTS: { value: Sort; label: string }[] = [
	{ value: 'recent', label: 'Recent' },
	{ value: 'az', label: 'A–Z' },
	{ value: 'holo', label: 'Holo only' }
];

function formatCollectedDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

export default function BinderScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const cards = useConcardStore((state) => state.binder_cache);
	const pending = useConcardStore((state) => state.scan_queue.length);
	const syncError = useConcardStore((state) => state.sync_error);
	const [sort, setSort] = useState<Sort>('recent');
	const [selected, setSelected] = useState<CollectedCard | null>(null);

	// 2-column grid, 24px gutters, 12px gap.
	const cardWidth = (width - space.xl * 2 - space.md) / 2;
	const detailCardWidth = Math.min(width - space.xl * 4, 266);

	const shown = useMemo(() => {
		const base = sort === 'holo' ? cards.filter((c) => c.view.style.frame === 'holo') : [...cards];
		return base.sort((a, b) =>
			sort === 'az'
				? a.view.handle.localeCompare(b.view.handle)
				: Date.parse(b.last_scanned_at) - Date.parse(a.last_scanned_at)
		);
	}, [cards, sort]);

	return (
		<>
			<ScrollView
				contentContainerStyle={[
					styles.page,
					{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xxl }
				]}
			>
				<ScreenHeader
					title="Binder"
					right={
						<View style={styles.headerRight}>
							<CountBadge>
								{cards.length} card{cards.length === 1 ? '' : 's'}
							</CountBadge>
							<IconCircle label="Sort">
								<View style={styles.sortGlyph}>
									<View style={[styles.sortBar, { width: 14 }]} />
									<View style={[styles.sortBar, { width: 10 }]} />
									<View style={[styles.sortBar, { width: 6 }]} />
								</View>
							</IconCircle>
						</View>
					}
				/>

				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View style={styles.chips}>
						{SORTS.map((item) => (
							<Chip
								key={item.value}
								label={item.label}
								active={sort === item.value}
								onPress={() => setSort(item.value)}
							/>
						))}
					</View>
				</ScrollView>

				{pending ? (
					<View style={styles.queue}>
						<View style={styles.queueDot} />
						<Text style={styles.queueText}>
							{pending} new encounter{pending === 1 ? '' : 's'} saved · finishing when online
						</Text>
					</View>
				) : null}

				{syncError ? (
					<View style={styles.syncErrorBanner}>
						<Text style={styles.syncErrorText}>
							@{syncError.username}:{' '}
							{syncError.code === 'cooldown' && syncError.retryAt
								? `already collected — try again in ${formatRetryIn(syncError.retryAt)}.`
								: syncError.hint || 'Could not collect that card.'}
						</Text>
					</View>
				) : null}

				<View style={styles.grid}>
					{shown.map((card) => (
						<Pressable
							key={card.id}
							onPress={() => setSelected(card)}
							style={[styles.cell, { width: cardWidth }]}
						>
							<StaticCard
								width={cardWidth}
								render={(rx, ry) => (
									<CardShell
										style={card.view.style}
										width={cardWidth}
										foil={foilForTier(card.tier)}
										seed={card.card_id ?? card.id}
										rx={rx}
										ry={ry}
										detail="thumb"
										overlay={<CardOverlay view={card.view} width={cardWidth} rx={rx} ry={ry} />}
									>
										<CardFace view={card.view} width={cardWidth} />
									</CardShell>
								)}
							/>
							{card.pending ? (
								<View style={styles.pendingBadge}>
									<Text style={styles.pendingBadgeText}>SYNCING…</Text>
								</View>
							) : null}
							<View style={styles.cellFooter}>
								<Text numberOfLines={1} style={styles.cardName}>
									@{card.view.handle}
								</Text>
								<Text style={styles.tier}>
									{tierLabel(card.tier)} · ×{card.meeting_count}
								</Text>
							</View>
						</Pressable>
					))}
				</View>

				{cards.length === 0 ? (
					<View style={styles.empty}>
						<Text style={styles.emptyTitle}>Your first page is waiting</Text>
						<Text style={styles.body}>Scan someone’s Concard and they’ll land right here.</Text>
					</View>
				) : shown.length === 0 ? (
					<View style={styles.empty}>
						<Text style={styles.emptyTitle}>No holo cards yet</Text>
						<Text style={styles.body}>Meet someone a few more times to earn a holo frame.</Text>
					</View>
				) : null}
			</ScrollView>

			<Modal
				visible={!!selected}
				transparent
				animationType="fade"
				onRequestClose={() => setSelected(null)}
			>
				<View style={styles.modalScrim}>
					<Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
					{selected ? (
						<View style={styles.detail}>
							<View style={styles.detailTop}>
								<Text style={styles.detailTitle}>@{selected.view.handle}</Text>
								<Pressable onPress={() => setSelected(null)} style={styles.close}>
									<Text style={styles.closeText}>×</Text>
								</Pressable>
							</View>
							<View style={[styles.detailCardStage, { height: detailCardWidth * 1.4 }]}>
								<FlipCard
									width={detailCardWidth}
									renderFront={(rx, ry) => (
										<CardShell
											style={selected.view.style}
											width={detailCardWidth}
											foil={foilForTier(selected.tier)}
											seed={selected.card_id ?? selected.id}
											rx={rx}
											ry={ry}
											overlay={
												<CardOverlay view={selected.view} width={detailCardWidth} rx={rx} ry={ry} />
											}
										>
											<CardFace view={selected.view} width={detailCardWidth} />
										</CardShell>
									)}
									// A collected card carries no code — no remote re-scan — so
									// its back is the collector's record, never QR. A scan still
									// waiting to sync has no giver data yet, so it shows the
									// placeholder back: neutral edge, stand-in code.
									renderBack={(rx, ry) => (
										<CardBack
											style={selected.view.style}
											width={detailCardWidth}
											variant={selected.pending ? 'placeholder' : 'record'}
											url={profileUrl(SITE_ORIGIN, selected.view.handle).replace(
												/^https?:\/\//,
												''
											)}
											record={{
												collected: formatCollectedDate(selected.first_scanned_at),
												event: selected.pending ? 'Pending sync' : 'In person',
												note:
													selected.meeting_count > 1
														? `Met ${selected.meeting_count} times · last on ${formatCollectedDate(selected.last_scanned_at)}`
														: 'First meeting logged.'
											}}
											rx={rx}
											ry={ry}
										/>
									)}
								/>
							</View>
							<Text style={styles.tiltHint}>DRAG TO MOVE THE LIGHT · TAP TO FLIP</Text>
							<View style={styles.progress}>
								<View style={styles.progressHead}>
									<Text style={styles.progressTier}>{tierLabel(selected.tier)} tier</Text>
									<Text style={styles.progressCount}>{selected.meeting_count} encounters</Text>
								</View>
								<View style={styles.progressTrack}>
									<View
										style={[
											styles.progressFill,
											{ width: `${Math.min(100, (selected.meeting_count / 8) * 100)}%` }
										]}
									/>
								</View>
								<Text style={styles.progressHint}>
									{meetingsToNextTier(selected.meeting_count)
										? `${meetingsToNextTier(selected.meeting_count)} more meeting${meetingsToNextTier(selected.meeting_count) === 1 ? '' : 's'} to the next foil`
										: 'Maximum foil reached'}
								</Text>
							</View>
						</View>
					) : null}
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
	sortGlyph: { gap: 3, alignItems: 'flex-start' },
	sortBar: { height: 1.5, borderRadius: 1, backgroundColor: palette.textFaint },
	chips: { flexDirection: 'row', gap: space.sm },
	queue: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		padding: space.md,
		borderRadius: radius.md,
		backgroundColor: 'rgba(159,240,220,0.08)',
		borderWidth: 1,
		borderColor: 'rgba(159,240,220,0.22)'
	},
	queueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.teal },
	queueText: { ...type.small, color: palette.teal },
	syncErrorBanner: {
		padding: space.md,
		borderRadius: radius.md,
		backgroundColor: 'rgba(255,92,92,0.14)',
		borderWidth: 1,
		borderColor: 'rgba(255,92,92,0.3)'
	},
	syncErrorText: { ...type.small, color: palette.textPrimary },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'flex-start' },
	cell: {
		backgroundColor: palette.surface,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: palette.line,
		padding: space.sm,
		gap: space.sm,
		boxShadow: shadow.grid
	},
	pendingBadge: {
		position: 'absolute',
		top: space.md,
		left: space.md,
		paddingVertical: 3,
		paddingHorizontal: space.xs,
		borderRadius: radius.pill,
		backgroundColor: 'rgba(14,13,18,0.85)',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.teal
	},
	pendingBadgeText: { ...type.meta, color: palette.teal, fontSize: 8 },
	cellFooter: { gap: 2 },
	cardName: { fontFamily: 'Outfit-SemiBold', fontSize: 13, color: palette.textPrimary },
	tier: { fontFamily: 'Outfit-Regular', fontSize: 11, color: palette.textFaint },
	empty: {
		alignItems: 'center',
		gap: space.sm,
		padding: space.xxl,
		borderRadius: radius.lg,
		borderWidth: 1,
		borderStyle: 'dashed',
		borderColor: palette.mutedUi
	},
	emptyTitle: { ...type.title, color: palette.textPrimary },
	body: { ...type.small, color: palette.textDim, textAlign: 'center' },
	modalScrim: {
		flex: 1,
		backgroundColor: 'rgba(10,9,14,0.9)',
		alignItems: 'center',
		justifyContent: 'center',
		padding: space.xl
	},
	detail: {
		width: '100%',
		maxWidth: 400,
		alignItems: 'center',
		gap: space.lg,
		padding: space.lg,
		borderRadius: radius.lg,
		backgroundColor: palette.surface,
		borderWidth: 1,
		borderColor: palette.line,
		overflow: 'hidden'
	},
	detailCardStage: {
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
		borderRadius: radius.lg
	},
	detailTop: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	detailTitle: { ...type.title, color: palette.textPrimary },
	close: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: palette.raised
	},
	closeText: { fontSize: 24, color: palette.textPrimary },
	progress: { width: '100%', gap: space.sm },
	tiltHint: { ...type.meta, color: palette.textFaint, fontSize: 9 },
	progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
	progressTier: { ...type.bodyStrong, color: palette.holo },
	progressCount: { ...type.small, color: palette.textDim },
	progressTrack: {
		height: 7,
		borderRadius: 4,
		overflow: 'hidden',
		backgroundColor: palette.raised
	},
	progressFill: { height: '100%', backgroundColor: palette.holo },
	progressHint: { ...type.small, color: palette.textFaint }
});
