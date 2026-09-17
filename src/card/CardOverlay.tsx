/**
 * Everything that sits outside the face clip: the fandom affiliation and stickers.
 *
 * Ported from the overlay snippet in the web app's `Card.svelte`. These hang
 * over the metal frame, so they live in CardShell's `overlay` slot rather than
 * inside the face. Affiliation art goes through `StickerRenderer`; deco glyphs
 * remain a Stage 1/2 prototype until the unified sticker pass.
 */

import { Text, View } from 'react-native';

import { layoutFandomSticker, stickerHeight } from '../stickers/fandom-layout';
import { definitionFromAffiliation, recipeFor } from '../stickers/fandom-styles';
import { StickerRenderer } from '../stickers/StickerRenderer';
import { BADGE_HOME, stickerRotation } from './card-style';
import { shellMetrics } from './CardShell';
import { DEMO_STICKER_GLYPHS } from './demo-card';
import type { Affiliation, CardView, PlacedSticker } from './types';

/** Base width of the affiliation sticker in card units (cqw), before `scale`. */
const AFFILIATION_WIDTH_U = 28;

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
	const m = shellMetrics(width, 'rounded');
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
	const m = shellMetrics(width, 'rounded');
	const size = m.u(15.33);
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
				style={{
					position: 'absolute',
					fontSize: m.u(11),
					lineHeight: m.u(11),
					color: '#fbf9f3',
					textShadowColor: '#fbf9f3',
					textShadowOffset: { width: 0, height: 0 },
					textShadowRadius: m.u(2.2),
					opacity: 0.95
				}}
			>
				{glyph}
			</Text>
			<Text style={{ fontSize: m.u(11), lineHeight: m.u(11) }}>{glyph}</Text>
		</View>
	);
}
