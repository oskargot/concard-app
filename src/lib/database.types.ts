// Hand-maintained mirror of the `concard` repo's supabase/migrations, which is
// where the schema lives — both this app and the web app share one Supabase
// project. Keep it in step with `concard/src/lib/supabase/types.ts`; regenerate
// both with the Supabase CLI once the project is linked:
//   supabase gen types typescript --linked

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type StickerRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type StickerSource = 'starter' | 'drop' | 'shop' | 'event';
export type StickerFoil = 'none' | 'glitter' | 'holo' | 'cosmic' | 'mosaic';
export type StickerKind = 'deco' | 'fandom';
export type FandomStatus = 'pending' | 'approved' | 'rejected';

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					username: string;
					display_name: string;
					bio: string;
					pronouns: string | null;
					avatar_url: string | null;
					links: Json;
					active_card_id: string | null;
					is_admin: boolean;
					notifications_on_collect: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id: string;
					username: string;
					display_name: string;
					bio?: string;
					pronouns?: string | null;
					avatar_url?: string | null;
					links?: Json;
					active_card_id?: string | null;
					notifications_on_collect?: boolean;
				};
				Update: {
					username?: string;
					display_name?: string;
					bio?: string;
					pronouns?: string | null;
					avatar_url?: string | null;
					links?: Json;
					active_card_id?: string | null;
					notifications_on_collect?: boolean;
				};
				Relationships: [];
			};
			fandoms: {
				Row: {
					id: string;
					name: string;
					mark: string;
					color_a: string;
					color_b: string;
					sort_order: number;
					is_active: boolean;
					/** Only `approved` rows are visible to others or usable. See 20260924000002. */
					status: FandomStatus;
					submitted_by: string | null;
					/** The generative renderer's look (FandomStyleCategory). */
					style_category: string;
					created_at: string;
					reviewed_at: string | null;
				};
				Insert: never;
				Update: never;
				Relationships: [];
			};
			cards: {
				Row: {
					id: string;
					owner_id: string;
					/** Null means "use the profile's value". See 20260914000000. */
					display_name: string | null;
					pronouns: string | null;
					bio: string | null;
					/** The user's own name for this card in the switcher. */
					label: string | null;
					art_url: string | null;
					art_x: number;
					art_y: number;
					art_scale: number;
					style: Json;
					/** Per-card link chips. See 20260915000000. */
					links: Json;
					affiliation: string | null;
					affiliation_x: number;
					affiliation_y: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					owner_id: string;
					display_name?: string | null;
					pronouns?: string | null;
					bio?: string | null;
					label?: string | null;
					art_url?: string | null;
					art_x?: number;
					art_y?: number;
					art_scale?: number;
					style?: Json;
					links?: Json;
					affiliation?: string | null;
					affiliation_x?: number;
					affiliation_y?: number;
				};
				Update: {
					display_name?: string | null;
					pronouns?: string | null;
					bio?: string | null;
					label?: string | null;
					art_url?: string | null;
					art_x?: number;
					art_y?: number;
					art_scale?: number;
					style?: Json;
					links?: Json;
					affiliation?: string | null;
					affiliation_x?: number;
					affiliation_y?: number;
				};
				Relationships: [];
			};
			stickers: {
				Row: {
					id: string;
					name: string;
					glyph: string | null;
					image_url: string | null;
					rarity: StickerRarity;
					source: StickerSource;
					price_cents: number | null;
					sort_order: number;
					is_active: boolean;
					kind: StickerKind;
					/** Object paths in the public `stickers` bucket; deco only. See 20260924000001. */
					full_path: string | null;
					mask_path: string | null;
					thumb_path: string | null;
					art_aspect: number | null;
					fandom_id: string | null;
				};
				Insert: {
					id: string;
					name: string;
					glyph?: string | null;
					image_url?: string | null;
					rarity?: StickerRarity;
					source?: StickerSource;
					price_cents?: number | null;
					sort_order?: number;
					is_active?: boolean;
					kind?: StickerKind;
					full_path?: string | null;
					mask_path?: string | null;
					thumb_path?: string | null;
					art_aspect?: number | null;
					fandom_id?: string | null;
				};
				Update: {
					name?: string;
					glyph?: string | null;
					image_url?: string | null;
					rarity?: StickerRarity;
					source?: StickerSource;
					price_cents?: number | null;
					sort_order?: number;
					is_active?: boolean;
					kind?: StickerKind;
					full_path?: string | null;
					mask_path?: string | null;
					thumb_path?: string | null;
					art_aspect?: number | null;
					fandom_id?: string | null;
				};
				Relationships: [];
			};
			sticker_inventory: {
				Row: {
					owner_id: string;
					sticker_id: string;
					foil: StickerFoil;
					quantity: number;
					updated_at: string;
				};
				Insert: never;
				Update: never;
				Relationships: [];
			};
			sticker_placements: {
				Row: {
					id: string;
					card_id: string;
					sticker_id: string;
					x: number;
					y: number;
					rotation: number;
					scale: number;
					z_index: number;
					foil: StickerFoil;
					created_at: string;
					/** Base width as a fraction of card width; null = the old 15.33% base. */
					size: number | null;
					/** The card's free fandom affiliation. See 20260924000003. */
					is_affiliation: boolean;
				};
				Insert: {
					id?: string;
					card_id: string;
					sticker_id: string;
					x: number;
					y: number;
					rotation?: number;
					scale?: number;
					z_index?: number;
					foil?: StickerFoil;
					size?: number | null;
					is_affiliation?: boolean;
				};
				Update: {
					x?: number;
					y?: number;
					rotation?: number;
					scale?: number;
					z_index?: number;
					size?: number | null;
				};
				Relationships: [];
			};
			collection_sticker_grants: {
				Row: {
					collection_id: string;
					kind: StickerKind;
					sticker_id: string;
					foil: StickerFoil;
				};
				Insert: never;
				Update: never;
				Relationships: [];
			};
			collections: {
				Row: {
					id: string;
					collector_id: string;
					owner_id: string;
					card_id: string | null;
					card_snapshot: Json;
					bonus_sticker_id: string | null;
					bonus_foil: StickerFoil;
					event_id: string | null;
					collected_at: string;
				};
				Insert: never;
				Update: never;
				Relationships: [];
			};
			reserved_usernames: {
				Row: { username: string };
				Insert: never;
				Update: never;
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: {
			collect_card: {
				Args: { target_username: string };
				Returns: Json;
			};
			is_username_available: {
				Args: { candidate: string };
				Returns: boolean;
			};
			cards_per_user_cap: {
				Args: Record<string, never>;
				Returns: number;
			};
			sticker_available_count: {
				Args: { p_owner_id: string; p_sticker_id: string; p_foil?: StickerFoil };
				Returns: number;
			};
			combine_stickers: {
				Args: { p_sticker_id: string; p_foil?: StickerFoil };
				Returns: Json;
			};
			submit_fandom: {
				Args: { p_name: string; p_style_category?: string };
				Returns: Json;
			};
			sticker_foil_next: {
				Args: { p_foil: StickerFoil };
				Returns: StickerFoil | null;
			};
			max_stickers_per_card: {
				Args: Record<string, never>;
				Returns: number;
			};
			sticker_copy_foil_chance: {
				Args: Record<string, never>;
				Returns: number;
			};
		};
		Enums: {
			sticker_rarity: StickerRarity;
			sticker_source: StickerSource;
			sticker_foil: StickerFoil;
			sticker_kind: StickerKind;
			fandom_status: FandomStatus;
		};
		CompositeTypes: Record<string, never>;
	};
}

export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row'];
