/**
 * The shapes a card reduces to for rendering.
 *
 * Adapted from the web app's `src/lib/types.ts`. The important property is
 * unchanged: a live card and a frozen collection snapshot both reduce to
 * `CardView`, so one renderer draws both and a snapshot can never drift from
 * how it was drawn on the day it was collected.
 *
 * Fields added for the design bible's §6 card: `pronouns` and `label`. The
 * bible's `bio_alignment` and `link_layout` live in `CardStyle` instead — they
 * are style, and putting them there keeps one check constraint in the database
 * rather than two more columns.
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

export interface CardLink {
	label: string;
	url: string;
	/** Icon key or url. Optional — links fall back to a generic mark. */
	icon?: string | null;
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

/** A sticker as positioned on a card face. Positions are 0..1 of the card size. */
export interface PlacedSticker {
	id?: string;
	sticker_id: string;
	x: number;
	y: number;
	rotation: number;
	scale: number;
	z_index: number;
	foil: StickerFoil;
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
}
