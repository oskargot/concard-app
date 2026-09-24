/**
 * The sticker drawer (HANDOFF §2.2): a bottom sheet over the lower editor,
 * with the card still in view above it.
 *
 * - A Deco / Fandom switch; the two kinds never share a grid.
 * - Five columns, four full rows at rest, scrolling for more. Five rather than
 *   four keeps the sheet short enough (≈ 330 pt on a 390 pt phone) for most of
 *   the card to stay visible, with tiles still ~65 pt — the art itself ~54 pt.
 * - Only stickers with a spare copy; a count badge above one; foil shows on
 *   the tile itself (the real foil, idle shimmer only), never as a label.
 * - Tap a tile to put that sticker at the card's centre. Hold and drag it out
 *   to drop it where you want it.
 * - Drag a sticker off the card back onto the sheet to put it away.
 *
 * Tiles draw the drawer-size thumbnails (`art="thumb"`), never the full art.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	runOnJS,
	useAnimatedStyle,
	withTiming,
	type SharedValue
} from 'react-native-reanimated';

import { definitionForPlacement } from '../../stickers/definitions';
import { entryKey, placementFields, type InventoryEntry } from '../../stickers/inventory';
import { useShimmerPause } from '../../stickers/shimmer';
import { StickerRenderer } from '../../stickers/StickerRenderer';
import type { PlacedSticker } from '../types';
import { palette } from '../../theme/palette';
import { radius, space, type } from '../../theme/tokens';

export type StickerKindTab = 'deco' | 'fandom';

export const DRAWER_COLUMNS = 5;
const ROWS = 4;
const GAP = space.sm;
const SIDE = space.lg;
const HEADER = 52;
const HANDLE = 18;

export interface DrawerLayout {
	tile: number;
	gridHeight: number;
	height: number;
}

/** The sheet's size for a screen: four full rows of tiles. */
export function drawerLayout(screenWidth: number, bottomInset: number): DrawerLayout {
	const tile = Math.floor((screenWidth - SIDE * 2 - GAP * (DRAWER_COLUMNS - 1)) / DRAWER_COLUMNS);
	const gridHeight = ROWS * tile + (ROWS - 1) * GAP;
	return { tile, gridHeight, height: HANDLE + HEADER + gridHeight + space.md + bottomInset };
}

export interface DrawerDrag {
	/** Where the held tile is, in window coordinates. */
	x: SharedValue<number>;
	y: SharedValue<number>;
	onStart: (entry: InventoryEntry) => void;
	onEnd: (entry: InventoryEntry, x: number, y: number) => void;
}

export function StickerDrawer({
	open,
	layout,
	inventory,
	kind,
	onKind,
	canPlace,
	onTap,
	drag,
	overDrawer
}: {
	open: boolean;
	layout: DrawerLayout;
	inventory: InventoryEntry[];
	kind: StickerKindTab;
	onKind: (kind: StickerKindTab) => void;
	canPlace: boolean;
	onTap: (entry: InventoryEntry) => void;
	drag: DrawerDrag;
	/** A sticker from the card is being held over the sheet. */
	overDrawer: SharedValue<boolean>;
}) {
	// Nothing in a closed drawer should keep the shared shimmer clock running.
	useShimmerPause(!open);

	const entries = useMemo(
		() => inventory.filter((e) => e.sticker.kind === kind && e.available > 0),
		[inventory, kind]
	);

	const slide = useAnimatedStyle(() => ({
		transform: [{ translateY: withTiming(open ? 0 : layout.height, { duration: 220 }) }]
	}));
	const dropHint = useAnimatedStyle(() => ({
		opacity: withTiming(overDrawer.value ? 1 : 0, { duration: 120 })
	}));

	return (
		<Animated.View
			pointerEvents={open ? 'auto' : 'none'}
			accessibilityViewIsModal={false}
			style={[styles.sheet, { height: layout.height }, slide]}
		>
			<View style={styles.handle} />
			<View style={styles.header}>
				<Segmented value={kind} onChange={onKind} />
				<Text style={styles.headerNote}>
					{canPlace ? 'Tap or drag onto your card' : 'This card is full (20)'}
				</Text>
			</View>

			{entries.length ? (
				<FlatList
					data={entries}
					keyExtractor={entryKey}
					numColumns={DRAWER_COLUMNS}
					style={{ height: layout.gridHeight }}
					columnWrapperStyle={{ gap: GAP }}
					contentContainerStyle={{ gap: GAP, paddingHorizontal: SIDE }}
					showsVerticalScrollIndicator={false}
					renderItem={({ item }) => (
						<DrawerTile
							entry={item}
							size={layout.tile}
							disabled={!canPlace}
							onTap={onTap}
							drag={drag}
						/>
					)}
				/>
			) : (
				<View style={[styles.empty, { height: layout.gridHeight }]}>
					<Text style={styles.emptyText}>
						{kind === 'deco'
							? 'No spare deco stickers. Collect cards to find more.'
							: 'No spare fandom stickers. Collect cards to find more.'}
					</Text>
				</View>
			)}

			<Animated.View pointerEvents="none" style={[styles.dropHint, dropHint]}>
				<Text style={styles.dropHintText}>Drop to put it back</Text>
			</Animated.View>
		</Animated.View>
	);
}

