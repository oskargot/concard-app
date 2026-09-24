/**
 * Everything that sits outside the face clip: the fandom affiliation and stickers.
 *
 * Ported from the overlay snippet in the web app's `Card.svelte`. These hang
 * over the metal frame, so they live in CardShell's `overlay` slot rather than
 * inside the face. Affiliation art goes through `StickerRenderer`; deco glyphs
 * remain a Stage 1/2 prototype until the unified sticker pass.
 *
 * Card spec §4: stickers are an overlay above everything on the front, tier
 * foil included, and never part of the layout — nothing reflows around them.
 * Positions are centres in fractions of the card and sizes are fractions of its
 * width, so a sticker lands in the same spot at every render scale.
 */

import { Text, View } from 'react-native';

import { layoutFandomSticker, stickerHeight } from '../stickers/fandom-layout';
import { definitionFromAffiliation, recipeFor } from '../stickers/fandom-styles';
import { StickerRenderer } from '../stickers/StickerRenderer';
import { BADGE_HOME, stickerRotation } from './card-style';
import { shellMetrics } from './CardShell';
import { DEFAULT_STICKER } from './layout/spec';
import { DEMO_STICKER_GLYPHS } from './demo-card';
import type { Affiliation, CardView, PlacedSticker } from './types';

/** Base width of the affiliation sticker in design units, before `scale`: the
 *  spec's 64 × 64 default spot. */
const AFFILIATION_WIDTH_U = DEFAULT_STICKER.size;
/** Base width of a deco sticker, as a fraction of the card, when a placement
 *  predates `size`. The old 15.33cqw. */
const STICKER_SIZE_DEFAULT = 0.1533;

export function CardOverlay({
	view,
	width,
	glyphs = DEMO_STICKER_GLYPHS
}: {
	view: CardView;
	width: number;
	/** sticker_id → glyph fallback when baked art is not available yet. */
	glyphs?: Record<string, string>;
}) {
	const stickers = [...view.stickers].sort((a, b) => a.z_index - b.z_index);

	return (
		<>
			{view.affiliation ? <AffiliationMark affiliation={view.affiliation} width={width} /> : null}

			{stickers.map((s) => (
				<StickerMark
					key={s.id ?? `${s.sticker_id}-${s.x}-${s.y}`}
					sticker={s}
					glyph={glyphs[s.sticker_id] ?? '★'}
					width={width}
				/>
			))}
		</>
	);
}

function AffiliationMark({ affiliation, width }: { affiliation: Affiliation; width: number }) {
	const m = shellMetrics(width);
	const size = m.u(AFFILIATION_WIDTH_U);
	const x = affiliation.x ?? BADGE_HOME.x;
	const y = affiliation.y ?? BADGE_HOME.y;
	const definition = definitionFromAffiliation(affiliation);
	const layout = layoutFandomSticker(definition.label, recipeFor(definition.styleCategory), size);
	const height = layout ? stickerHeight(layout, size) : size * 0.55;

	return (
		<View
			pointerEvents="none"
			style={{
				position: 'absolute',
				left: m.width * x - size / 2,
				top: m.height * y - height / 2,
				width: size,
				height,
				zIndex: 20,
				transform: [{ rotate: `${affiliation.rotation}deg` }, { scale: affiliation.scale }],
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			<StickerRenderer
				definition={definition}
				foil={affiliation.foil}
				width={size}
				seed={affiliation.id}
			/>
		</View>
	);
}

function StickerMark({
	sticker,
	glyph,
	width
}: {
	sticker: PlacedSticker;
	glyph: string;
	width: number;
}) {
	const m = shellMetrics(width);
	const size = (sticker.size ?? STICKER_SIZE_DEFAULT) * m.width;
	const wobble = stickerRotation(sticker.id ?? sticker.sticker_id);
	const rotation = sticker.rotation + wobble;

	return (
		<View
			pointerEvents="none"
			style={{
				position: 'absolute',
				left: m.width * sticker.x - size / 2,
				top: m.height * sticker.y - size / 2,
				width: size,
				height: size,
				zIndex: sticker.z_index + 1,
				transform: [{ rotate: `${rotation}deg` }, { scale: sticker.scale }],
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			{/* Die-cut rim approximation: soft paper outline behind the glyph. */}
			<Text
				allowFontScaling={false}
				style={{
					position: 'absolute',
					fontSize: size * 0.72,
					lineHeight: size * 0.72,
					color: '#fbf9f3',
					textShadowColor: '#fbf9f3',
					textShadowOffset: { width: 0, height: 0 },
					textShadowRadius: size * 0.14,
					opacity: 0.95
				}}
			>
				{glyph}
			</Text>
			<Text allowFontScaling={false} style={{ fontSize: size * 0.72, lineHeight: size * 0.72 }}>
				{glyph}
			</Text>
		</View>
	);
}
