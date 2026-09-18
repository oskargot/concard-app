import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import type { StickerFoil } from '@/card/tiers';
import { STICKER_CATALOG, type StickerDefinition } from '@/stickers/catalog';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';
import { Button, Chip, CountBadge, IconCircle, ScreenHeader } from '@/ui';

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
	const router = useRouter();
	const [filter, setFilter] = useState<Filter>('all');
	const [selected, setSelected] = useState<StickerDefinition | null>(null);
	const visible = useMemo(
		() => STICKER_CATALOG.filter((sticker) => filter === 'all' || sticker.foil === filter),
		[filter]
	);
	const owned = STICKER_CATALOG.filter((item) => item.unlocked).length;
	// 3-column grid, 24px gutters, 12px gap.
	const tileWidth = (width - space.xl * 2 - space.md * 2) / 3;

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<ScreenHeader
				title="Stickers"
				right={
					<View style={styles.headerRight}>
						<CountBadge>{owned} owned</CountBadge>
						<IconCircle label="Grid layout">
							<View style={styles.gridGlyph}>
								<View style={styles.gridDot} />
								<View style={styles.gridDot} />
								<View style={styles.gridDot} />
								<View style={styles.gridDot} />
							</View>
						</IconCircle>
					</View>
				}
			/>

			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.chips}>
					{FILTERS.map((item) => (
						<Chip
							key={item.value}
							label={item.label}
							active={filter === item.value}
							onPress={() => setFilter(item.value)}
						/>
					))}
				</View>
			</ScrollView>

			<View style={styles.grid}>
				{visible.map((sticker) => (
					<Pressable
						key={sticker.id}
						style={({ pressed }) => [
							styles.tile,
							{ width: tileWidth },
							sticker.unlocked ? styles.tileOwned : styles.tileLocked,
							pressed && styles.pressed
						]}
						onPress={() => setSelected(sticker)}
					>
						<View style={styles.tileImage}>
							<Text
								style={[
									styles.glyph,
									{ color: sticker.unlocked ? sticker.color : palette.textFaint }
								]}
							>
								{sticker.unlocked ? sticker.glyph : '?'}
							</Text>
						</View>
						<View style={styles.tileLabel}>
							<Text numberOfLines={1} style={styles.tileTitle}>
								{sticker.unlocked ? sticker.name : '???'}
							</Text>
							<Text
								style={[
									styles.tileStatus,
									sticker.unlocked ? styles.statusOwned : styles.statusLocked
								]}
							>
								{sticker.unlocked ? 'Owned' : 'Locked'}
							</Text>
						</View>
					</Pressable>
				))}
			</View>

			<Text style={styles.bottomHint}>Scan cards to unlock new stickers ✦</Text>

			{selected ? (
				<View style={styles.detail}>
					<Pressable onPress={() => setSelected(null)} style={styles.close}>
						<Text style={styles.closeText}>×</Text>
					</Pressable>
					<View
						style={[
							styles.detailSticker,
							{ backgroundColor: selected.unlocked ? selected.color : palette.raised }
						]}
					>
						<Text style={styles.detailGlyph}>{selected.unlocked ? selected.glyph : '?'}</Text>
					</View>
					<Text style={styles.detailTitle}>
						{selected.unlocked ? selected.name : 'Undiscovered'}
					</Text>
					<Text style={styles.detailFoil}>
						{selected.foil === 'none' ? 'BASE' : selected.foil.toUpperCase()}
					</Text>
					<Text style={styles.detailBody}>
						{selected.unlocked
							? 'Ready to place, resize and rotate on your active card.'
							: 'Keep meeting people. Some encounters carry secret drops.'}
					</Text>
					{selected.unlocked ? (
						<Button label="Use on my card" onPress={() => router.push('/card' as never)} />
					) : null}
				</View>
			) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
	gridGlyph: {
		width: 14,
		height: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		alignContent: 'space-between'
	},
	gridDot: { width: 5, height: 5, borderRadius: 1.5, backgroundColor: palette.textFaint },
	pressed: { opacity: 0.74 },
	chips: { flexDirection: 'row', gap: space.sm },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
	tile: {
		backgroundColor: palette.surface,
		borderRadius: radius.md,
		overflow: 'hidden'
	},
	tileOwned: { borderWidth: 1, borderColor: palette.line },
	tileLocked: { borderWidth: 1, borderColor: palette.line, opacity: 0.5 },
	tileImage: {
		height: 90,
		backgroundColor: palette.raised,
		alignItems: 'center',
		justifyContent: 'center'
	},
	glyph: { fontSize: 34 },
	tileLabel: { padding: space.sm, gap: 2 },
	tileTitle: {
		fontFamily: 'Outfit-SemiBold',
		fontSize: 11,
		lineHeight: 14,
		color: palette.textPrimary
	},
	tileStatus: { fontFamily: 'Outfit-Regular', fontSize: 10 },
	statusOwned: { color: palette.textDim },
	statusLocked: { color: palette.textFaint },
	bottomHint: { ...type.small, color: palette.textGhost, textAlign: 'center', marginTop: space.sm },
	detail: {
		position: 'relative',
		alignItems: 'center',
		gap: space.sm,
		padding: space.xl,
		borderRadius: radius.lg,
		backgroundColor: palette.surface,
		borderWidth: 1,
		borderColor: palette.line
	},
	close: { position: 'absolute', top: space.md, right: space.md, zIndex: 2, padding: space.xs },
	closeText: { fontSize: 24, color: palette.textDim },
	detailSticker: {
		width: 110,
		height: 110,
		borderRadius: 55,
		alignItems: 'center',
		justifyContent: 'center'
	},
	detailGlyph: { fontSize: 56, color: palette.ground },
	detailTitle: { ...type.title, color: palette.textPrimary },
	detailFoil: { ...type.meta, color: palette.textDim },
	detailBody: { ...type.small, color: palette.textDim, textAlign: 'center' }
});
