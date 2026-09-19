/**
 * Non-colour design tokens (Concard style guide).
 *
 * Two type families live here, on purpose:
 *
 *  - `font.ui*` is **Outfit**, the app-chrome face the mockups are drawn in. The
 *    chrome type scale (`type.*`) is built on it.
 *  - `font.display` / `font.body*` stay **Fredoka / Space Grotesk**: these are
 *    the *card-face* fonts, ported to match the web card pixel-for-pixel
 *    (`CardFace`, `CardBack`, stickers). Chrome must not borrow them, and the
 *    card face must not borrow Outfit — that is what keeps a collected snapshot
 *    identical to how it looked the day it was collected.
 */

import { palette } from './palette';

/** Border-radius scale (guide "Border Radius Scale"). */
export const radius = {
	/** Card link pills. */
	xs: 5,
	/** Photo/image areas inside a card. */
	sm: 8,
	/** Sticker/Binder grid tiles, mini-card images. */
	md: 12,
	/** Card outer wrapper, sheets. */
	lg: 16,
	/** Scan viewfinder, large action buttons. */
	xl: 20,
	/** Secondary action buttons (Share, Edit Card). */
	xxl: 24,
	/** Icon circle buttons, avatars, chips. */
	pill: 999
} as const;

export const space = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	/** Screen horizontal padding — 24px on every screen. */
	xl: 24,
	xxl: 32
} as const;

export const font = {
	/* Card-face fonts — pixel-synced with the web card. Do not use in chrome. */
	display: 'Fredoka-Bold',
	displaySemi: 'Fredoka-SemiBold',
	body: 'SpaceGrotesk-Regular',
	bodyMedium: 'SpaceGrotesk-Medium',
	bodyBold: 'SpaceGrotesk-Bold',

	/* App-chrome font — Outfit 400 / 600 / 700. */
	ui: 'Outfit-Regular',
	uiSemi: 'Outfit-SemiBold',
	uiBold: 'Outfit-Bold'
} as const;

/**
 * Chrome type scale, in Outfit, sized to the guide. Uppercase roles always ship
 * with letterSpacing — that is what keeps a small label from reading as
 * shrunken body text.
 */
export const type = {
	/** Home hero card name / big page titles. */
	hero: { fontFamily: font.uiBold, fontSize: 28, lineHeight: 34 },
	/** Screen titles (Home, Card, Scan…). */
	title: { fontFamily: font.uiBold, fontSize: 17, lineHeight: 22 },
	/** Sub-headers, instruction lead. */
	subtitle: { fontFamily: font.uiSemi, fontSize: 15, lineHeight: 20 },
	/** Body text, bio, instructions. */
	body: { fontFamily: font.ui, fontSize: 13, lineHeight: 19 },
	/** Emphasised body / secondary button label. */
	bodyStrong: { fontFamily: font.uiSemi, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
	/** Hints, tertiary, count badges. */
	small: { fontFamily: font.ui, fontSize: 12, lineHeight: 17 },
	/** Primary CTA label. */
	cta: { fontFamily: font.uiBold, fontSize: 14, letterSpacing: 0.4 },
	/** Section headers (RECENT), tags, nav — small caps. */
	meta: {
		fontFamily: font.uiSemi,
		fontSize: 11,
		lineHeight: 14,
		letterSpacing: 0.7,
		textTransform: 'uppercase' as const
	}
} as const;

/**
 * Shadows & glows (guide "Shadows & Glows"). `boxShadow` is real in React Native
 * core now, so these are true outer shadows rather than the translucent-border
 * trick.
 */
export const shadow = {
	/** Hero card: a deep drop plus a faint holo bloom. */
	hero: `0 20px 44px rgba(23,22,27,0.75), 0 0 32px rgba(185,201,255,0.12)`,
	/** Binder / grid card. */
	grid: `0 8px 20px rgba(23,22,27,0.5)`,
	/** Scan control at rest. */
	scan: `0 4px 18px ${palette.holoGlow}`,
	/** Scan control while the Scan screen is active. */
	scanActive: `0 4px 20px rgba(185,201,255,0.4)`,
	/** Holo gradient CTA button. */
	cta: `0 4px 24px rgba(185,201,255,0.25)`
} as const;

/** Cards are 5:7, the same ratio the web card uses, so snapshots stay portable. */
export const CARD_ASPECT = 5 / 7;

/**
 * The web card sizes everything in `cqw` (1% of its own width). React Native has
 * no container queries, so a card measures itself once and multiplies every
 * dimension by this. `cqw(width)(n)` is the direct equivalent of `n cqw`.
 */
export const cqw = (cardWidth: number) => (n: number) => (cardWidth * n) / 100;
