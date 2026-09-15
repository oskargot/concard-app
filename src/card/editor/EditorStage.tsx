/**
 * The editor's centrepiece: the card, with its controls in the margins.
 *
 * Design bible §12 puts the card above the chrome, and the editor takes that
 * literally — there are no option panels. Every style axis is an arrow pair in
 * the gutter beside the part of the card it changes, and the eighteen face
 * colours are swatch rails down the outer edges. Nothing here opens, expands or
 * covers the card, so what you are editing is on screen the whole time.
 *
 * The one thing the arrows can't teach on their own is what they just did, so a
 * change prints its axis and value in a caption under the card for a moment.
 * Without it, cycling `shaved → rect` reads as the card twitching.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { palette } from '../../theme/palette';
import { radius, space, type, CARD_ASPECT } from '../../theme/tokens';
import { BGS, BG_LABEL, type BgKey, type CardStyle } from '../card-style';
import { faceBands } from '../CardFace';
import { StaticCard } from '../FlipCard';

/** Which band of the card a control sits beside. */
export type BandKey = 'header' | 'photo' | 'bio' | 'footer';

/**
 * One cycling style option: the left arrow steps back through `options`, the
 * right steps forward, and both wrap.
 */
export interface StyleAxis<T extends string = string> {
	/** Announced by the arrows and shown in the caption — "Photo shape". */
	label: string;
	options: readonly T[];
	value: T;
	onChange: (next: T) => void;
	labelFor?: (value: T) => string;
	band: BandKey;
}

const RAIL_WIDTH = 28;
const SWATCH = 22;
const ARROW = 30;
const COLUMN_GAP = 4;

/** Below this the card stops being the focus, so the rails move under it instead. */
const CARD_MIN = 200;
/** How long a change stays named under the card. */
const CAPTION_MS = 1600;

export interface StageLayout {
	cardWidth: number;
	/** False when the screen is too narrow for side rails; they go below instead. */
	railsBeside: boolean;
}

/**
 * How wide the card can be, given the screen.
 *
 * The gutters are claimed in priority order: arrows first, because they are the
 * only way to reach four of the style axes, then the swatch rails, which have a
 * perfectly good fallback below the card. A phone narrow enough to force that
 * fallback still gets a card wider than `COMPACT_BELOW`, so the face keeps its
 * bio and links rather than collapsing to a thumbnail mid-edit.
 */
export function stageLayout(screenWidth: number, pagePadding: number, max = 320): StageLayout {
	const arrows = 2 * (ARROW + COLUMN_GAP);
	const rails = 2 * (RAIL_WIDTH + COLUMN_GAP);
	const available = screenWidth - pagePadding * 2;

	const withRails = Math.min(available - arrows - rails, max);
	if (withRails >= CARD_MIN) return { cardWidth: withRails, railsBeside: true };

	return { cardWidth: Math.min(available - arrows, max), railsBeside: false };
}

export function EditorStage({
	style,
	cardWidth,
	railsBeside,
	axes,
	onPickBackground,
	renderCard
}: {
	style: CardStyle;
	cardWidth: number;
	railsBeside: boolean;
	axes: StyleAxis[];
	onPickBackground: (bg: BgKey) => void;
	renderCard: (rx: SharedValue<number>, ry: SharedValue<number>) => React.ReactNode;
}) {
	const cardHeight = cardWidth / CARD_ASPECT;
	const bands = faceBands(cardWidth, style);
	const [caption, setCaption] = useState<string | null>(null);
	const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const announce = useCallback((text: string) => {
		setCaption(text);
		if (captionTimer.current) clearTimeout(captionTimer.current);
		captionTimer.current = setTimeout(() => setCaption(null), CAPTION_MS);
	}, []);

	useEffect(
		() => () => {
			if (captionTimer.current) clearTimeout(captionTimer.current);
		},
		[]
	);

	const step = useCallback(
		(axis: StyleAxis, direction: 1 | -1) => {
			const i = axis.options.indexOf(axis.value);
			// An unrecognised current value (an older card, a hand-edited row) starts
			// from the top of the list rather than wrapping off the end of it.
			const from = i < 0 ? 0 : i;
			const next = axis.options[(from + direction + axis.options.length) % axis.options.length];
			axis.onChange(next);
			announce(`${axis.label} · ${axis.labelFor?.(next) ?? next}`);
		},
		[announce]
	);

	const bgKeys = Object.keys(BGS) as BgKey[];
	const half = Math.ceil(bgKeys.length / 2);

	const rail = (keys: BgKey[]) => (
		<SwatchRail
			keys={keys}
			value={style.bg}
			height={cardHeight}
			vertical
			onPick={(bg) => {
				onPickBackground(bg);
				announce(`Face · ${BG_LABEL[bg]}`);
			}}
		/>
	);

	return (
		<View style={styles.stage}>
			<View style={styles.row}>
				{railsBeside ? rail(bgKeys.slice(0, half)) : null}
				<ArrowColumn side="left" axes={axes} bands={bands} height={cardHeight} onStep={step} />

				<View style={{ width: cardWidth, height: cardHeight }}>
					<StaticCard width={cardWidth} render={renderCard} />
				</View>

				<ArrowColumn side="right" axes={axes} bands={bands} height={cardHeight} onStep={step} />
				{railsBeside ? rail(bgKeys.slice(half)) : null}
			</View>

			{/* Reserved whether or not there is a caption, so the card never shifts. */}
			<Text style={styles.caption} numberOfLines={1} accessibilityLiveRegion="polite">
				{caption ?? ''}
			</Text>

			{!railsBeside ? (
				<SwatchRail
					keys={bgKeys}
					value={style.bg}
					onPick={(bg) => {
						onPickBackground(bg);
						announce(`Face · ${BG_LABEL[bg]}`);
					}}
				/>
			) : null}
		</View>
	);
}

