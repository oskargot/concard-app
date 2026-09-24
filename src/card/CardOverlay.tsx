/**
 * Everything that sits outside the face clip: the stickers, the fandom
 * affiliation among them.
 *
 * Card spec §4: stickers are an overlay above everything on the front, tier
 * foil included, and never part of the layout — nothing reflows around them.
 * Positions are centres in fractions of the card and sizes are fractions of
 * its width, so a sticker lands in the same spot at every render scale. They
 * hang over the edge band, which is why they live in CardShell's `overlay`
 * slot rather than inside the face.
 *
 * Every sticker draws through `StickerRenderer`, lit by this card's own
 * `rx`/`ry`, so a foiled sticker catches the same light as the card under it.
 * The affiliation is a placement like any other once the schema has moved it
 * there (`is_affiliation`); a card or snapshot that still carries it the old
 * way, as `view.affiliation`, gets it drawn from that, on top as before.
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { AFFILIATION_STICKER_WIDTH, baseSizeOf } from '../stickers/constants';
import { definitionForPlacement, fandomStickerId } from '../stickers/definitions';
import type { StickerOnCard } from '../stickers/StickerFoil';
import { StickerRenderer, stickerBox } from '../stickers/StickerRenderer';
import { BADGE_HOME, stickerRotation } from './card-style';
import { shellMetrics } from './CardShell';
import type { Affiliation, CardView, PlacedSticker } from './types';

/** Legacy affiliations drew above every sticker. */
const LEGACY_AFFILIATION_Z = 1000;

export function CardOverlay({
	view,
	width,
	rx,
	ry
}: {
	view: CardView;
	width: number;
	/** The card's tilt: stickers' foil shares its light. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
}) {
	const stickers = useMemo(() => {
		const placed = [...view.stickers];
		if (view.affiliation && !placed.some((s) => s.is_affiliation)) {
			placed.push(affiliationPlacement(view.affiliation));
		}
		return placed.sort((a, b) => a.z_index - b.z_index);
	}, [view.stickers, view.affiliation]);

	return (
		<>
			{stickers.map((s) => (
				<StickerMark
					key={s.id ?? `${s.sticker_id}-${s.x}-${s.y}`}
					sticker={s}
					width={width}
					rx={rx}
					ry={ry}
				/>
			))}
		</>
	);
}

/** A card-column affiliation, as the placement the schema now stores. */
export function affiliationPlacement(affiliation: Affiliation): PlacedSticker {
	return {
		sticker_id: fandomStickerId(affiliation.id),
		kind: 'fandom',
		label: affiliation.name,
		style_category: affiliation.style_category,
		fandom_id: affiliation.id,
		x: affiliation.x ?? BADGE_HOME.x,
		y: affiliation.y ?? BADGE_HOME.y,
		rotation: affiliation.rotation,
		scale: affiliation.scale,
		foil: affiliation.foil,
		size: AFFILIATION_STICKER_WIDTH,
		is_affiliation: true,
		z_index: LEGACY_AFFILIATION_Z
	};
}

function StickerMark({
	sticker,
	width,
	rx,
	ry
}: {
	sticker: PlacedSticker;
	width: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
}) {
	const m = shellMetrics(width);
	const definition = useMemo(() => definitionForPlacement(sticker), [sticker]);
	const size = baseSizeOf(sticker) * m.width;
	const box = stickerBox(definition, size);
	// The fixed per-sticker wobble both clients add; the affiliation never had one.
	const rotation =
		sticker.rotation +
		(sticker.is_affiliation ? 0 : stickerRotation(sticker.id ?? sticker.sticker_id));
	const cx = m.width * sticker.x;
	const cy = m.height * sticker.y;

	const card = useMemo<StickerOnCard>(
		() => ({ width: m.width, height: m.height, cx, cy, rotation, scale: sticker.scale }),
		[m.width, m.height, cx, cy, rotation, sticker.scale]
	);
	const light = useMemo(() => ({ rx, ry, card }), [rx, ry, card]);

	return (
		<View
			pointerEvents="none"
			style={{
				position: 'absolute',
				left: cx - box.width / 2,
				top: cy - box.height / 2,
				width: box.width,
				height: box.height,
				zIndex:
					sticker.is_affiliation && sticker.z_index === LEGACY_AFFILIATION_Z
						? 20
						: sticker.z_index + 1,
				transform: [{ rotate: `${rotation}deg` }, { scale: sticker.scale }],
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			<StickerRenderer definition={definition} foil={sticker.foil} width={size} light={light} />
		</View>
	);
}
