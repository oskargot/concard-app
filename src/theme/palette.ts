/**
 * Arcade dusk (design bible §12).
 *
 * One dark room with cards as glowing marquees. The bible fixes the *roles* and
 * leaves hex values to the first design pass — these are that pass. Anything
 * that needs a colour should name a role here rather than inlining a hex, so a
 * later retune is one file.
 *
 * The ramp deliberately keeps three steps below the card's own ink (#17161b,
 * see card-style.ts): a flipped card back is drawn in that ink and still has to
 * lift off the page rather than merge into it.
 */

export const palette = {
	/** Deepest ground: behind sheets and modals. */
	void: '#120720',
	/** Base background — the dark room itself. */
	base: '#1A0B2E',
	/** Raised surface: panels, tab bar, list rows. */
	raised: '#241340',
	/** Raised one more step: pressed states, inset wells. */
	raisedHigh: '#2E1A50',
	/** Hairlines and dividers. */
	line: 'rgba(247, 240, 228, 0.12)',
	lineStrong: 'rgba(247, 240, 228, 0.22)',

	/** Hero accent — neon rose, magenta-leaning. Primary actions, the wordmark. */
	rose: '#FF4D97',
	roseDim: '#C93878',
	roseGlow: 'rgba(255, 77, 151, 0.45)',

	/** Secondary — ice teal. Selection, links, the scan reticle. */
	teal: '#45E5D5',
	tealDim: '#2FAEA2',
	tealGlow: 'rgba(69, 229, 213, 0.40)',

	/** Warm accent, used sparingly — butter. Tier badges, celebration. */
	butter: '#FFD98A',

	/** Text and lighter UI. */
	cream: '#F7F0E4',
	creamMute: 'rgba(247, 240, 228, 0.66)',
	creamFaint: 'rgba(247, 240, 228, 0.38)',

	/** Semantic. */
	danger: '#FF5C5C',
	success: '#6BE39A'
} as const;

/**
 * The holo gradient: rose → violet → teal → mint. Reserved for tier reveals,
 * top foils and celebration — never as a background for ordinary chrome, or it
 * stops reading as special.
 */
export const HOLO_STOPS = ['#FF7EC7', '#A97BFF', '#45E5D5', '#9FFFD2'] as const;

/** The same gradient as a CSS string for `experimental_backgroundImage`. */
export const HOLO_GRADIENT = `linear-gradient(110deg, ${HOLO_STOPS.join(', ')})`;

export type PaletteKey = keyof typeof palette;
