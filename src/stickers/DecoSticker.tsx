/**
 * A deco sticker: baked art (scripts/stickers/pipeline.ts), drawn cheaply.
 *
 * - Plain: one image. Fully static — no canvas, no clock.
 * - Foiled: one Skia canvas with the image and the card's foil clipped to the
 *   baked mask (StickerFoil.tsx).
 * - No art available (a prototype sticker with no bake, offline with no
 *   fixture): the emoji glyph on a white disc, so a card never shows a hole.
 *
 * The box is the baked canvas, outline and lift shadow included, sized by its
 * long edge; see `decoBox`.
 */

import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { StickerFoil } from '@/card/tiers';
import { DecoFoilCanvas, STICKER_FOIL_AVAILABLE, type StickerLight } from './StickerFoil';
import type { DecoStickerDefinition } from './types';

/** The box a deco sticker of base size `size` (its long edge) occupies. */
export function decoBox(aspect: number, size: number): { width: number; height: number } {
	return aspect >= 1
		? { width: size, height: size / aspect }
		: { width: size * aspect, height: size };
}

export function DecoSticker({
	definition,
	foil = 'none',
	size,
	light,
	art = 'full'
}: {
	definition: DecoStickerDefinition;
	foil?: StickerFoil;
	size: number;
	light: StickerLight;
	art?: 'full' | 'thumb';
}) {
	const assets = definition.assets;
	if (!assets) return <GlyphSticker glyph={definition.glyph} name={definition.name} size={size} />;

	const { width, height } = decoBox(assets.aspect, size);
	if (foil !== 'none' && STICKER_FOIL_AVAILABLE) {
		return (
			<View
				accessible
				accessibilityRole="image"
				accessibilityLabel={`${definition.name} sticker`}
				style={{ width, height }}
			>
				<DecoFoilCanvas
					assets={assets}
					foil={foil}
					width={width}
					height={height}
					light={light}
					art={art}
				/>
			</View>
		);
	}

	return (
		<Image
			source={art === 'thumb' ? assets.thumb : assets.full}
			style={{ width, height }}
			contentFit="fill"
			cachePolicy="memory-disk"
			accessible
			accessibilityLabel={`${definition.name} sticker`}
			transition={0}
		/>
	);
}

function GlyphSticker({
	glyph,
	name,
	size
}: {
	glyph?: string | null;
	name: string;
	size: number;
}) {
	return (
		<View
			accessible
			accessibilityRole="image"
			accessibilityLabel={`${name} sticker`}
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: '#ffffff',
				alignItems: 'center',
				justifyContent: 'center',
				boxShadow: `0 ${size * 0.02}px ${size * 0.05}px rgba(23,22,27,0.28)`
			}}
		>
			<Text allowFontScaling={false} style={{ fontSize: size * 0.58, lineHeight: size * 0.7 }}>
				{glyph ?? '★'}
			</Text>
		</View>
	);
}
