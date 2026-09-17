/**
 * The editor's centrepiece: the card, with its controls in the margins.
 *
 * Face colours sit in a grid above the card so the gutters stay for the style
 * arrows only. Each arrow pair still parks beside the band it changes. A change
 * prints its axis and value in a caption under the card for a moment — without
 * it, cycling `shaved → rect` reads as the card twitching.
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

const ARROW = 30;
const COLUMN_GAP = 4;
const GRID_COLS = 9;
const SWATCH = 16;

/** How long a change stays named under the card. */
const CAPTION_MS = 1600;

export interface StageLayout {
	cardWidth: number;
}

/**
 * How wide the card can be, given the screen.
 *
 * Gutters are reserved for the arrows only — colours live above the card, so
 * they never steal width from the face.
 */
export function stageLayout(screenWidth: number, pagePadding: number, max = 320): StageLayout {
	const arrows = 2 * (ARROW + COLUMN_GAP);
	const available = screenWidth - pagePadding * 2;
	return { cardWidth: Math.min(available - arrows, max) };
}

export function EditorStage({
	style,
	cardWidth,
	axes,
	onPickBackground,
	renderCard
}: {
	style: CardStyle;
	cardWidth: number;
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

	return (
		<View style={styles.stage}>
			<SwatchGrid
				keys={bgKeys}
				value={style.bg}
				onPick={(bg) => {
					onPickBackground(bg);
					announce(`Face · ${BG_LABEL[bg]}`);
				}}
			/>

			<View style={styles.row}>
				<ArrowColumn side="left" axes={axes} bands={bands} height={cardHeight} onStep={step} />

				<View style={{ width: cardWidth, height: cardHeight }}>
					<StaticCard width={cardWidth} render={renderCard} />
				</View>

				<ArrowColumn side="right" axes={axes} bands={bands} height={cardHeight} onStep={step} />
			</View>

			{/* Reserved whether or not there is a caption, so the card never shifts. */}
			<Text style={styles.caption} numberOfLines={1} accessibilityLiveRegion="polite">
				{caption ?? ''}
			</Text>
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

/** Eighteen face colours in an even grid so no rail is longer than another. */
function SwatchGrid({
	keys,
	value,
	onPick
}: {
	keys: BgKey[];
	value: BgKey;
	onPick: (bg: BgKey) => void;
}) {
	return (
		<View style={styles.grid} accessibilityRole="radiogroup">
			{keys.map((key) => {
				const on = key === value;
				return (
					<Pressable
						key={key}
						onPress={() => onPick(key)}
						accessibilityRole="radio"
						accessibilityState={{ selected: on }}
						accessibilityLabel={BG_LABEL[key]}
						hitSlop={8}
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
	stage: { alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
	row: { flexDirection: 'row', alignItems: 'center', gap: COLUMN_GAP },
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		width: GRID_COLS * SWATCH + (GRID_COLS - 1) * 2,
		alignSelf: 'center',
		gap: 2
	},
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
	swatch: {
		width: SWATCH,
		height: SWATCH,
		padding: 1,
		borderRadius: 4,
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
