/**
 * The card back, laid out in design units (card spec §5).
 *
 * The QR tile and the URL line under it are one group, centred on the card.
 * The group is 162 + 10 + 12 = 184 tall, so the tile spans x 44–206, y 83–245.
 */

import { BACK, CARD_H, CARD_W } from './spec';
import type { Rect } from './front';

export interface BackLayout {
	tile: Rect;
	/** The QR, quiet zone included. */
	qr: Rect;
	url: Rect;
}

export function layoutBack(): BackLayout {
	const groupH = BACK.tile + BACK.urlGap + BACK.urlLineHeight;
	const tile: Rect = {
		x: (CARD_W - BACK.tile) / 2,
		y: (CARD_H - groupH) / 2,
		w: BACK.tile,
		h: BACK.tile
	};
	const inset = (BACK.tile - BACK.qr) / 2;
	return {
		tile,
		qr: { x: tile.x + inset, y: tile.y + inset, w: BACK.qr, h: BACK.qr },
		url: { x: 0, y: tile.y + tile.h + BACK.urlGap, w: CARD_W, h: BACK.urlLineHeight }
	};
}

/**
 * Module size for a QR of `modules` modules drawn `total` wide with a
 * 4-module quiet zone included in that width. Keeping the quiet zone inside
 * the 150 rather than around it is what lets any phone camera read the code
 * off a cream tile that is only 6 units wider.
 */
export function qrModuleSize(modules: number, total: number): number {
	return total / (modules + BACK.quietModules * 2);
}
