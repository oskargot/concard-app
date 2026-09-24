/**
 * Photo cropping from a focal point (card spec §3.3).
 *
 * A photo is stored as a focal point (x, y as fractions of the image) plus a
 * zoom, never as a fixed crop rectangle, because the box it fills changes:
 * the divider moves H, and the shape can switch to a circle. Each time, the
 * image cover-fits the box and is re-cropped around the same point — centred
 * on it where the image allows, pushed back inside where centring would show
 * an edge.
 */

import type { Rect } from './front';

export interface Focal {
	/** 0..1 across the image. */
	x: number;
	/** 0..1 down the image. */
	y: number;
	/** ≥ 1; 1 is a plain cover fit. */
	zoom: number;
}

export const FOCAL_DEFAULT: Focal = { x: 0.5, y: 0.5, zoom: 1 };
export const ZOOM_RANGE = [1, 3] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where the whole image sits relative to a `boxW × boxH` box, so that the box
 * shows the cover-fitted crop around `focal`. `x`/`y` are ≤ 0: the image is
 * always at least as large as the box, so it never leaves a gap.
 */
export function coverCrop(
	imageW: number,
	imageH: number,
	boxW: number,
	boxH: number,
	focal: Focal
): Rect {
	const zoom = clamp(focal.zoom, ZOOM_RANGE[0], ZOOM_RANGE[1]);
	const scale = Math.max(boxW / imageW, boxH / imageH) * zoom;
	const w = imageW * scale;
	const h = imageH * scale;
	return {
		x: clamp(boxW / 2 - focal.x * w, boxW - w, 0),
		y: clamp(boxH / 2 - focal.y * h, boxH - h, 0),
		w,
		h
	};
}

/**
 * The focal point after dragging the picture by `dx, dy` in box units.
 *
 * The result is clamped to the range where the crop still moves, so dragging
 * past an edge and back doesn't have to unwind distance that did nothing.
 */
export function panFocal(
	focal: Focal,
	dx: number,
	dy: number,
	imageW: number,
	imageH: number,
	boxW: number,
	boxH: number
): Focal {
	const crop = coverCrop(imageW, imageH, boxW, boxH, focal);
	const halfX = boxW / 2 / crop.w;
	const halfY = boxH / 2 / crop.h;
	return {
		...focal,
		x: clamp(focal.x - dx / crop.w, halfX, 1 - halfX),
		y: clamp(focal.y - dy / crop.h, halfY, 1 - halfY)
	};
}
