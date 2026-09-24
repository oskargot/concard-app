/**
 * The shapes a card reduces to for rendering.
 *
 * Adapted from the web app's `src/lib/types.ts`. The important property is
 * unchanged: a live card and a frozen collection snapshot both reduce to
 * `CardView`, so one renderer draws both and a snapshot can never drift from
 * how it was drawn on the day it was collected.
 *
 * Fields added for the design bible's §6 card: `pronouns` and `label`. The
 * card spec's `alignment` and `photo_height` live in `CardStyle` instead — they
 * are style, and the style jsonb is frozen into snapshots whole. The spec's
 * photo focal point and zoom are `art_x` / `art_y` / `art_scale`.
 */

import type { FandomStyleCategory } from '../stickers/types';
import type { CardStyle } from './card-style';
import type { StickerFoil } from './tiers';

/**
 * Design bible §6: 140 characters, "keep it card-sized".
 *
 * The `cards.bio` column allows 200 so a value written by the web app is always
 * valid; the app enforces the bible wherever a bio is composed. Every editor
 * reads it from here rather than declaring its own, or the onboarding card and
 * the card editor would drift apart.
 */
export const BIO_MAX = 140;

/**
 * A link pill (card spec §3.5, §8). Its position is its index in
 * `CardView.links`; its icon is derived from the url's domain when drawn.
 */
export interface CardLink {
	url: string;
	/** Shown on the pill. Pre-filled from the url, then the user's to edit. */
	handle: string;
}

/**
 * The fandom affiliation as rendered on a card; frozen into snapshots.
 *
 * Enough to redraw the generative sticker forever without a live fandoms
 * lookup — name + style category are the art, foil/placement are the copy.
 * Still stored on the card as `affiliation` id + x/y until a later stage
 * migrates it into sticker placements.
 */
export interface Affiliation {
	id: string;
	name: string;
	style_category: FandomStyleCategory;
	/** Placed on the face like a sticker: 0..1 of the card, centre of the sticker. */
	x: number;
	y: number;
	rotation: number;
	scale: number;
	foil: StickerFoil;
}

/**
 * A sticker as positioned on a card face. `x` / `y` are its centre as 0..1 of
 * the card; `scale` is 0.5–2 of its base size.
 *
 * Besides the placement it carries, optionally, what the sticker *is* — the
 * fields a v4 collection snapshot freezes (and a live placements query joins
 * in) so it can be drawn forever with no lookup: `kind`, and for deco the
 * immutable asset paths in the `stickers` bucket, for fandom the label and
 * style category. `src/stickers/definitions.ts` turns these into something
 * drawable, falling back to bundled fixtures and then to a glyph.
 */
export interface PlacedSticker {
	id?: string;
	sticker_id: string;
	x: number;
	y: number;
	rotation: number;
	scale: number;
	z_index: number;
	foil: StickerFoil;
	/** Base width as a fraction of the card's width (the long edge, for
	 *  deco art). Absent on placements that predate it; those draw at the old
	 *  15.33% base times `scale`. New placements write STICKER_BASE_WIDTH. */
	size?: number | null;
	/** The card's free fandom affiliation, as a placement. */
	is_affiliation?: boolean;

	kind?: 'deco' | 'fandom';
	name?: string;
	full_path?: string | null;
	mask_path?: string | null;
	thumb_path?: string | null;
	/** Width / height of the baked deco art (full and mask share a canvas). */
	art_aspect?: number | null;
	/** Legacy emoji glyph, for prototype stickers with no baked art. */
	glyph?: string | null;
	fandom_id?: string | null;
	label?: string;
	style_category?: FandomStyleCategory;
}

/** Everything needed to draw a card front. */
export interface CardView {
	/** Display name on the card. */
	title: string;
	/** Owner's username, shown as @handle. Per user, not per card. */
	handle: string;
	/** Optional, design bible §6. */
	pronouns?: string | null;
	bio: string;
	/** The user's own name for this card — "Cosplay", "Business". Not shown on
	 *  the face; it labels the card in the switcher. */
	label?: string | null;
	art_url: string | null;
	/** Where the photo is panned to, 0..1 of the image, and how far it is zoomed (>=1). */
	art_x: number;
	art_y: number;
	art_scale: number;
	style: CardStyle;
	affiliation: Affiliation | null;
	links: CardLink[];
	stickers: PlacedSticker[];
}

/**
 * A collected card as it sits in a binder.
 *
 * `tier` and `meeting_count` are per card, per collector (design bible §7), and
 * `revealed` is false until the collector has played the reveal animation — a
 * card scanned offline lands unrevealed and waits for sync.
 */
export interface CollectedCard {
	id: string;
	view: CardView;
	tier: number;
	meeting_count: number;
	revealed: boolean;
	first_scanned_at: string;
	last_scanned_at: string;
	/** Null once the owner deletes the card; the snapshot survives (§7). */
	card_id: string | null;
	/** The person's profile id — how repeat meetings of the same person are
	 *  merged, since `card_id` changes if they switch their active card. Null
	 *  for an offline placeholder that hasn't synced yet. */
	owner_id: string | null;
	/** True for an optimistic entry queued offline that hasn't reached
	 *  Supabase yet — the binder shows it but flags it as unconfirmed. */
	pending?: boolean;
	/** What the latest collect of this card gave you: up to one deco and one
	 *  fandom sticker, each carrying enough to draw it. */
	granted?: PlacedSticker[];
}
