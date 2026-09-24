/**
 * Every number in the card spec, in design units.
 *
 * The card is designed once in a fixed 250 × 350 space where 1 unit = 0.01 in
 * (a standard 2.5 × 3.5 in trading card), and every render — hero card, detail
 * view, binder grid, the web `/username` page — draws that same layout scaled
 * uniformly by `renderedWidth / 250`. Nothing reflows between sizes.
 *
 * This module and its siblings in `layout/` have no React Native imports on
 * purpose: they are the part of the card the web renderer must share verbatim,
 * because cross-platform parity is a hard requirement and the cheapest way to
 * get it is for both clients to run the same arithmetic.
 */

/** Card outer size. */
export const CARD_W = 250;
export const CARD_H = 350;

/** Frame, identical front and back (spec §2). */
export const FRAME = {
	/** ≈ ⅛ in, the standard trading-card corner. */
	radius: 12,
	/** The edge band, drawn in the card's edge colour. */
	edge: 8,
	/** Outer 12 − edge 8, so the band stays even around the curve. */
	faceRadius: 4,
	/** Face padding on all sides. */
	pad: 12
} as const;

/** The box every front zone is laid out in, in card coordinates. */
export const CONTENT = { x: 20, y: 20, w: 210, h: 310 } as const;

/** Gap between any two present front zones. */
export const ZONE_GAP = 8;

/** Box treatment shared by the bio box, link pills and pronoun pill. */
export const BOX = { fillOpacity: 0.6, outline: 1 } as const;

export const NAME = {
	top: 0,
	height: 26,
	size: 22,
	lineHeight: 26,
	weight: 700,
	/** −0.02em. */
	tracking: -0.02
} as const;

export const TAG = {
	/** 2 below the 26-tall name row. */
	top: 28,
	height: 14,
	size: 11,
	lineHeight: 14,
	weight: 400
} as const;

export const PILL = {
	height: 14,
	radius: 7,
	padX: 5,
	size: 9,
	lineHeight: 14,
	weight: 600,
	maxWidth: 70,
	/** Closest the centred username may come to the pill. */
	minGap: 6
} as const;

export const PHOTO = {
	top: 50,
	/** The arch's curve needs 105; 112 guarantees a visible straight section. */
	min: 112,
	/** One bio line per divider step. */
	step: 14,
	/** A new card's photo height. */
	initial: 140,
	roundedRadius: 10,
	/** The empty-photo outline. */
	outline: 1
} as const;

export const BIO = {
	radius: 6,
	padX: 6,
	padY: 5,
	size: 10,
	lineHeight: 14,
	weight: 400,
	/** Exactly one line: outline 1 + pad 5 + line 14 + pad 5 + outline 1. */
	minHeight: 26,
	/** Character cap enforced by the editor (the column allows 200). */
	maxChars: 140
} as const;

export const LINKS = {
	colWidth: 102,
	colGap: 6,
	rowHeight: 18,
	rowGap: 4,
	perColumn: 4,
	max: 8,
	radius: 4,
	padLeft: 7,
	icon: 10,
	iconGap: 5,
	padRight: 7,
	/** 102 − 7 − 10 − 5 − 7. */
	textWidth: 73,
	size: 8,
	lineHeight: 18,
	weight: 400
} as const;

/** The default affiliation-sticker spot: bottom-right corner of the content box. */
export const DEFAULT_STICKER = { size: 64, x: 166, y: 266 } as const;

/** Card back (spec §5). */
export const BACK = {
	tile: 162,
	tileRadius: 8,
	/** QR including its quiet zone. */
	qr: 150,
	quietModules: 4,
	urlGap: 10,
	urlSize: 9,
	urlLineHeight: 12,
	urlWeight: 400
} as const;

/** Photo/bio divider handle (editor only, spec §6). */
export const DIVIDER = {
	width: 28,
	height: 6,
	/** Invisible touch target in screen points, whatever the card's scale. */
	touch: 44
} as const;