/** The arrows for one side, each parked beside the band it belongs to. */
function ArrowColumn({
	side,
	axes,
	bands,
	height,
	onStep
}: {
	side: 'left' | 'right';
	axes: StyleAxis[];
	bands: ReturnType<typeof faceBands>;
	height: number;
	onStep: (axis: StyleAxis, direction: 1 | -1) => void;
}) {
	const direction = side === 'left' ? -1 : 1;

	return (
		<View style={{ width: ARROW, height }}>
			{axes.map((axis) => (
				<Pressable
					key={axis.label}
					onPress={() => onStep(axis, direction)}
					accessibilityRole="button"
					accessibilityLabel={`${side === 'left' ? 'Previous' : 'Next'} ${axis.label.toLowerCase()}`}
					accessibilityHint={`Currently ${axis.labelFor?.(axis.value) ?? axis.value}`}
					hitSlop={6}
					style={({ pressed }) => [
						styles.arrow,
						{ top: bands[axis.band] - ARROW / 2 },
						pressed && styles.arrowPressed
					]}
				>
					<Text style={styles.arrowGlyph}>{side === 'left' ? '‹' : '›'}</Text>
				</Pressable>
			))}
		</View>
	);
}

/**
 * The face colours. Vertical beside the card when there is room for it, and a
 * wrapped block underneath when there isn't.
 */
function SwatchRail({
	keys,
	value,
	height,
	vertical,
	onPick
}: {
	keys: BgKey[];
	value: BgKey;
	height?: number;
	vertical?: boolean;
	onPick: (bg: BgKey) => void;
}) {
	return (
		<View
			style={[
				vertical ? { width: RAIL_WIDTH, height, justifyContent: 'space-between' } : styles.railWrap
			]}
			accessibilityRole="radiogroup"
		>
			{keys.map((key) => {
				const on = key === value;
				return (
					<Pressable
						key={key}
						onPress={() => onPick(key)}
						accessibilityRole="radio"
						accessibilityState={{ selected: on }}
						accessibilityLabel={BG_LABEL[key]}
						hitSlop={4}
						style={({ pressed }) => [
							styles.swatch,
							on && styles.swatchOn,
							pressed && { opacity: 0.7 }
						]}
					>
						<View style={[styles.swatchFill, { backgroundColor: BGS[key] }]} />
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	stage: { alignItems: 'center', gap: space.sm },
	row: { flexDirection: 'row', alignItems: 'center', gap: COLUMN_GAP },
	arrow: {
		position: 'absolute',
		width: ARROW,
		height: ARROW,
		borderRadius: radius.pill,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	arrowPressed: { backgroundColor: palette.teal, borderColor: palette.teal },
	arrowGlyph: {
		fontFamily: 'Fredoka-Bold',
		fontSize: 20,
		lineHeight: 24,
		color: palette.cream
	},
	railWrap: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: space.sm,
		paddingHorizontal: space.sm
	},
	swatch: {
		width: SWATCH + 6,
		height: SWATCH + 6,
		borderRadius: radius.sm,
		padding: 3,
		borderWidth: 2,
		borderColor: 'transparent'
	},
	swatchOn: { borderColor: palette.teal },
	swatchFill: { flex: 1, borderRadius: radius.sm - 3 },
	caption: {
		...type.meta,
		color: palette.teal,
		minHeight: 14,
		textAlign: 'center'
	}
});
