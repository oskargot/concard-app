/**
 * Visual tokens for the card. Frames are gradients (the angle is what makes
 * them read as metal), backgrounds are flat tints, and everything the face
 * draws in is derived from the background so a dark card inverts cleanly.
 * Mirrors the cards_style_shape check constraint in the database.
 *
 * The frame and background tokens are ported verbatim from the web app
 * (`concard/src/lib/card-style.ts`) — it is pure TypeScript with no DOM
 * dependency, and the two renderers must agree exactly or a card would look
 * different on the web than in the app. The frame gradients stay CSS strings
 * because React Native's `experimental_backgroundImage` parses that syntax
 * directly.
 *
 * The card spec's `alignment` and `photo_height` live here too rather than as
 * their own columns: they are style, and the `style` jsonb is what
 * `collect_card()` freezes into every snapshot whole, so a collected card keeps
 * its photo height and alignment without the snapshot function learning about
 * either.
 */

import { CARD_H, CARD_W, DEFAULT_STICKER, PHOTO } from './layout/spec';

export const FRAMES = {
	silver:
		'linear-gradient(140deg,#fdfdff 0%,#b4b8c4 26%,#f4f5f9 46%,#8f96a5 66%,#eceef3 88%,#c3c7d1 100%)',
	gold: 'linear-gradient(140deg,#fff6d8 0%,#d8ab4e 30%,#fffbe9 50%,#bd8c33 70%,#ffefc0 100%)',
	holo: 'linear-gradient(118deg,#ffb3e0,#b9c9ff,#9ff0dc,#ffe7a8,#ffb3e0)',
	ink: 'linear-gradient(140deg,#4a4756,#17161b 60%,#3a3844)'
} as const;

export const BGS = {
	// pastels
	paper: '#fbf9f3',
	mint: '#e7f8f1',
	sky: '#eaeeff',
	blush: '#fdeaf3',
	butter: '#fff5d9',
	// the spectrum, hue by hue
	red: '#e8555a',
	orange: '#f0722a',
	amber: '#f5b301',
	lime: '#8fc93a',
	green: '#2fa36b',
	teal: '#1f9e8f',
	cyan: '#2aa6d8',
	blue: '#3566da',
	indigo: '#5a4fcf',
	violet: '#8a4fd6',
	magenta: '#cd58bd',
	rose: '#e0527d',
	// dark
	slate: '#22202c'
} as const;

/**
 * The old card silhouette. The card spec fixes every card at the standard
 * 12-unit corner, so this is no longer drawn or offered; it is still read and
 * written back untouched because the `cards_style_shape` constraint and the
 * not-yet-ported web card both know it.
 */
export const SHAPES = ['rect', 'rounded', 'shaved'] as const;
export const PHOTO_SHAPES = ['sharp', 'rounded', 'arch', 'circle'] as const;
export const ALIGNMENTS = ['left', 'center', 'right'] as const;

export type FrameKey = keyof typeof FRAMES;
export type BgKey = keyof typeof BGS;
export type Shape = (typeof SHAPES)[number];
export type PhotoShape = (typeof PHOTO_SHAPES)[number];
export type Alignment = (typeof ALIGNMENTS)[number];

export interface CardStyle {
	/** The edge colour. Cosmetic; not tied to tier. */
	frame: FrameKey;
	/** The face colour. */
	bg: BgKey;
	/** Legacy silhouette, carried through unchanged. See `SHAPES`. */
	shape: Shape;
	photo_shape: PhotoShape;
	/** Name, username row and bio alignment (card spec §3.6). */
	alignment: Alignment;
	/** Photo zone height H in design units, snapped to a divider stop. */
	photo_height: number;
}

export const DEFAULT_STYLE: CardStyle = {
	frame: 'silver',
	bg: 'paper',
	shape: 'rounded',
	photo_shape: 'rounded',
	alignment: 'left',
	photo_height: PHOTO.initial
};

export const FRAME_KEYS = Object.keys(FRAMES) as FrameKey[];
export const BG_KEYS = Object.keys(BGS) as BgKey[];

/**
 * Photo shapes as the database spells them.
 *
 * The live `cards_style_shape` constraint only accepts the old names
 * (`square | round | arch | circle`), and a rejected constraint fails the whole
 * autosave, not just the shape. So the app reads both spellings and writes the
 * old ones until `20260923000000_card_spec_v2.sql` widens the constraint; after
 * that, flip `WRITE_LEGACY_PHOTO_SHAPES` off.
 */
const WRITE_LEGACY_PHOTO_SHAPES = true;
const LEGACY_PHOTO_SHAPE: Record<string, PhotoShape> = { square: 'sharp', round: 'rounded' };
const PHOTO_SHAPE_TO_LEGACY: Record<PhotoShape, string> = {
	sharp: 'square',
	rounded: 'round',
	arch: 'arch',
	circle: 'circle'
};

