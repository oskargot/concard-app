import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
	RARITY_COLOR,
	STICKER_CATALOG,
	type StickerDefinition,
	type StickerRarity
} from '@/stickers/catalog';
import { useConcardStore } from '@/store/useConcardStore';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

type Filter = 'all' | StickerRarity;

export default function StickersScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const [filter, setFilter] = useState<Filter>('all');
	const [selected, setSelected] = useState<StickerDefinition | null>(null);
	const equipped = useConcardStore((state) => state.active_card.stickers);
	const visible = useMemo(
		() => STICKER_CATALOG.filter((sticker) => filter === 'all' || sticker.rarity === filter),
		[filter]
	);

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.header}>
				<View>
					<Text style={styles.eyebrow}>YOUR LOOT</Text>
					<Text style={styles.title}>Sticker stash</Text>
				</View>
				<View style={styles.counter}>
					<Text style={styles.counterValue}>
						{STICKER_CATALOG.filter((item) => item.unlocked).length}
					</Text>
					<Text style={styles.counterLabel}>FOUND</Text>
				</View>
			</View>

			<Text style={styles.intro}>
				Decorate your card with convention drops. Rarer stickers shimmer harder.
			</Text>

			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.filters}>
					{(['all', 'common', 'uncommon', 'rare', 'legendary'] as Filter[]).map((item) => (
						<Pressable
							key={item}
							onPress={() => setFilter(item)}
							style={[styles.filter, filter === item && styles.filterOn]}
						>
							<Text style={[styles.filterText, filter === item && styles.filterTextOn]}>
								{item.toUpperCase()}
							</Text>
						</Pressable>
					))}
				</View>
			</ScrollView>

			<View style={styles.grid}>
				{visible.map((sticker) => {
					const count = sticker.unlocked ? (sticker.rarity === 'common' ? 3 : 1) : 0;
					const onCard = equipped.filter((placed) => placed.sticker_id === sticker.id).length;
					return (
						<Pressable
							key={sticker.id}
							style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
							onPress={() => setSelected(sticker)}
						>
							<View
								style={[
									styles.sticker,
									{ backgroundColor: sticker.unlocked ? sticker.color : palette.raisedHigh },
									sticker.foil === 'holo' && styles.holo
								]}
							>
								<Text style={[styles.glyph, !sticker.unlocked && styles.lockedGlyph]}>
									{sticker.unlocked ? sticker.glyph : '?'}
								</Text>
							</View>
							<Text style={styles.name}>{sticker.unlocked ? sticker.name : '???'}</Text>
							<View style={styles.metaRow}>
								<Text style={[styles.rarity, { color: RARITY_COLOR[sticker.rarity] }]}>
									{sticker.rarity.toUpperCase()}
								</Text>
								<Text style={styles.quantity}>×{count}</Text>
							</View>
							{onCard ? <Text style={styles.equipped}>ON CARD ×{onCard}</Text> : null}
						</Pressable>
					);
				})}
			</View>

			<View style={styles.combine}>
				<Text style={styles.combineGlyph}>✦</Text>
				<View style={styles.combineCopy}>
					<Text style={styles.combineTitle}>Duplicates become foil</Text>
					<Text style={styles.combineBody}>
						Collect two matching stickers to combine them: base → glitter → holo.
					</Text>
				</View>
			</View>

			{selected ? (
				<View style={styles.detail}>
					<Pressable onPress={() => setSelected(null)} style={styles.close}>
						<Text style={styles.closeText}>×</Text>
					</Pressable>
					<View
						style={[
							styles.detailSticker,
							{ backgroundColor: selected.unlocked ? selected.color : palette.raisedHigh }
						]}
					>
						<Text style={styles.detailGlyph}>{selected.unlocked ? selected.glyph : '?'}</Text>
					</View>
					<Text style={styles.detailTitle}>
						{selected.unlocked ? selected.name : 'Undiscovered'}
					</Text>
					<Text style={[styles.rarity, { color: RARITY_COLOR[selected.rarity] }]}>
						{selected.rarity.toUpperCase()} · {selected.foil.toUpperCase()}
					</Text>
					<Text style={styles.detailBody}>
						{selected.unlocked
							? 'Ready to place, resize and rotate on your active card.'
							: 'Keep meeting people. Some encounters carry secret drops.'}
					</Text>
					{selected.unlocked ? (
						<Pressable style={styles.useButton} onPress={() => router.push('/card' as never)}>
							<Text style={styles.useButtonText}>USE ON MY CARD</Text>
						</Pressable>
					) : null}
				</View>
			) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	eyebrow: { ...type.meta, color: palette.teal },
	title: { ...type.hero, color: palette.cream },
	counter: {
		width: 64,
		height: 64,
		borderRadius: radius.lg,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: palette.raised,
		borderWidth: 1,
		borderColor: palette.lineStrong
	},
	counterValue: { ...type.title, color: palette.butter },
	counterLabel: { ...type.meta, color: palette.creamFaint, fontSize: 8 },
	intro: { ...type.body, color: palette.creamMute },
	filters: { flexDirection: 'row', gap: space.sm },
	filter: {
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	filterOn: { backgroundColor: palette.teal, borderColor: palette.teal },
	filterText: { ...type.meta, color: palette.creamFaint, fontSize: 9 },
	filterTextOn: { color: palette.void },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
	tile: {
		width: '47%',
		padding: space.md,
		gap: space.sm,
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	sticker: {
		aspectRatio: 1,
		borderRadius: radius.xl,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 3,
		borderColor: 'rgba(247,240,228,0.68)'
	},
	holo: { boxShadow: `0 0 18px ${palette.tealGlow}` },
	glyph: { ...type.hero, color: palette.void, fontSize: 46 },
	lockedGlyph: { color: palette.creamFaint },
	name: { ...type.bodyStrong, color: palette.cream },
	metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
	rarity: { ...type.meta, fontSize: 8 },
	quantity: { ...type.small, color: palette.creamMute },
	equipped: { ...type.meta, color: palette.teal, fontSize: 8 },
	pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
	combine: {
		flexDirection: 'row',
		gap: space.md,
		padding: space.lg,
		borderRadius: radius.lg,
		backgroundColor: 'rgba(255,217,138,0.1)',
		borderWidth: 1,
		borderColor: 'rgba(255,217,138,0.28)'
	},
	combineGlyph: { ...type.hero, color: palette.butter },
	combineCopy: { flex: 1, gap: 2 },
	combineTitle: { ...type.bodyStrong, color: palette.butter },
	combineBody: { ...type.small, color: palette.creamMute },
	detail: {
		position: 'relative',
		alignItems: 'center',
		gap: space.sm,
		padding: space.xl,
		borderRadius: radius.xl,
		backgroundColor: palette.raisedHigh,
		borderWidth: 1,
		borderColor: palette.tealDim
	},
	close: { position: 'absolute', top: space.md, right: space.md, zIndex: 2, padding: space.xs },
	closeText: { fontSize: 24, color: palette.creamMute },
	detailSticker: {
		width: 110,
		height: 110,
		borderRadius: 55,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 3,
		borderColor: palette.cream
	},
	detailGlyph: { ...type.hero, fontSize: 56, color: palette.void },
	detailTitle: { ...type.title, color: palette.cream },
	detailBody: { ...type.small, color: palette.creamMute, textAlign: 'center' },
	useButton: {
		marginTop: space.sm,
		paddingVertical: space.md,
		paddingHorizontal: space.xl,
		backgroundColor: palette.rose,
		borderRadius: radius.md
	},
	useButtonText: { ...type.meta, color: palette.void }
});
