/**
 * The editor's centrepiece: the card, with its controls in the margins.
 *
 * Face colours sit in one row across the full width above the card, so the
 * gutters stay for the style arrows only. Each arrow pair still parks beside the band it changes. A change
 * prints its axis and value in a caption under the card for a moment — without
 * it, cycling `shaved → rect` reads as the card twitching.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { palette } from '../../theme/palette';
import { radius, space, type, CARD_ASPECT } from '../../theme/tokens';
import { BGS, BG_LABEL, type BgKey } from '../card-style';
import { faceBands, useFrontLayout } from '../CardFace';
import { StaticCard } from '../FlipCard';
import type { CardView } from '../types';

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
/** Space between face swatches; the swatches grow to fill the rest of the row. */
const SWATCH_GAP = 2;

/** How long a change stays named under the card. */
const CAPTION_MS = 1600;

export interface StageLayout {
	cardWidth: number;
	/** The whole width the stage may use: the screen less the page padding. */
	stageWidth: number;
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
	return { cardWidth: Math.min(available - arrows, max), stageWidth: available };
}

export function EditorStage({
	view,
	cardWidth,
	stageWidth,
	axes,
	onPickBackground,
	renderCard
}: {
	view: CardView;
	cardWidth: number;
	/** From `stageLayout`; the face swatches span it. */
	stageWidth: number;
	axes: StyleAxis[];
	onPickBackground: (bg: BgKey) => void;
	renderCard: (rx: SharedValue<number>, ry: SharedValue<number>) => React.ReactNode;
}) {
	const cardHeight = cardWidth / CARD_ASPECT;
	const { style, layout } = useFrontLayout(view);
	const bands = faceBands(cardWidth, layout);
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
			<SwatchRow
				keys={bgKeys}
				width={stageWidth}
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

/**
 * The eighteen face colours in one row spanning the stage. Each swatch is
 * sized to fill the width, and the selected one gets a ring drawn just
 * outside it, so choosing a colour never resizes anything.
 */
function SwatchRow({
	keys,
	width,
	value,
	onPick
}: {
	keys: BgKey[];
	width: number;
	value: BgKey;
	onPick: (bg: BgKey) => void;
}) {
	const size = (width - SWATCH_GAP * (keys.length - 1)) / keys.length;
	return (
		<View style={[styles.swatches, { width }]} accessibilityRole="radiogroup">
			{keys.map((key) => {
				const on = key === value;
				return (
					<Pressable
						key={key}
						onPress={() => onPick(key)}
						accessibilityRole="radio"
						accessibilityState={{ selected: on }}
						accessibilityLabel={BG_LABEL[key]}
						hitSlop={{ top: 8, bottom: 8 }}
						style={({ pressed }) => [
							styles.swatch,
							{ width: size, height: size, backgroundColor: BGS[key] },
							// lifted so its ring draws over the neighbours it overlaps
							on && styles.swatchOn,
							pressed && { opacity: 0.7 }
						]}
					>
						{on ? <View pointerEvents="none" style={styles.swatchRing} /> : null}
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	stage: { alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
	row: { flexDirection: 'row', alignItems: 'center', gap: COLUMN_GAP },
	swatches: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignSelf: 'center',
		// room for the selection ring, which sits outside the swatch
		paddingVertical: 3
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
		borderRadius: 5,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	swatchOn: { zIndex: 1 },
	swatchRing: {
		position: 'absolute',
		top: -3,
		left: -3,
		right: -3,
		bottom: -3,
		borderRadius: 8,
		borderWidth: 2,
		borderColor: palette.teal
	},
	caption: {
		...type.meta,
		color: palette.teal,
		minHeight: 14,
		textAlign: 'center'
	}
});
