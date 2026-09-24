/**
 * One component draws a live card or a frozen snapshot — same contract as the
 * web app's `Card.svelte`. Shell, face and overlay stay in lockstep so a card
 * never looks different on concard.me than in the app.
 *
 * Layering, bottom to top (card spec §7): face colour; photo, text, bio box and
 * pills; the tier foil over the whole face; stickers. In the editor the divider
 * handle rides on top of all of it.
 */

import { CardFace, useFrontLayout, type CardFaceEdit } from './CardFace';
import { CardOverlay } from './CardOverlay';
import { CardShell, type CardShellProps } from './CardShell';
import { inkFor } from './card-style';
import { DividerHandle } from './editor/DividerHandle';
import { normalizeLinks } from './links';
import type { CardView } from './types';

export interface CardProps extends Pick<
	CardShellProps,
	'width' | 'foil' | 'seed' | 'rx' | 'ry' | 'intensity' | 'detail' | 'light'
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
	light,
	glyphs,
	edit
}: CardProps) {
	const { style, layout } = useFrontLayout(view);

	return (
		<CardShell
			style={style}
			width={width}
			foil={foil}
			seed={seed}
			rx={rx}
			ry={ry}
			intensity={intensity}
			detail={detail}
			light={light}
			overlay={
				<>
					<CardOverlay view={view} width={width} glyphs={glyphs} />
					{edit?.onChangePhotoHeight ? (
						<DividerHandle
							layout={layout}
							linkCount={normalizeLinks(view.links).length}
							width={width}
							ink={inkFor(style.bg)}
							onChange={edit.onChangePhotoHeight}
							onInteraction={edit.onInteraction}
						/>
					) : null}
				</>
			}
		>
			<CardFace view={view} width={width} edit={edit} />
		</CardShell>
	);
}
