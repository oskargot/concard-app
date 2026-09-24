/**
 * Stickers: your inventory, and where duplicates combine (HANDOFF §2.3).
 *
 * The same Deco / Fandom switch as the editor's drawer, plus a chip per rung
 * of the foil ladder. Every (sticker, foil) pile you own is a tile, drawn with
 * its real foil. Tap one for its detail: how many you own, how many are on your
 * cards, and — with two spare copies below mosaic — Combine, which turns them
 * into one copy at the next foil and plays a short reveal of it.
 *
 * Live inventory when signed in; the on-device one otherwise.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StickerKindSwitch, type StickerKindTab } from '@/card/editor/StickerDrawer';
import { TILT_RANGE } from '@/card/FlipCard';
import {
	nextStickerFoil,
	STICKER_FOIL_LABELS,
	STICKER_FOILS,
	type StickerFoil
} from '@/card/tiers';
import type { PlacedSticker } from '@/card/types';
import { definitionForPlacement } from '@/stickers/definitions';
import { entryKey, placementFields, type InventoryEntry } from '@/stickers/inventory';
import { StickerRenderer } from '@/stickers/StickerRenderer';
import { canCombine, useStickerInventory } from '@/stickers/use-sticker-inventory';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';
import { Button, Chip, CountBadge, FormError, HoloButton, ScreenHeader } from '@/ui';

type Filter = 'all' | StickerFoil;

const COLUMNS = 3;

function definitionOf(entry: InventoryEntry) {
	return definitionForPlacement({
		...placementFields(entry.sticker),
		sticker_id: entry.sticker.id
	} as PlacedSticker);
}

export default function StickersScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const inventory = useStickerInventory();
	const [kind, setKind] = useState<StickerKindTab>('deco');
	const [filter, setFilter] = useState<Filter>('all');
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	/** The pile a combine just made, so its sheet opens with the reveal. */
	const [revealKey, setRevealKey] = useState<string | null>(null);

	const ofKind = useMemo(
		() => inventory.entries.filter((e) => e.sticker.kind === kind),
		[inventory.entries, kind]
	);
	const visible = useMemo(
		() => ofKind.filter((e) => filter === 'all' || e.foil === filter),
		[ofKind, filter]
	);
	const copies = inventory.entries.reduce((n, e) => n + e.quantity, 0);
	const selected = inventory.entries.find((e) => entryKey(e) === selectedKey) ?? null;

	const tileWidth = (width - space.xl * 2 - space.md * (COLUMNS - 1)) / COLUMNS;

	return (
		<View style={styles.flex}>
			<ScrollView
				contentContainerStyle={[
					styles.page,
					{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xxl }
				]}
			>
				<ScreenHeader title="Stickers" right={<CountBadge>{copies} owned</CountBadge>} />

				<StickerKindSwitch value={kind} onChange={setKind} />

				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View style={styles.chips}>
						{(['all', ...STICKER_FOILS] as Filter[]).map((f) => (
							<Chip
								key={f}
								label={f === 'all' ? 'All' : STICKER_FOIL_LABELS[f]}
								active={filter === f}
								onPress={() => setFilter(f)}
							/>
						))}
					</View>
				</ScrollView>

				<FormError message={inventory.error} />

				{visible.length ? (
					<View style={styles.grid}>
						{visible.map((entry) => (
							<Pressable
								key={entryKey(entry)}
								onPress={() => setSelectedKey(entryKey(entry))}
								accessibilityRole="button"
								accessibilityLabel={`${entry.sticker.name}, ${STICKER_FOIL_LABELS[entry.foil]}, ${entry.quantity} owned`}
								style={({ pressed }) => [
									styles.tile,
									{ width: tileWidth },
									pressed && styles.pressed
								]}
							>
								<View style={styles.tileArt}>
									<StickerRenderer
										definition={definitionOf(entry)}
										foil={entry.foil}
										width={tileWidth * 0.62}
										art="thumb"
									/>
								</View>
								<View style={styles.tileLabel}>
									<Text numberOfLines={1} style={styles.tileTitle}>
										{entry.sticker.name}
									</Text>
									<Text style={styles.tileCount}>×{entry.quantity}</Text>
								</View>
							</Pressable>
						))}
					</View>
				) : (
					<Text style={styles.empty}>
						{inventory.loading
							? 'Loading your stickers…'
							: filter === 'all'
								? `No ${kind} stickers yet. Collect cards to find some.`
								: `No ${STICKER_FOIL_LABELS[filter].toLowerCase()} ${kind} stickers yet.`}
					</Text>
				)}

				<Text style={styles.bottomHint}>
					Two spare copies at one foil combine into one at the next.
				</Text>
			</ScrollView>

			{selected ? (
				<StickerDetail
					key={entryKey(selected)}
					entry={selected}
					reveal={entryKey(selected) === revealKey}
					onClose={() => {
						setSelectedKey(null);
						setRevealKey(null);
					}}
					onCombine={async (entry) => {
						const next = await inventory.combine(entry);
						const key = entryKey({ sticker: entry.sticker, foil: next });
						setRevealKey(key);
						setSelectedKey(key);
					}}
					bottomInset={insets.bottom}
				/>
			) : null}
		</View>
	);
}

/**
 * One pile, big enough to tilt. Drag the sticker to catch the light, like a
 * card. A combine lands here as a reveal: the new copy pops in while a sweep of
 * light crosses it — the foil engine's own tilt, animated, not a new effect.
 */
