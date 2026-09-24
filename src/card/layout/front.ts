/**
 * The card front, laid out in design units (card spec §3 and §6).
 *
 * `layoutFront` turns the card's content and style into absolute rectangles
 * and the exact strings to draw in them: the name already ellipsised, the
 * pronoun pill already truncated, the bio already broken into the whole lines
 * that fit. Renderers only position what this returns. That is how the app,
 * the web page and a months-old collection snapshot all draw the same card.
 *
 * All rectangles are in **card coordinates** (0..250 × 0..350, the frame
 * included), so stickers, the editor's divider and its side controls can use
 * them without knowing about the face inset.
 */

import { ellipsize, measureText, wrapText, type TextFont } from './measure';
import { BIO, BOX, CONTENT, LINKS, NAME, PHOTO, PILL, TAG, ZONE_GAP } from './spec';

export type Alignment = 'left' | 'center' | 'right';
export type PhotoShape = 'sharp' | 'rounded' | 'arch' | 'circle';

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Radii {
	tl: number;
	tr: number;
	br: number;
	bl: number;
}

export const NAME_FONT: TextFont = {
	weight: NAME.weight,
	size: NAME.size,
	tracking: NAME.tracking
};
export const TAG_FONT: TextFont = { weight: TAG.weight, size: TAG.size };
export const PILL_FONT: TextFont = { weight: PILL.weight, size: PILL.size };
export const BIO_FONT: TextFont = { weight: BIO.weight, size: BIO.size };
export const LINK_FONT: TextFont = { weight: LINKS.weight, size: LINKS.size };

/** What the front needs to know. Colour and edge don't move anything. */
export interface FrontInput {
	name: string;
	username: string;
	pronouns: string | null | undefined;
	bio: string;
	/** Display handles, in position order. Only the count and the text matter here. */
	linkHandles: string[];
	photoShape: PhotoShape;
	/** Stored H; snapped and clamped here, so a stale value can never break the layout. */
	photoHeight: number;
	alignment: Alignment;
}

export interface FrontLayout {
	name: { rect: Rect; text: string; truncated: boolean; align: Alignment };
	username: { rect: Rect; text: string };
	/** Null when there are no pronouns, or no room left beside the username. */
	pill: { rect: Rect; text: string; truncated: boolean } | null;
	/** True when pronouns exist but the pill had no room to draw at all. */
	pillHidden: boolean;
	photo: {
		/** The whole zone, 210 × H. */
		zone: Rect;
		/** Where the picture is clipped: the zone, or the centred circle. */
		clip: Rect;
		radii: Radii;
		/** H after snapping and clamping. */
		height: number;
		maxHeight: number;
	};
	/** Null when the bio is empty or there is no room for even one line. */
	bio: {
		rect: Rect;
		/** Text area: 196 wide. Padding is measured inside the 1-unit outline:
		 *  210 − 2 × (1 + 6) = 196, and (h − 12) / 14 whole lines. */
		text: Rect;
		lines: string[];
		/** Lines of the bio that did not fit and are not drawn. */
		hiddenLines: number;
		align: Alignment;
	} | null;
	/** Why the bio is not drawn, when it has text but no box. */
	bioHidden: boolean;
	links: {
		rows: number;
		block: Rect | null;
		pills: LinkPillLayout[];
	};
	/** Centre of the editor's divider handle, in the gap below the photo. */
	divider: { x: number; y: number };
}

export interface LinkPillLayout {
	index: number;
	rect: Rect;
	icon: Rect;
	text: Rect;
	label: string;
	truncated: boolean;
}

/** Rows the links grid needs: the left column fills first, up to four. */
export function linkRows(count: number): number {
	return Math.min(Math.max(count, 0), LINKS.perColumn);
}

export function linksBlockHeight(count: number): number {
	const rows = linkRows(count);
	return rows ? rows * LINKS.rowHeight + (rows - 1) * LINKS.rowGap : 0;
}

/**
 * H_max: the photo takes everything above the links block and the bio is gone.
 * No links: 260. One row: 234. Four rows: 168.
 */
export function photoHeightMax(linkCount: number): number {
	const links = linkCount > 0 ? ZONE_GAP + linksBlockHeight(linkCount) : 0;
	return CONTENT.h - PHOTO.top - links;
}

