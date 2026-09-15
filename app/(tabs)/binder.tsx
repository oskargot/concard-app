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

import { CardFace } from '@/card/CardFace';
import { CardShell } from '@/card/CardShell';
import { StaticCard } from '@/card/FlipCard';
import { StickerLayer } from '@/card/StickerLayer';
import { foilForTier, meetingsToNextTier, tierLabel } from '@/card/tiers';
import type { CollectedCard } from '@/card/types';
import { useConcardStore } from '@/store/useConcardStore';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

export default function BinderScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const cards = useConcardStore((state) => state.binder_cache);
	const pending = useConcardStore((state) => state.scan_queue.length);
	const [sort, setSort] = useState<'recent' | 'tier'>('recent');
	const [selected, setSelected] = useState<CollectedCard | null>(null);
	const cardWidth = (width - space.xl * 2 - space.sm * 2) / 3;
	const sorted = useMemo(
		() =>
			[...cards].sort((a, b) =>
				sort === 'tier'
					? b.tier - a.tier
					: Date.parse(b.last_scanned_at) - Date.parse(a.last_scanned_at)
			),
		[cards, sort]
	);

	return (
		<>
			<ScrollView
				contentContainerStyle={[
					styles.page,
					{ paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl }
				]}
			>
				<View style={styles.header}>
					<View>
						<Text style={styles.eyebrow}>COLLECTION / {cards.length}</Text>
						<Text style={styles.title}>Your binder</Text>
					</View>
					<View style={styles.sort}>
						{(['recent', 'tier'] as const).map((item) => (
							<Pressable
								key={item}
								onPress={() => setSort(item)}
								style={[styles.sortChoice, sort === item && styles.sortOn]}
							>
								<Text style={[styles.sortText, sort === item && styles.sortTextOn]}>
									{item.toUpperCase()}
								</Text>
							</Pressable>
						))}
					</View>
				</View>

				{pending ? (
					<View style={styles.queue}>
						<View style={styles.queueDot} />
						<Text style={styles.queueText}>
							{pending} new encounter{pending === 1 ? '' : 's'} saved · finishing when online
						</Text>
					</View>
				) : null}

				<View style={styles.grid}>
					{sorted.map((card) => (
						<Pressable key={card.id} onPress={() => setSelected(card)} style={{ width: cardWidth }}>
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
										overlay={<StickerLayer stickers={card.view.stickers} width={cardWidth} />}
									>
										<CardFace view={card.view} width={cardWidth} />
										{!card.view.art_url ? <View style={styles.pendingPhoto} /> : null}
									</CardShell>
								)}
							/>
							<Text numberOfLines={1} style={styles.cardName}>
								@{card.view.handle}
							</Text>
							<View style={styles.tierRow}>
								<Text style={styles.tier}>{tierLabel(card.tier).toUpperCase()}</Text>
								<Text style={styles.meetings}>×{card.meeting_count}</Text>
							</View>
						</Pressable>
					))}
				</View>

				{cards.length === 0 ? (
					<View style={styles.empty}>
						<Text style={styles.emptyGlyph}>▦</Text>
						<Text style={styles.emptyTitle}>Your first page is waiting</Text>
						<Text style={styles.body}>Scan someone’s Concard and they’ll land right here.</Text>
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
								<View>
									<Text style={styles.eyebrow}>BINDER CARD</Text>
									<Text style={styles.detailTitle}>@{selected.view.handle}</Text>
								</View>
								<Pressable onPress={() => setSelected(null)} style={styles.close}>
									<Text style={styles.closeText}>×</Text>
								</Pressable>
							</View>
							<StaticCard
								width={Math.min(width - space.xl * 4, 310)}
								render={(rx, ry) => (
									<CardShell
										style={selected.view.style}
										width={Math.min(width - space.xl * 4, 310)}
										foil={foilForTier(selected.tier)}
										seed={selected.card_id ?? selected.id}
										rx={rx}
										ry={ry}
										overlay={
											<StickerLayer
												stickers={selected.view.stickers}
												width={Math.min(width - space.xl * 4, 310)}
											/>
										}
									>
										<CardFace view={selected.view} width={Math.min(width - space.xl * 4, 310)} />
									</CardShell>
								)}
							/>
							<View style={styles.progress}>
								<View style={styles.progressHead}>
									<Text style={styles.progressTier}>{tierLabel(selected.tier)} tier</Text>
									<Text style={styles.progressCount}>{selected.meeting_count} encounters</Text>
								</View>
								<View style={styles.progressTrack}>
									<View
										style={[
											styles.progressFill,
											{
												width: `${Math.min(100, (selected.meeting_count / 8) * 100)}%`
											}
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
	header: { gap: space.md },
	eyebrow: { ...type.meta, color: palette.teal },
	title: { ...type.hero, color: palette.cream },
	sort: {
		flexDirection: 'row',
		alignSelf: 'flex-start',
		padding: 3,
		borderRadius: radius.md,
		backgroundColor: palette.raised
	},
	sortChoice: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.sm },
	sortOn: { backgroundColor: palette.raisedHigh },
	sortText: { ...type.meta, color: palette.creamFaint, fontSize: 9 },
	sortTextOn: { color: palette.rose },
	queue: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		padding: space.md,
		borderRadius: radius.md,
		backgroundColor: 'rgba(69,229,213,0.1)',
		borderWidth: 1,
		borderColor: 'rgba(69,229,213,0.25)'
	},
	queueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.teal },
	queueText: { ...type.small, color: palette.teal },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'flex-start' },
	pendingPhoto: {
		position: 'absolute',
		top: '5%',
		left: '7%',
		right: '7%',
		height: '34%',
		borderRadius: radius.sm,
		backgroundColor: 'rgba(247,240,228,0.08)',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: 'rgba(247,240,228,0.18)'
	},
	cardName: { ...type.small, color: palette.cream, marginTop: space.xs },
	tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	tier: { ...type.meta, color: palette.butter, fontSize: 8 },
	meetings: { ...type.small, color: palette.creamFaint },
	empty: {
		alignItems: 'center',
		gap: space.sm,
		padding: space.xxl,
		borderRadius: radius.xl,
		borderWidth: 1,
		borderStyle: 'dashed',
		borderColor: palette.lineStrong
	},
	emptyGlyph: { fontSize: 42, color: palette.teal },
	emptyTitle: { ...type.title, color: palette.cream },
	body: { ...type.small, color: palette.creamMute, textAlign: 'center' },
	modalScrim: {
		flex: 1,
		backgroundColor: 'rgba(18,7,32,0.88)',
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
		borderRadius: radius.xl,
		backgroundColor: palette.raised,
		borderWidth: 1,
		borderColor: palette.lineStrong
	},
	detailTop: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	detailTitle: { ...type.title, color: palette.cream },
	close: {
		width: 38,
		height: 38,
		borderRadius: 19,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: palette.raisedHigh
	},
	closeText: { fontSize: 26, color: palette.cream },
	progress: { width: '100%', gap: space.sm },
	progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
	progressTier: { ...type.bodyStrong, color: palette.butter },
	progressCount: { ...type.small, color: palette.creamMute },
	progressTrack: {
		height: 7,
		borderRadius: 4,
		overflow: 'hidden',
		backgroundColor: palette.raisedHigh
	},
	progressFill: { height: '100%', backgroundColor: palette.rose },
	progressHint: { ...type.small, color: palette.creamFaint }
});