function StickerDetail({
	entry,
	reveal,
	onClose,
	onCombine,
	bottomInset
}: {
	entry: InventoryEntry;
	/** Just made by a combine: play the reveal. */
	reveal: boolean;
	onClose: () => void;
	onCombine: (entry: InventoryEntry) => Promise<void>;
	bottomInset: number;
}) {
	const rx = useSharedValue(0);
	const ry = useSharedValue(0);
	const pop = useSharedValue(reveal ? 0.55 : 1);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const light = useMemo(() => ({ rx, ry }), [rx, ry]);
	const definition = useMemo(() => definitionOf(entry), [entry]);
	const next = nextStickerFoil(entry.foil);

	const tilt = Gesture.Pan()
		.onUpdate((e) => {
			ry.set(Math.max(-TILT_RANGE, Math.min(TILT_RANGE, e.translationX / 12)));
			rx.set(Math.max(-TILT_RANGE, Math.min(TILT_RANGE, -e.translationY / 12)));
		})
		.onEnd(() => {
			rx.set(withSpring(0));
			ry.set(withSpring(0));
		});

	const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

	// The reveal: the new copy pops in while the light sweeps across it.
	useEffect(() => {
		if (!reveal) return;
		pop.set(withSequence(withSpring(1.08, { damping: 9 }), withSpring(1, { damping: 14 })));
		ry.set(
			withSequence(
				withTiming(-TILT_RANGE, { duration: 0 }),
				withTiming(TILT_RANGE, { duration: 900 }),
				withTiming(0, { duration: 500 })
			)
		);
		rx.set(
			withSequence(
				withTiming(TILT_RANGE * 0.5, { duration: 700 }),
				withTiming(0, { duration: 700 })
			)
		);
	}, [reveal, pop, rx, ry]);

	const combine = async () => {
		setBusy(true);
		setError(null);
		try {
			// on success the parent moves this sheet to the new pile
			await onCombine(entry);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setBusy(false);
		}
	};

	return (
		<View style={styles.backdrop}>
			<Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
			<View style={[styles.sheet, { paddingBottom: bottomInset + space.xl }]}>
				<GestureDetector gesture={tilt}>
					<Animated.View style={[styles.detailArt, popStyle]}>
						<StickerRenderer definition={definition} foil={entry.foil} width={150} light={light} />
					</Animated.View>
				</GestureDetector>
				{reveal ? (
					<Text style={styles.revealLine}>New {STICKER_FOIL_LABELS[entry.foil]}!</Text>
				) : null}
				<Text style={styles.detailTitle}>{entry.sticker.name}</Text>
				<Text style={styles.detailFoil}>{STICKER_FOIL_LABELS[entry.foil].toUpperCase()}</Text>
				<View style={styles.counts}>
					<Count label="Owned" value={entry.quantity} />
					<Count label="On cards" value={entry.placed} />
					<Count label="Spare" value={entry.available} />
				</View>

				{canCombine(entry) && next ? (
					<HoloButton
						label={`Combine 2 → 1 ${STICKER_FOIL_LABELS[next]}`}
						onPress={combine}
						busy={busy}
					/>
				) : (
					<Text style={styles.combineNote}>
						{next
							? `Two spare copies combine into one ${STICKER_FOIL_LABELS[next]}.`
							: 'Mosaic is the top of the ladder.'}
					</Text>
				)}
				<FormError message={error} />
				<Button label="Done" variant="ghost" onPress={onClose} />
			</View>
		</View>
	);
}

function Count({ label, value }: { label: string; value: number }) {
	return (
		<View style={styles.count}>
			<Text style={styles.countValue}>{value}</Text>
			<Text style={styles.countLabel}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, backgroundColor: palette.ground },
	page: { paddingHorizontal: space.xl, gap: space.lg },
	pressed: { opacity: 0.74 },
	chips: { flexDirection: 'row', gap: space.sm },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
	tile: {
		backgroundColor: palette.surface,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		overflow: 'hidden'
	},
	tileArt: {
		height: 96,
		backgroundColor: palette.raised,
		alignItems: 'center',
		justifyContent: 'center'
	},
	tileLabel: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: space.sm,
		gap: space.xs
	},
	tileTitle: { ...type.small, flexShrink: 1, color: palette.textPrimary },
	tileCount: { ...type.small, color: palette.textDim },
	empty: { ...type.body, color: palette.textFaint, textAlign: 'center', marginTop: space.xl },
	bottomHint: { ...type.small, color: palette.textFaint, textAlign: 'center', marginTop: space.sm },
	backdrop: {
		...StyleSheet.absoluteFill,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(8,8,11,0.6)'
	},
	sheet: {
		alignItems: 'center',
		gap: space.sm,
		paddingTop: space.xl,
		paddingHorizontal: space.xl,
		borderTopLeftRadius: radius.lg + 4,
		borderTopRightRadius: radius.lg + 4,
		backgroundColor: palette.surface,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	detailArt: { height: 170, alignItems: 'center', justifyContent: 'center' },
	revealLine: { ...type.meta, color: palette.holo },
	detailTitle: { ...type.title, color: palette.textPrimary },
	detailFoil: { ...type.meta, color: palette.textDim },
	counts: { flexDirection: 'row', gap: space.xl, marginVertical: space.sm },
	count: { alignItems: 'center' },
	countValue: { ...type.title, color: palette.textPrimary },
	countLabel: { ...type.small, color: palette.textFaint },
	combineNote: { ...type.small, color: palette.textDim, textAlign: 'center' }
});