/**
 * Every position the divider can rest at: 112, 126, 140, … in one-bio-line
 * steps, and finally H_max itself, which is usually off the 14 grid.
 */
export function photoHeightStops(linkCount: number): number[] {
	const max = photoHeightMax(linkCount);
	const stops: number[] = [];
	for (let h = PHOTO.min; h <= max; h += PHOTO.step) stops.push(h);
	if (stops[stops.length - 1] !== max) stops.push(max);
	return stops;
}

/** The stop nearest `h`, so any stored or dragged value lands on a real position. */
export function snapPhotoHeight(h: number, linkCount: number): number {
	const stops = photoHeightStops(linkCount);
	if (!Number.isFinite(h)) return Math.min(PHOTO.initial, stops[stops.length - 1]);
	let best = stops[0];
	for (const s of stops) if (Math.abs(s - h) < Math.abs(best - h)) best = s;
	return best;
}

/**
 * Whether one more link fits without shrinking the photo (spec §3.5).
 *
 * Links never take height from the photo. A link that opens a new row takes
 * it from the bio instead, and when the photo already reaches past where the
 * new H_max would be, there is nothing left to take: the editor blocks the add
 * until the divider moves up.
 */
export function canAddLink(photoHeight: number, linkCount: number): boolean {
	if (linkCount >= LINKS.max) return false;
	if (linkRows(linkCount + 1) === linkRows(linkCount)) return true;
	return snapPhotoHeight(photoHeight, linkCount) <= photoHeightMax(linkCount + 1);
}

function photoRadii(shape: PhotoShape, clip: Rect): Radii {
	switch (shape) {
		case 'sharp':
			return { tl: 0, tr: 0, br: 0, bl: 0 };
		case 'rounded':
			return {
				tl: PHOTO.roundedRadius,
				tr: PHOTO.roundedRadius,
				br: PHOTO.roundedRadius,
				bl: PHOTO.roundedRadius
			};
		case 'arch':
			// A full semicircle across the top: radius is half the width.
			return { tl: clip.w / 2, tr: clip.w / 2, br: 0, bl: 0 };
		case 'circle':
			return { tl: clip.w / 2, tr: clip.w / 2, br: clip.w / 2, bl: clip.w / 2 };
	}
}

function alignedX(align: Alignment, width: number): number {
	if (align === 'left') return CONTENT.x;
	if (align === 'right') return CONTENT.x + CONTENT.w - width;
	return CONTENT.x + (CONTENT.w - width) / 2;
}

function tagRow(input: FrontInput): Pick<FrontLayout, 'username' | 'pill' | 'pillHidden'> {
	const top = CONTENT.y + TAG.top;
	const text = `@${input.username}`;
	// The username never truncates; usernames are capped at 20 characters at
	// signup precisely so this width always fits.
	const uw = measureText(text, TAG_FONT);
	const pronouns = (input.pronouns ?? '').trim();

	let pill: FrontLayout['pill'] = null;
	let pillHidden = false;
	let pillX = 0;
	let pillW = 0;
	if (pronouns) {
		// The pill truncates first: it gets whatever the username leaves, up to 70.
		const room = Math.min(PILL.maxWidth, CONTENT.w - uw - PILL.minGap);
		const fitted = ellipsize(pronouns, room - PILL.padX * 2, PILL_FONT);
		if (fitted.text) {
			pillW = fitted.width + PILL.padX * 2;
			pillX = input.alignment === 'right' ? CONTENT.x : CONTENT.x + CONTENT.w - pillW;
			pill = {
				rect: { x: pillX, y: top, w: pillW, h: PILL.height },
				text: fitted.text,
				truncated: fitted.truncated
			};
		} else {
			pillHidden = true;
		}
	}

	let ux = alignedX(input.alignment, uw);
	if (input.alignment === 'center' && pill) {
		// Truly centred unless that would crowd the pill; then it slides left
		// until the gap is exactly 6.
		ux = Math.min(ux, pillX - PILL.minGap - uw);
	}

	return {
		username: { rect: { x: ux, y: top, w: uw, h: TAG.height }, text },
		pill,
		pillHidden
	};
}