function Segmented({
	value,
	onChange
}: {
	value: StickerKindTab;
	onChange: (kind: StickerKindTab) => void;
}) {
	return (
		<View style={styles.segmented} accessibilityRole="tablist">
			{(['deco', 'fandom'] as const).map((k) => {
				const on = value === k;
				return (
					<Pressable
						key={k}
						onPress={() => onChange(k)}
						accessibilityRole="tab"
						accessibilityState={{ selected: on }}
						style={[styles.segment, on && styles.segmentOn]}
					>
						<Text style={[styles.segmentText, on && styles.segmentTextOn]}>
							{k === 'deco' ? 'Deco' : 'Fandom'}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function DrawerTile({
	entry,
	size,
	disabled,
	onTap,
	drag
}: {
	entry: InventoryEntry;
	size: number;
	disabled: boolean;
	onTap: (entry: InventoryEntry) => void;
	drag: DrawerDrag;
}) {
	const definition = useMemo(
		() =>
			definitionForPlacement({
				...placementFields(entry.sticker),
				sticker_id: entry.sticker.id
			} as PlacedSticker),
		[entry.sticker]
	);

	const tap = Gesture.Tap()
		.enabled(!disabled)
		.onEnd(() => runOnJS(onTap)(entry));
	// Holding first keeps a quick vertical swipe for scrolling the grid.
	const pull = Gesture.Pan()
		.enabled(!disabled)
		.activateAfterLongPress(140)
		.onStart((e) => {
			drag.x.set(e.absoluteX);
			drag.y.set(e.absoluteY);
			runOnJS(drag.onStart)(entry);
		})
		.onUpdate((e) => {
			drag.x.set(e.absoluteX);
			drag.y.set(e.absoluteY);
		})
		.onEnd((e) => runOnJS(drag.onEnd)(entry, e.absoluteX, e.absoluteY));

	return (
		<GestureDetector gesture={Gesture.Exclusive(pull, tap)}>
			<View
				accessible
				accessibilityRole="button"
				accessibilityLabel={`${entry.sticker.name}${entry.foil === 'none' ? '' : `, ${entry.foil}`}, ${entry.available} spare`}
				style={[styles.tile, { width: size, height: size }, disabled && styles.tileOff]}
			>
				<StickerRenderer
					definition={definition}
					foil={entry.foil}
					width={size - space.md}
					art="thumb"
				/>
				{entry.available > 1 ? (
					<View style={styles.badge}>
						<Text style={styles.badgeText}>×{entry.available}</Text>
					</View>
				) : null}
			</View>
		</GestureDetector>
	);
}

const styles = StyleSheet.create({
	sheet: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: palette.surface,
		borderTopLeftRadius: radius.lg + 4,
		borderTopRightRadius: radius.lg + 4,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		boxShadow: '0 -8px 24px rgba(0,0,0,0.45)',
		zIndex: 30
	},
	handle: {
		alignSelf: 'center',
		width: 36,
		height: 4,
		borderRadius: 2,
		marginTop: 8,
		marginBottom: HANDLE - 12,
		backgroundColor: palette.mutedUi
	},
	header: {
		height: HEADER,
		paddingHorizontal: SIDE,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: space.sm
	},
	headerNote: { ...type.small, color: palette.textFaint, flexShrink: 1, textAlign: 'right' },
	segmented: {
		flexDirection: 'row',
		padding: 3,
		borderRadius: radius.pill,
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	segment: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
	segmentOn: { backgroundColor: palette.mutedUi },
	segmentText: { ...type.small, color: palette.textDim },
	segmentTextOn: { color: palette.textPrimary },
	tile: {
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: radius.md,
		backgroundColor: palette.raised
	},
	tileOff: { opacity: 0.4 },
	badge: {
		position: 'absolute',
		right: 4,
		top: 4,
		minWidth: 20,
		paddingHorizontal: 5,
		height: 18,
		borderRadius: 9,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: palette.ground
	},
	badgeText: { ...type.small, fontSize: 11, lineHeight: 14, color: palette.textPrimary },
	empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
	emptyText: { ...type.body, color: palette.textFaint, textAlign: 'center' },
	dropHint: {
		...StyleSheet.absoluteFill,
		borderTopLeftRadius: radius.lg + 4,
		borderTopRightRadius: radius.lg + 4,
		borderWidth: 2,
		borderColor: palette.holo,
		backgroundColor: 'rgba(18,17,22,0.72)',
		alignItems: 'center',
		justifyContent: 'center'
	},
	dropHintText: { ...type.title, color: palette.holo }
});
