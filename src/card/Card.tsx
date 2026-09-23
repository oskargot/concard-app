/**
 * One component draws a live card or a frozen snapshot — same contract as the
 * web app's `Card.svelte`. Shell, face and overlay stay in lockstep so a card
 * never looks different on concard.me than in the app.
 */

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
	| 'detail'
> {
	view: CardView;
	/** sticker_id → glyph when baked sticker art is not loaded. */
	glyphs?: Record<string, string>;
	/** Editor only: turns the face's text into fields in place. See `CardFace`. */
	edit?: CardFaceEdit;
}

export function Card({
	view,
	width,
	foil,
	seed,
	rx,
	ry,
	intensity,
	detail,
	glyphs,
	edit
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
			detail={detail}
			overlay={<CardOverlay view={view} width={width} glyphs={glyphs} />}
		>
			<CardFace view={view} width={width} edit={edit} />
		</CardShell>
	);
}
