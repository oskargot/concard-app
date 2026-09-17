import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StickerFoil } from '@/card/tiers';
import { STICKER_CATALOG, type StickerDefinition } from '@/stickers/catalog';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

type Filter = 'all' | StickerFoil;

const FILTERS: { value: Filter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'none', label: 'Base' },
	{ value: 'glitter', label: 'Glitter' },
	{ value: 'holo', label: 'Holo' }
];

export default function StickersScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const [filter, setFilter] = useState<Filter>('all');
	const [selected, setSelected] = useState<StickerDefinition | null>(null);
	const visible = useMemo(
		() => STICKER_CATALOG.filter((sticker) => filter === 'all' || sticker.foil === filter),
		[filter]
	);
	const tileWidth = (width - space.xl * 2 - space.sm * 3) / 4;

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
				Decorate your card with convention drops, from base finds to full holo.
			</Text>

			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.filters}>
					{FILTERS.map((item) => (
						<Pressable
							key={item.value}
							onPress={() => setFilter(item.value)}
							style={[styles.filter, filter === item.value && styles.filterOn]}
						>
							<Text style={[styles.filterText, filter === item.value && styles.filterTextOn]}>
								{item.label.toUpperCase()}
							</Text>
						</Pressable>
					))}
				</View>
			</ScrollView>

			<View style={styles.grid}>
				{visible.map((sticker) => {
					const count = sticker.unlocked ? (sticker.foil === 'none' ? 3 : 1) : 0;
					return (
						<Pressable
							key={sticker.id}
							style={({ pressed }) => [
								styles.tile,
								{ width: tileWidth },
								pressed && styles.pressed
							]}
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
								{sticker.unlocked ? (
									<View style={styles.quantityBadge}>
										<Text style={styles.quantity}>×{count}</Text>
									</View>
								) : null}
							</View>
							<Text numberOfLines={1} style={styles.name}>
								{sticker.unlocked ? sticker.name : '???'}
							</Text>
							<Text style={[styles.foil, sticker.foil === 'holo' && styles.foilHolo]}>
								{sticker.foil === 'none' ? 'BASE' : sticker.foil.toUpperCase()}
							</Text>
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
					<Text style={[styles.detailFoil, selected.foil === 'holo' && styles.foilHolo]}>
						{selected.foil === 'none' ? 'BASE' : selected.foil.toUpperCase()}
					</Text>
					<Text style={styles.detailBody}>
						{selected.unlocked
							? 'Ready to place, resize and rotate on your active card.'
							: 'Keep meeting people. Some encounters carry secret drops.'}
					</Text>
					{selected.unlocked ? (
						<View
							style={styles.useButton}
							accessibilityRole="button"
							accessibilityState={{ disabled: true }}
						>
							<Text style={styles.useButtonText}>EQUIP — COMING SOON</Text>
						</View>
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
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
	tile: {
		padding: 6,
		gap: space.xs,
		aspectRatio: 0.9,
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	sticker: {
		width: 42,
		height: 42,
		alignSelf: 'center',
		borderRadius: 21,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 3,
		borderColor: 'rgba(247,240,228,0.68)'
	},
	holo: { boxShadow: `0 0 18px ${palette.tealGlow}` },
	glyph: { ...type.hero, color: palette.void, fontSize: 32 },
	lockedGlyph: { color: palette.creamFaint },
	name: { ...type.small, color: palette.cream, minHeight: 18 },
	foil: { ...type.meta, color: palette.creamFaint, fontSize: 8 },
	foilHolo: { color: palette.teal },
	quantityBadge: {
		position: 'absolute',
		right: -7,
		top: -5,
		minWidth: 23,
		height: 18,
		paddingHorizontal: 4,
		borderRadius: radius.pill,
		backgroundColor: palette.void,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: palette.lineStrong
	},
	quantity: { ...type.meta, color: palette.cream, fontSize: 8, letterSpacing: 0 },
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
	detailFoil: { ...type.meta, color: palette.creamMute },
	detailBody: { ...type.small, color: palette.creamMute, textAlign: 'center' },
	useButton: {
		marginTop: space.sm,
		paddingVertical: space.md,
		paddingHorizontal: space.xl,
		backgroundColor: palette.raised,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: palette.line,
		opacity: 0.62
	},
	useButtonText: { ...type.meta, color: palette.creamFaint }
});
