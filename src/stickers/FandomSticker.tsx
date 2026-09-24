/**
 * Live vector fandom sticker.
 *
 * Canonical representation is the label + style category, not a PNG. The white
 * die-cut rim is an SVG stroke with round joins — not stacked text-shadows —
 * so it stays clean under scale.
 *
 * Foil: any rung, the card's own engine, masked to this sticker's own shape —
 * its die cut, drawn by this component in `silhouette` mode, so foil covers the
 * rim and letters exactly like a real foil sticker and never the shadow. See
 * StickerFoil's `MaskedFoil`.
 */

import { View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';

import type { StickerFoil } from '@/card/tiers';
import { recipeFor } from './fandom-styles';
import {
	layoutFandomSticker,
	stickerHeight,
	type FandomLaidLine,
	type FandomLayout,
	type FandomVinylRect
} from './fandom-layout';
import { MaskedFoil, type StickerLight } from './StickerFoil';
import type { FandomStickerDefinition } from './types';

export function FandomSticker({
	definition,
	width,
	foil = 'none',
	light,
	silhouette = false
}: {
	definition: FandomStickerDefinition;
	width: number;
	foil?: StickerFoil;
	seed?: string;
	/** Needed for foil: the light it shares with its card. */
	light?: StickerLight;
	/** Draw only the die-cut shape, in white: the foil's mask. */
	silhouette?: boolean;
}) {
	const recipe = recipeFor(definition.styleCategory);
	const layout = layoutFandomSticker(definition.label, recipe, width);
	if (!layout || width <= 1) return null;

	const height = stickerHeight(layout, width);
	const { viewBox, origin } = layout;
	const transform = `translate(${origin.x} ${origin.y}) rotate(${layout.rotation}) skewX(${layout.skewX}) translate(${-origin.x} ${-origin.y})`;

	if (silhouette) {
		return (
			<View collapsable={false} pointerEvents="none" style={{ width, height }}>
				<Svg
					width={width}
					height={height}
					viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
				>
					<G transform={transform}>
						{paintVinyl(layout.bars, '#ffffff', 'bar')}
						{paintVinyl(layout.joins, '#ffffff', 'join')}
						{paintLayer(layout, '#ffffff', '#ffffff', layout.whiteStroke)}
					</G>
				</Svg>
			</View>
		);
	}

	return (
		<View
			collapsable={false}
			pointerEvents="none"
			accessible
			accessibilityRole="image"
			accessibilityLabel={`${definition.label} fandom sticker`}
			style={{ width, height }}
		>
			<Svg
				width={width}
				height={height}
				viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
			>
				<G transform={transform}>
					<G transform={`translate(${layout.shadow.dx} ${layout.shadow.dy})`}>
						{paintVinyl(layout.bars, layout.shadow.color, 'bar')}
						{paintVinyl(layout.joins, layout.shadow.color, 'join')}
						{paintLayer(layout, layout.shadow.color, layout.shadow.color, layout.whiteStroke)}
					</G>
					{paintVinyl(layout.bars, layout.dieCut, 'bar')}
					{paintVinyl(layout.joins, layout.dieCut, 'join')}
					{paintLayer(layout, layout.dieCut, layout.dieCut, layout.whiteStroke)}
					{paintLayer(layout, layout.outline, layout.outline, layout.colorStroke)}
					{paintLayer(layout, layout.fill, 'none', 0)}
				</G>
			</Svg>
			{foil !== 'none' && light ? (
				<MaskedFoil
					silhouette={<FandomSticker definition={definition} width={width} silhouette />}
					foil={foil}
					width={width}
					height={height}
					light={light}
				/>
			) : null}
		</View>
	);
}

function paintVinyl(rects: FandomVinylRect[], fill: string, key: string) {
	return rects.map((rect, index) => (
		<Rect
			key={`${key}-${index}`}
			x={rect.x}
			y={rect.y}
			width={rect.width}
			height={rect.height}
			rx={rect.rx}
			fill={fill}
		/>
	));
}

function paintLayer(layout: FandomLayout, fill: string, stroke: string, strokeWidth: number) {
	return layout.lines.map((line, index) => (
		<StickerText
			key={`${fill}-${index}`}
			line={line}
			layout={layout}
			fill={fill}
			stroke={stroke}
			strokeWidth={strokeWidth}
		/>
	));
}

function StickerText({
	line,
	layout,
	fill,
	stroke,
	strokeWidth
}: {
	line: FandomLaidLine;
	layout: FandomLayout;
	fill: string;
	stroke: string;
	strokeWidth: number;
}) {
	return (
		<SvgText
			x={line.x}
			y={line.baseline}
			fontFamily={layout.fontFamily}
			fontSize={layout.fontSize}
			letterSpacing={layout.letterSpacing}
			fill={fill}
			stroke={stroke}
			strokeWidth={strokeWidth}
			strokeLinejoin="round"
			strokeLinecap="round"
			strokeMiterlimit={2}
		>
			{line.text}
		</SvgText>
	);
}
