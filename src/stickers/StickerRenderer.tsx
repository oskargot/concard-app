/**
 * Shared visual endpoint for every sticker kind.
 *
 * Geometry (position, scale, rotation, gestures) belongs to the caller; this
 * component owns the artwork, the die cut and the foil. `width` is the
 * sticker's base size in px — a deco sticker's long edge, a fandom sticker's
 * width — and `stickerBox` says what box that comes to, so callers can centre
 * it without rendering it first.
 */

import { makeMutable } from 'react-native-reanimated';

import { DecoSticker, decoBox } from './DecoSticker';
import { FandomSticker } from './FandomSticker';
import { layoutFandomSticker, stickerHeight } from './fandom-layout';
import { recipeFor } from './fandom-styles';
import type { StickerLight } from './StickerFoil';
import type { StickerDefinition, StickerRendererProps } from './types';

/** Light for a sticker that isn't on a card and isn't being tilted. */
const STILL_LIGHT: StickerLight = { rx: makeMutable(0), ry: makeMutable(0) };

export function StickerRenderer({
	definition,
	foil = 'none',
	width,
	light = STILL_LIGHT,
	art
}: StickerRendererProps) {
	if (width <= 1) return null;

	if (definition.kind === 'fandom') {
		return <FandomSticker definition={definition} foil={foil} width={width} light={light} />;
	}

	return <DecoSticker definition={definition} foil={foil} size={width} light={light} art={art} />;
}

/** The box a sticker of base size `size` occupies, in px. */
export function stickerBox(
	definition: StickerDefinition,
	size: number
): { width: number; height: number } {
	if (definition.kind === 'deco') {
		return definition.assets
			? decoBox(definition.assets.aspect, size)
			: { width: size, height: size };
	}
	const layout = layoutFandomSticker(definition.label, recipeFor(definition.styleCategory), size);
	return { width: size, height: layout ? stickerHeight(layout, size) : size * 0.55 };
}