const isFrame = (v: unknown): v is FrameKey => typeof v === 'string' && v in FRAMES;
const isBg = (v: unknown): v is BgKey => typeof v === 'string' && v in BGS;
const isShape = (v: unknown): v is Shape => SHAPES.includes(v as Shape);
const isAlignment = (v: unknown): v is Alignment => ALIGNMENTS.includes(v as Alignment);

function readPhotoShape(v: unknown): PhotoShape {
	if (PHOTO_SHAPES.includes(v as PhotoShape)) return v as PhotoShape;
	if (typeof v === 'string' && v in LEGACY_PHOTO_SHAPE) return LEGACY_PHOTO_SHAPE[v];
	return DEFAULT_STYLE.photo_shape;
}

function readPhotoHeight(v: unknown): number {
	const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
	// Only the floor is enforced here. The ceiling depends on how many links the
	// card has, so `layoutFront` snaps and clamps against that when it draws.
	return Number.isFinite(n) ? Math.max(PHOTO.min, Math.round(n)) : DEFAULT_STYLE.photo_height;
}

/**
 * Read a style out of untrusted JSON, filling defaults for anything missing or
 * invalid. Idempotent, so it is also safe on a style that is already a
 * `CardStyle` — the renderer runs it on persisted binder cards written by
 * older builds.
 */
export function normalizeStyle(input: unknown): CardStyle {
	const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	return {
		frame: isFrame(s.frame) ? s.frame : DEFAULT_STYLE.frame,
		bg: isBg(s.bg) ? s.bg : DEFAULT_STYLE.bg,
		shape: isShape(s.shape) ? s.shape : DEFAULT_STYLE.shape,
		photo_shape: readPhotoShape(s.photo_shape),
		// `bio_align` is the key this setting had before it applied to the whole
		// face; cards written then still carry only that.
		alignment: isAlignment(s.alignment)
			? s.alignment
			: isAlignment(s.bio_align)
				? s.bio_align
				: DEFAULT_STYLE.alignment,
		photo_height: readPhotoHeight(s.photo_height)
	};
}

/** A pleasant starting look for a brand-new card, so it never reads as unfinished. */
export function randomStyle(rand: () => number = Math.random): CardStyle {
	const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
	return {
		frame: pick(['silver', 'gold'] as const),
		bg: pick(['paper', 'mint', 'sky', 'blush', 'butter'] as const),
		shape: 'rounded',
		photo_shape: pick(['rounded', 'arch'] as const),
		alignment: 'left',
		photo_height: PHOTO.initial
	};
}

/**
 * The colour roles a face draws in. The card spec names four of them:
 * **primary text** = `ink`, **dim text** = `mute`, **line colour** = `line`,
 * **raised colour** = `raised` (drawn at 60% opacity under boxes and pills).
 */
export interface FaceInk {
	dark: boolean;
	/** Primary text: the name and the pronoun pill. */
	ink: string;
	/** Dim text: username, bio, link handles and icons. */
	mute: string;
	/** Longer text on the collector's-record back. */
	body: string;
	/** Translucent panel fill (the collector's-record back). */
	wash: string;
	/** 1-unit outlines: boxes, pills, the empty photo shape, the divider. */
	line: string;
	/** Opaque box fill, drawn at `BOX.fillOpacity`. */
	raised: string;
	/** Hatch pair, kept for anything still drawing the old empty-photo well. */
	hatchA: string;
	hatchB: string;
}

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
	return (
		'#' +
		[r, g, b]
			.map((v) =>
				Math.round(Math.min(255, Math.max(0, v)))
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex).map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mix a hex colour toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
	const target = amount > 0 ? 255 : 0;
	const t = Math.abs(amount);
	return rgbToHex(hexToRgb(hex).map((v) => v + (target - v) * t) as [number, number, number]);
}

