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
	/** Scan-only ground. */
	void: '#0e0d12',
	/** App ground. */
	base: '#121116',
	/** Navigation, cards, sheets and quiet panels. */
	raised: '#1c1b22',
	/** Inputs, inset wells and photo placeholders. */
	raisedHigh: '#26242e',
	/** Borders and dividers. */
	line: '#34323d',
	lineStrong: '#3d3a47',

	/** Primary holo tint. Legacy names remain as compatibility aliases. */
	rose: '#b9c9ff',
	roseDim: '#9aa9dc',
	roseGlow: 'rgba(185, 201, 255, 0.30)',

	/** Secondary mint tint. */
	teal: '#9ff0dc',
	tealDim: '#72c7b2',
	tealGlow: 'rgba(159, 240, 220, 0.28)',

	/** Warm stop used by holo treatments and tier details. */
	butter: '#ffe7a8',

	/** Text hierarchy. */
	cream: '#efedf2',
	creamMute: '#a9a4b8',
	creamFaint: '#8a8898',

	/** Semantic. */
	danger: '#ff7b88',
	success: '#9ff0dc'
} as const;

/**
 * The holo gradient: rose → violet → teal → mint. Reserved for tier reveals,
 * top foils and celebration — never as a background for ordinary chrome, or it
 * stops reading as special.
 */
export const HOLO_STOPS = ['#ffb3e0', '#b9c9ff', '#9ff0dc', '#ffe7a8', '#ffb3e0'] as const;

/** The same gradient as a CSS string for `experimental_backgroundImage`. */
export const HOLO_GRADIENT = `linear-gradient(118deg, ${HOLO_STOPS.join(', ')})`;

export type PaletteKey = keyof typeof palette;
