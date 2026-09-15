/**
 * One component draws a live card or a frozen snapshot — same contract as the
 * web app's `Card.svelte`. Shell, face and overlay stay in lockstep so a card
 * never looks different on concard.me than in the app.
 */

import type { ReactNode } from 'react';

import { CardFace, type CardFaceEdit } from './CardFace';
import { CardOverlay } from './CardOverlay';
import { CardShell, type CardShellProps } from './CardShell';
import type { CardView } from './types';

export interface CardProps extends Pick<
	CardShellProps,
	| 'width'
	| 'foil'
	| 'seed'
	| 'rx'
	| 'ry'
	| 'intensity'
	| 'foilOverrides'
	| 'detail'
	| 'foilEngine'
	| 'foilRecipe'
> {
	view: CardView;
	/** sticker_id → glyph when baked sticker art is not loaded. */
	glyphs?: Record<string, string>;
	/** Editor only: turns the face's text into fields in place. See `CardFace`. */
	edit?: CardFaceEdit;
	/**
	 * Drawn over the card, outside the face clip, alongside the fandom badge.
	 *
	 * The editor passes an interactive `StickerLayer` here. Supplying one also
	 * stands `CardOverlay`'s own sticker marks down, since both would be drawing
	 * the same placements — one draggable, one not.
	 */
	overlay?: ReactNode;
}

export function Card({
	view,
	width,
	foil,
	seed,
	rx,
	ry,
	intensity,
	foilOverrides,
	detail,
	foilEngine,
	foilRecipe,
	glyphs,
	edit,
	overlay
}: CardProps) {
	return (
		<CardShell
			style={view.style}
			width={width}
			foil={foil}
			seed={seed}
			rx={rx}
			ry={ry}
			intensity={intensity}
			foilOverrides={foilOverrides}
			detail={detail}
			foilEngine={foilEngine}
			foilRecipe={foilRecipe}
			overlay={
				<>
					<CardOverlay view={view} width={width} glyphs={glyphs} stickers={!overlay} />
					{overlay}
				</>
			}
		>
			<CardFace view={view} width={width} edit={edit} />
		</CardShell>
	);
}
