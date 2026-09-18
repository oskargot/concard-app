/**
 * Dark velvet display case (Concard style guide).
 *
 * The app chrome is intentionally neutral and dark — the cards are the hero.
 * Backgrounds recede (ground → surface → raised), surfaces are barely
 * distinguishable from the ground, and the only colour that "pops" is the holo
 * gradient, reserved for primary actions, the Scan control, and card frames.
 *
 * Every value here is taken from the approved mockups. Anything that needs a
 * colour should name a role rather than inlining a hex, so a later retune is one
 * file. New code should use the guide roles (`ground`, `surface`, `holo`, …);
 * the block of legacy aliases at the bottom keeps the old "arcade dusk" role
 * names (`void`, `rose`, `cream`, …) compiling while callers migrate, each
 * pointing at its nearest guide value.
 */

export const palette = {
	/* Background layers (darkest → lightest). */
	/** App background, screen fill. */
	ground: '#121116',
	/** Nav bar, cards, sheet/panel backgrounds. */
	surface: '#1c1b22',
	/** Input fields, photo placeholders, link pills, inset wells. */
	raised: '#26242e',

	/* Borders & dividers. */
	/** Borders, nav top divider, inactive chip borders. */
	line: '#34323d',
	/** Inactive icon fills, dashed borders. */
	mutedUi: '#3d3a47',

	/* Text. */
	/** Names, headings, active labels. */
	textPrimary: '#efedf2',
	/** Usernames, secondary info, bio text. */
	textDim: '#a9a4b8',
	/** Nav labels (inactive), hints, tertiary. */
	textFaint: '#8a8898',
	/** Placeholder labels inside raised areas. */
	textGhost: '#3d3a47',

	/* Accent. One primary accent per screen — holo. */
	/** Primary accent — active nav, active chips, primary buttons. */
	holo: '#b9c9ff',
	/** Lighter holo tint when needed. */
	holoSoft: '#dbe3ff',
	/** "New" badges, scan-line end. */
	teal: '#9ff0dc',
	/** Holo gradient start/end. */
	pink: '#ffb3e0',
	/** Holo gradient warm stop. */
	warm: '#ffe7a8',

	/** Scan screen only — slightly darker ground. */
	scanBg: '#0e0d12',

	/* Glows (guide "Shadows & Glows"). */
	/** Soft holo glow around the Scan control and holo CTAs. */
	holoGlow: 'rgba(185,201,255,0.3)',
	/** Teal glow, used sparingly. */
	tealGlow: 'rgba(159,240,220,0.35)',

	/* Semantic status. */
	danger: '#ff5c5c',
	success: '#9ff0dc',

	// ---------------------------------------------------------------------------
	// Legacy "arcade dusk" aliases — deprecated. Prefer the guide roles above.
	// Kept so files not yet migrated keep compiling; each maps to its nearest
	// guide value, so an un-migrated screen still renders on-palette.
	// ---------------------------------------------------------------------------
	/** @deprecated → ground */
	void: '#121116',
	/** @deprecated → ground */
	base: '#121116',
	/** @deprecated → raised */
	raisedHigh: '#26242e',
	/** @deprecated → mutedUi */
	lineStrong: '#3d3a47',
	/** @deprecated → holo */
	rose: '#b9c9ff',
	/** @deprecated → line */
	roseDim: '#34323d',
	/** @deprecated → holoGlow */
	roseGlow: 'rgba(185,201,255,0.3)',
	/** @deprecated → line */
	tealDim: '#34323d',
	/** @deprecated → warm */
	butter: '#ffe7a8',
	/** @deprecated → textPrimary */
	cream: '#efedf2',
	/** @deprecated → textDim */
	creamMute: '#a9a4b8',
	/** @deprecated → textFaint */
	creamFaint: '#8a8898'
} as const;

/**
 * The holo gradient: pink → holo → teal → warm → pink at ≈118°. Reserved for
 * card frames and primary CTAs (and the Scan control) — never as a background
 * for ordinary chrome, or it stops reading as special.
 */
export const HOLO_STOPS = ['#ffb3e0', '#b9c9ff', '#9ff0dc', '#ffe7a8', '#ffb3e0'] as const;

/** The same gradient as a CSS string for `experimental_backgroundImage`. */
export const HOLO_GRADIENT = `linear-gradient(118deg, ${HOLO_STOPS.join(', ')})`;

export type PaletteKey = keyof typeof palette;
