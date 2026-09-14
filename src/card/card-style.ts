/**
 * Visual tokens for the card. Frames are gradients (the angle is what makes
 * them read as metal), backgrounds are flat tints, and everything the face
 * draws in is derived from the background so a dark card inverts cleanly.
 * Mirrors the cards_style_shape check constraint in the database.
 *
 * Ported verbatim from the web app (`concard/src/lib/card-style.ts`) — it is
 * pure TypeScript with no DOM dependency, and the two renderers must agree
 * exactly or a card would look different on the web than in the app. The frame
 * gradients stay CSS strings because React Native's
 * `experimental_backgroundImage` parses that syntax directly.
 *
 * `bio_align` and `link_layout` are added here rather than as their own columns
 * (design bible §6 lists them as card fields): they are style, they belong with
 * the other four, and extending the existing `style` jsonb keeps one check
 * constraint instead of two more columns.
 */

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

export const SHAPES = ['rect', 'rounded', 'shaved'] as const;
export const PHOTO_SHAPES = ['square', 'round', 'arch', 'circle'] as const;
export const BIO_ALIGNS = ['left', 'center', 'right'] as const;
export const LINK_LAYOUTS = ['rows', 'grid'] as const;

export type FrameKey = keyof typeof FRAMES;
export type BgKey = keyof typeof BGS;
export type Shape = (typeof SHAPES)[number];
export type PhotoShape = (typeof PHOTO_SHAPES)[number];
export type BioAlign = (typeof BIO_ALIGNS)[number];
export type LinkLayout = (typeof LINK_LAYOUTS)[number];

export interface CardStyle {
	frame: FrameKey;
	bg: BgKey;
	shape: Shape;
	photo_shape: PhotoShape;
	bio_align: BioAlign;
	link_layout: LinkLayout;
}

export const DEFAULT_STYLE: CardStyle = {
	frame: 'silver',
	bg: 'paper',
	shape: 'rounded',
	photo_shape: 'round',
	bio_align: 'left',
	link_layout: 'rows'
};

export const FRAME_KEYS = Object.keys(FRAMES) as FrameKey[];
export const BG_KEYS = Object.keys(BGS) as BgKey[];

const isFrame = (v: unknown): v is FrameKey => typeof v === 'string' && v in FRAMES;
const isBg = (v: unknown): v is BgKey => typeof v === 'string' && v in BGS;
const isShape = (v: unknown): v is Shape => SHAPES.includes(v as Shape);
const isPhotoShape = (v: unknown): v is PhotoShape => PHOTO_SHAPES.includes(v as PhotoShape);
const isBioAlign = (v: unknown): v is BioAlign => BIO_ALIGNS.includes(v as BioAlign);
const isLinkLayout = (v: unknown): v is LinkLayout => LINK_LAYOUTS.includes(v as LinkLayout);

/** Read a style out of untrusted JSON, filling defaults for anything missing or invalid. */
export function normalizeStyle(input: unknown): CardStyle {
	const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	return {
		frame: isFrame(s.frame) ? s.frame : DEFAULT_STYLE.frame,
		bg: isBg(s.bg) ? s.bg : DEFAULT_STYLE.bg,
		shape: isShape(s.shape) ? s.shape : DEFAULT_STYLE.shape,
		photo_shape: isPhotoShape(s.photo_shape) ? s.photo_shape : DEFAULT_STYLE.photo_shape,
		bio_align: isBioAlign(s.bio_align) ? s.bio_align : DEFAULT_STYLE.bio_align,
		link_layout: isLinkLayout(s.link_layout) ? s.link_layout : DEFAULT_STYLE.link_layout
	};
}

/** A pleasant starting look for a brand-new card, so it never reads as unfinished. */
export function randomStyle(rand: () => number = Math.random): CardStyle {
	const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
	return {
		frame: pick(['silver', 'gold'] as const),
		bg: pick(['paper', 'mint', 'sky', 'blush', 'butter'] as const),
		shape: 'rounded',
		photo_shape: pick(['round', 'arch'] as const),
		bio_align: 'left',
		link_layout: 'rows'
	};
}

export interface FaceInk {
	dark: boolean;
	/** borders, rules, name */
	ink: string;
	/** handle, labels, +N MORE */
	mute: string;
	/** bio text */
	body: string;
	/** chip and panel fill */
	wash: string;
	/** empty photo hatch pair */
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

/**
 * The four text values and hatch pair, derived from the background. Light
 * backgrounds get ink text; anything darker than mid-grey inverts to paper
 * text, so saturated hues stay readable under either metal.
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
			wash: 'rgb(255 255 255 / 0.07)',
			hatchA: '#2b2937',
			hatchB: '#332f40'
		};
	}
	return dark
		? {
				dark,
				ink: '#f7f5ee',
				mute: 'rgb(255 255 255 / 0.72)',
				body: 'rgb(255 255 255 / 0.9)',
				wash: 'rgb(255 255 255 / 0.12)',
				hatchA: shade(hex, 0.06),
				hatchB: shade(hex, 0.12)
			}
		: {
				dark,
				ink: '#17161b',
				mute: 'rgb(23 22 27 / 0.62)',
				body: '#3b382f',
				wash: 'rgb(255 255 255 / 0.55)',
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
export const SHAPE_LABEL: Record<Shape, string> = {
	rect: 'Square corners',
	rounded: 'Rounded',
	shaved: 'Shaved'
};
export const BIO_ALIGN_LABEL: Record<BioAlign, string> = {
	left: 'Left',
	center: 'Centre',
	right: 'Right'
};
export const LINK_LAYOUT_LABEL: Record<LinkLayout, string> = {
	rows: 'Rows',
	grid: 'Grid'
};
export const PHOTO_SHAPE_LABEL: Record<PhotoShape, string> = {
	square: 'Square',
	round: 'Rounded',
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
export function styleToJson(style: CardStyle): Record<string, string> {
	return {
		frame: style.frame,
		bg: style.bg,
		shape: style.shape,
		photo_shape: style.photo_shape,
		bio_align: style.bio_align,
		link_layout: style.link_layout
	};
}

/** Small deterministic rotation (−8°…8°) so a row of discs never looks mechanical. */
export function stickerRotation(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
	return ((Math.abs(h) % 1600) / 100) * (h % 2 === 0 ? 1 : -1);
}

/**
 * Where the fandom badge sits when you have not moved it: the spot it occupied
 * back when it was fixed into the card footer, so a card that never touches it
 * looks the same as it always did. Derived from the card's geometry — a 20cqw
 * badge inset by the 4.67cqw body padding, on a 5:7 card. Mirrors the column
 * defaults in the database.
 */
export const BADGE_HOME = { x: 0.853, y: 0.895 } as const;

/** A freshly uploaded photo: centered, uncropped by any pan, unzoomed. */
export const ART_DEFAULT = { x: 0.5, y: 0.5, scale: 1 } as const;
export const ART_SCALE_RANGE = [1, 3] as const;

/** Sticker position range on the card face (0..1); stickers may overhang the edge. */
export const STICKER_X_RANGE = [-0.14, 1.02] as const;
export const STICKER_Y_RANGE = [-0.1, 0.96] as const;