export function layoutFront(input: FrontInput): FrontLayout {
	const count = Math.min(input.linkHandles.length, LINKS.max);

	// Name: one line, ellipsised at the content width, aligned per the setting.
	const name = ellipsize(input.name, CONTENT.w, NAME_FONT);

	// Photo.
	const maxHeight = photoHeightMax(count);
	const height = snapPhotoHeight(input.photoHeight, count);
	const zone: Rect = { x: CONTENT.x, y: CONTENT.y + PHOTO.top, w: CONTENT.w, h: height };
	let clip = zone;
	if (input.photoShape === 'circle') {
		const d = Math.min(height, CONTENT.w);
		clip = { x: zone.x + (zone.w - d) / 2, y: zone.y + (zone.h - d) / 2, w: d, h: d };
	}

	// Links, anchored to the bottom of the content box.
	const rows = linkRows(count);
	const blockH = linksBlockHeight(count);
	const contentBottom = CONTENT.y + CONTENT.h;
	const blockTop = contentBottom - blockH;
	const pills: LinkPillLayout[] = [];
	for (let i = 0; i < count; i++) {
		const col = i < LINKS.perColumn ? 0 : 1;
		const row = i % LINKS.perColumn;
		const x = CONTENT.x + col * (LINKS.colWidth + LINKS.colGap);
		const y = blockTop + row * (LINKS.rowHeight + LINKS.rowGap);
		const fitted = ellipsize(input.linkHandles[i] ?? '', LINKS.textWidth, LINK_FONT);
		pills.push({
			index: i,
			rect: { x, y, w: LINKS.colWidth, h: LINKS.rowHeight },
			icon: {
				x: x + LINKS.padLeft,
				y: y + (LINKS.rowHeight - LINKS.icon) / 2,
				w: LINKS.icon,
				h: LINKS.icon
			},
			text: {
				x: x + LINKS.padLeft + LINKS.icon + LINKS.iconGap,
				y,
				w: LINKS.textWidth,
				h: LINKS.rowHeight
			},
			label: fitted.text,
			truncated: fitted.truncated
		});
	}

	// Bio: whatever is left between the photo and the links, whole lines only.
	const bioTop = zone.y + zone.h + ZONE_GAP;
	const bioBottom = count > 0 ? blockTop - ZONE_GAP : contentBottom;
	const bioHeight = bioBottom - bioTop;
	const bioText = input.bio.trim();
	let bio: FrontLayout['bio'] = null;
	let bioHidden = false;
	if (bioText) {
		if (bioHeight >= BIO.minHeight) {
			const inset = BOX.outline;
			const textRect: Rect = {
				x: CONTENT.x + inset + BIO.padX,
				y: bioTop + inset + BIO.padY,
				w: CONTENT.w - (inset + BIO.padX) * 2,
				h: bioHeight - (inset + BIO.padY) * 2
			};
			const all = wrapText(bioText, textRect.w, BIO_FONT);
			const visible = Math.floor((bioHeight - (inset + BIO.padY) * 2) / BIO.lineHeight);
			bio = {
				rect: { x: CONTENT.x, y: bioTop, w: CONTENT.w, h: bioHeight },
				text: textRect,
				lines: all.slice(0, visible),
				hiddenLines: Math.max(0, all.length - visible),
				align: input.alignment
			};
		} else {
			bioHidden = true;
		}
	}

	return {
		name: {
			rect: { x: CONTENT.x, y: CONTENT.y + NAME.top, w: CONTENT.w, h: NAME.height },
			text: name.text,
			truncated: name.truncated,
			align: input.alignment
		},
		...tagRow(input),
		photo: { zone, clip, radii: photoRadii(input.photoShape, clip), height, maxHeight },
		bio,
		bioHidden,
		links: {
			rows,
			block: count ? { x: CONTENT.x, y: blockTop, w: CONTENT.w, h: blockH } : null,
			pills
		},
		divider: { x: CONTENT.x + CONTENT.w / 2, y: zone.y + zone.h + ZONE_GAP / 2 }
	};
}

/** Room for the bio at a given photo height and link count, or 0 when it would hide. */
export function bioRoom(photoHeight: number, linkCount: number): number {
	const h = snapPhotoHeight(photoHeight, linkCount);
	const bottom =
		linkCount > 0
			? CONTENT.y + CONTENT.h - linksBlockHeight(linkCount) - ZONE_GAP
			: CONTENT.y + CONTENT.h;
	const room = bottom - (CONTENT.y + PHOTO.top + h + ZONE_GAP);
	return room >= BIO.minHeight ? room : 0;
}
