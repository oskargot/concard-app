/**
 * Live vector fandom sticker.
 *
 * Canonical representation is the label + style category, not a PNG. The white
 * die-cut rim is an SVG stroke with round joins — not stacked text-shadows —
 * so it stays clean under scale. `foil` is accepted for the shared renderer
 * API and ignored until Stage 5.
 */

import { View } from 'react-native';
import Svg, { G, Text as SvgText } from 'react-native-svg';

import type { StickerFoil } from '@/card/tiers';
import { recipeFor } from './fandom-styles';
import {
	layoutFandomSticker,
	stickerHeight,
	type FandomLaidLine,
	type FandomLayout
} from './fandom-layout';
import type { FandomStickerDefinition } from './types';

export function FandomSticker({
	definition,
	width
}: {
	definition: FandomStickerDefinition;
	width: number;
	foil?: StickerFoil;
	seed?: string;
}) {
	const recipe = recipeFor(definition.styleCategory);
	const layout = layoutFandomSticker(definition.label, recipe, width);
	if (!layout || width <= 1) return null;

	const height = stickerHeight(layout, width);
	const { viewBox, origin } = layout;

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
				<G
					transform={`translate(${origin.x} ${origin.y}) rotate(${layout.rotation}) skewX(${layout.skewX}) translate(${-origin.x} ${-origin.y})`}
				>
					<G transform={`translate(${layout.shadow.dx} ${layout.shadow.dy})`}>
						{paintLayer(layout, layout.shadow.color, layout.shadow.color, layout.whiteStroke)}
					</G>
					{paintLayer(layout, layout.dieCut, layout.dieCut, layout.whiteStroke)}
					{paintLayer(layout, layout.outline, layout.outline, layout.colorStroke)}
					{paintLayer(layout, layout.fill, 'none', 0)}
				</G>
			</Svg>
		</View>
	);
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
