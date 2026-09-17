/**
 * Non-colour design tokens (design bible §12 "UI treatment"):
 * medium rounded corners, subtle glow on interactive elements, and a type
 * system where Fredoka carries display and Space Grotesk carries body.
 */

import { palette } from './palette';

/** Medium rounded — "not baby-round, not sharp". */
export const radius = {
	sm: 5,
	md: 12,
	lg: 16,
	xl: 22,
	pill: 999
} as const;

export const space = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32
} as const;

export const font = {
	display: 'Fredoka-Bold',
	displaySemi: 'Fredoka-SemiBold',
	body: 'SpaceGrotesk-Regular',
	bodyMedium: 'SpaceGrotesk-Medium',
	bodyBold: 'SpaceGrotesk-Bold'
} as const;

/** App chrome type. Kept separate so CardFace/CardBack retain web parity. */
export const uiFont = {
	regular: 'Outfit-Regular',
	semibold: 'Outfit-SemiBold',
	bold: 'Outfit-Bold'
} as const;

/**
 * Outfit app-chrome type scale. `meta` always ships with letter spacing, which
 * keeps uppercase labels from reading as shrunken body text.
 */
export const type = {
	hero: { fontFamily: uiFont.bold, fontSize: 28, lineHeight: 34 },
	title: { fontFamily: uiFont.bold, fontSize: 17, lineHeight: 22 },
	subtitle: { fontFamily: uiFont.semibold, fontSize: 13, lineHeight: 18 },
	body: { fontFamily: uiFont.regular, fontSize: 12, lineHeight: 18 },
	bodyStrong: { fontFamily: uiFont.semibold, fontSize: 13, lineHeight: 19 },
	small: { fontFamily: uiFont.regular, fontSize: 12, lineHeight: 17 },
	meta: {
		fontFamily: uiFont.semibold,
		fontSize: 11,
		lineHeight: 15,
		letterSpacing: 0.8,
		textTransform: 'uppercase' as const
	}
} as const;

/**
 * Subtle glow states on interactive elements — "not flat, not skeuomorphic".
 * `boxShadow` landed in React Native core, so this is a real outer glow rather
 * than the stacked-translucent-border trick.
 */
export const glow = {
	rose: { boxShadow: `0 0 18px ${palette.roseGlow}` },
	teal: { boxShadow: `0 0 18px ${palette.tealGlow}` },
	none: { boxShadow: undefined }
} as const;

/** Cards are 5:7, the same ratio the web card uses, so snapshots stay portable. */
export const CARD_ASPECT = 5 / 7;

/**
 * The web card sizes everything in `cqw` (1% of its own width). React Native has
 * no container queries, so a card measures itself once and multiplies every
 * dimension by this. `cqw(width)(n)` is the direct equivalent of `n cqw`.
 */
export const cqw = (cardWidth: number) => (n: number) => (cardWidth * n) / 100;