/** `#rrggbb` at an alpha, for the spec's "raised colour at 60%". */
export function withAlpha(hex: string, alpha: number): string {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Every colour role, derived from the background. Light backgrounds get ink
 * text; anything darker than mid-grey inverts to paper text, so saturated hues
 * stay readable under either metal.
 */
export function inkFor(bg: BgKey): FaceInk {
	const hex = BGS[bg];
	// below this the background is too dark for ink text to reach 4.5:1; above it,
	// paper text would fail instead. Every token in BGS sits clear of the line.
	const dark = luminance(hex) < 0.22;
	if (bg === 'slate') {
		// the one background the design spec tuned by hand
		return {
			dark: true,
			ink: '#f2efe6',
			mute: '#a9a4b8',
			body: '#ded9e6',
			wash: 'rgba(255,255,255,0.07)',
			line: 'rgba(242,239,230,0.2)',
			raised: '#3a3747',
			hatchA: '#2b2937',
			hatchB: '#332f40'
		};
	}
	return dark
		? {
				dark,
				ink: '#f7f5ee',
				mute: 'rgba(255,255,255,0.72)',
				body: 'rgba(255,255,255,0.9)',
				wash: 'rgba(255,255,255,0.12)',
				line: 'rgba(255,255,255,0.3)',
				// A lift of the face's own hue, so a box on red reads as red, raised.
				raised: shade(hex, 0.24),
				hatchA: shade(hex, 0.06),
				hatchB: shade(hex, 0.12)
			}
		: {
				dark,
				ink: '#17161b',
				mute: 'rgba(23,22,27,0.62)',
				body: '#3b382f',
				wash: 'rgba(255,255,255,0.55)',
				line: 'rgba(23,22,27,0.16)',
				raised: '#ffffff',
				hatchA: shade(hex, -0.07),
				hatchB: shade(hex, -0.03)
			};
}

export const FRAME_LABEL: Record<FrameKey, string> = {
	silver: 'Silver',
	gold: 'Gold',
	holo: 'Holo',
	ink: 'Ink'
};
export const BG_LABEL: Record<BgKey, string> = {
	paper: 'Paper',
	mint: 'Mint',
	sky: 'Sky',
	blush: 'Blush',
	butter: 'Butter',
	red: 'Red',
	orange: 'Orange',
	amber: 'Amber',
	lime: 'Lime',
	green: 'Green',
	teal: 'Teal',
	cyan: 'Cyan',
	blue: 'Blue',
	indigo: 'Indigo',
	violet: 'Violet',
	magenta: 'Magenta',
	rose: 'Rose',
	slate: 'Slate'
};
export const ALIGNMENT_LABEL: Record<Alignment, string> = {
	left: 'Left',
	center: 'Centre',
	right: 'Right'
};
export const PHOTO_SHAPE_LABEL: Record<PhotoShape, string> = {
	sharp: 'Sharp',
	rounded: 'Rounded',
	arch: 'Arch',
	circle: 'Circle'
};

/**
 * The style as a plain record, for writing to the `style` jsonb column.
 *
 * CardStyle is a closed interface, which Supabase's `Json` type rejects because
 * it has no index signature. Spreading it into a record keeps the write typed
 * without weakening CardStyle itself, and it names every key explicitly so a new
 * axis cannot be silently dropped on the way to the database.
 */
export function styleToJson(style: CardStyle): Record<string, string | number> {
	return {
		frame: style.frame,
		bg: style.bg,
		shape: style.shape,
		photo_shape: WRITE_LEGACY_PHOTO_SHAPES
			? PHOTO_SHAPE_TO_LEGACY[style.photo_shape]
			: style.photo_shape,
		alignment: style.alignment,
		// Mirrored under its old key so the web card, which still reads
		// `bio_align`, keeps aligning its bio until it is ported to the spec.
		bio_align: style.alignment,
		photo_height: style.photo_height
	};
}

/** Small deterministic rotation (−8°…8°) so a row of discs never looks mechanical. */
export function stickerRotation(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
	return ((Math.abs(h) % 1600) / 100) * (h % 2 === 0 ? 1 : -1);
}

/**
 * Where the fandom affiliation sits when you have not moved it: the card
 * spec's default sticker spot, a 64 × 64 square in the bottom-right corner of
 * the content box (x 166–230, y 266–330), stored as its centre in fractions of
 * the card. It deliberately sits over the right link column.
 */
export const BADGE_HOME = {
	x: (DEFAULT_STICKER.x + DEFAULT_STICKER.size / 2) / CARD_W,
	y: (DEFAULT_STICKER.y + DEFAULT_STICKER.size / 2) / CARD_H
} as const;

/**
 * Where the affiliation defaulted to before the card spec. The database column
 * default was this too, so a card still carrying exactly these values has
 * never been moved and should follow the default to its new spot.
 */
export const BADGE_HOME_LEGACY = { x: 0.853, y: 0.895 } as const;

/**
 * The card back's face and the divider handle: one graphite for every card.
 * The same value the back has always been drawn in.
 */
export const GRAPHITE = '#17161b';

/** The QR tile on the back: the prototype's cream. */
export const QR_TILE = '#fbf9f3';

/**
 * The edge drawn on an offline placeholder back, before sync says what the
 * giver's edge colour is. Deliberately not one of the user's choices.
 */
export const NEUTRAL_EDGE = 'linear-gradient(140deg,#77737f,#4d4a56 50%,#77737f)';

/** A freshly uploaded photo: centred on the middle of the image, unzoomed. */
export const ART_DEFAULT = { x: 0.5, y: 0.5, scale: 1 } as const;
export const ART_SCALE_RANGE = [1, 3] as const;

/** Sticker position range on the card face (0..1); stickers may overhang the edge. */
export const STICKER_X_RANGE = [-0.14, 1.02] as const;
export const STICKER_Y_RANGE = [-0.1, 0.96] as const;
