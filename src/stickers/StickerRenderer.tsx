/**
 * Shared visual endpoint for every sticker kind.
 *
 * Stage 1 renders fandom stickers as live type and deco stickers as a
 * placeholder. Geometry (position, scale, rotation, gestures) stays in
 * `StickerLayer`; this component owns artwork, the die-cut rim, and later
 * the clipped foil finish. `foil` is part of the public API now so later
 * stages do not have to change call sites.
 */

import { View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { palette } from '@/theme/palette';
import { font } from '@/theme/tokens';
import { FandomSticker } from './FandomSticker';
import type { DecoStickerDefinition, StickerRendererProps } from './types';

export function StickerRenderer({ definition, foil, width, seed }: StickerRendererProps) {
	if (width <= 1) return null;

	if (definition.kind === 'fandom') {
		return <FandomSticker definition={definition} foil={foil} width={width} seed={seed} />;
	}

	return <DecoPlaceholder definition={definition} width={width} />;
}

function DecoPlaceholder({
	definition,
	width
}: {
	definition: DecoStickerDefinition;
	width: number;
}) {
	const pad = Math.max(3, width * 0.06);
	const rim = Math.max(3, width * 0.08);
	const inner = width - pad * 2;
	const radius = width * 0.2;

	return (
		<View
			pointerEvents="none"
			accessible
			accessibilityRole="image"
			accessibilityLabel={`${definition.name} deco sticker placeholder`}
			style={{ width, height: width }}
		>
			<Svg width={width} height={width}>
				<Rect
					x={pad - rim / 2}
					y={pad - rim / 2}
					width={inner + rim}
					height={inner + rim}
					rx={radius + rim / 2}
					fill="#ffffff"
				/>
				<Rect
					x={pad}
					y={pad}
					width={inner}
					height={inner}
					rx={radius}
					fill={palette.raisedHigh}
					stroke={palette.teal}
					strokeWidth={Math.max(1, width * 0.015)}
					strokeDasharray={`${Math.max(4, width * 0.06)} ${Math.max(3, width * 0.04)}`}
				/>
				<SvgText
					x={width / 2}
					y={width * 0.48}
					textAnchor="middle"
					fontFamily={font.bodyBold}
					fontSize={Math.max(8, width * 0.13)}
					fill={palette.creamMute}
				>
					PNG
				</SvgText>
				<SvgText
					x={width / 2}
					y={width * 0.66}
					textAnchor="middle"
					fontFamily={font.bodyMedium}
					fontSize={Math.max(7, width * 0.09)}
					fill={palette.creamFaint}
				>
					{truncate(definition.name, 12)}
				</SvgText>
			</Svg>
		</View>
	);
}

function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
