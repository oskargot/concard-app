-- Card spec v2: the fixed 250 × 350 layout (photo height, alignment, eight
-- links with handles, sticker size, the new default sticker spot) and snapshots
-- that freeze all of it.
--
-- THIS FILE DOES NOT BELONG TO THIS REPOSITORY. The shared Supabase schema is
-- owned by the `concard` web repo (see CLAUDE.md) — copy this into its
-- `supabase/migrations/` and apply it there. It lives here only because the app
-- is what needs it, and the app repo is where it was written.
--
-- Written against the live schema as read on 2026-09-23 (constraint and
-- function definitions pulled from the project, not from memory).
--
-- The app already works WITHOUT this migration: it writes photo shapes under
-- their old names, keeps `label` on every link, and saves only six links when
-- the old constraint refuses eight. After this is applied:
--   * flip `WRITE_LEGACY_PHOTO_SHAPES` off in src/card/card-style.ts, and
--   * the "only your first 6 links are saving" note stops appearing on its own.
-- Nothing here rewrites existing style or link values, so the not-yet-ported
-- web card keeps reading every card it can read today.

-- ---------------------------------------------------------------------------
-- 1. Style: new photo-shape names, `alignment`, `photo_height`.
--
-- Both photo-shape spellings stay valid: rows written before the app switches
-- to the new names still say `square` / `round`. `photo_height` is bounded by
-- the design space (112 minimum, 260 is H_max with no links); the per-link-count
-- ceiling is the renderer's job, since links can change without the style.
-- ---------------------------------------------------------------------------
alter table public.cards drop constraint if exists cards_style_shape;

alter table public.cards add constraint cards_style_shape check (
	jsonb_typeof(style) = 'object'
	and coalesce(style ->> 'frame', 'silver') = any (array['silver', 'gold', 'holo', 'ink'])
	and coalesce(style ->> 'bg', 'paper') = any (array[
		'paper', 'mint', 'sky', 'blush', 'butter', 'red', 'orange', 'amber', 'lime', 'green',
		'teal', 'cyan', 'blue', 'indigo', 'violet', 'magenta', 'rose', 'slate'
	])
	and coalesce(style ->> 'shape', 'rounded') = any (array['rect', 'rounded', 'shaved'])
	and coalesce(style ->> 'photo_shape', 'rounded') = any (array[
		'sharp', 'rounded', 'arch', 'circle',
		'square', 'round' -- legacy spellings of sharp / rounded
	])
	and coalesce(style ->> 'alignment', 'left') = any (array['left', 'center', 'right'])
	and coalesce(style ->> 'bio_align', 'left') = any (array['left', 'center', 'right'])
	and (
		not style ? 'photo_height'
		or (
			jsonb_typeof(style -> 'photo_height') = 'number'
			and (style ->> 'photo_height')::numeric between 112 and 260
		)
	)
);

-- ---------------------------------------------------------------------------
-- 2. Links: up to eight, each `{ url, handle, position }`.
--
-- `label` (the pre-spec name for the handle) is accepted in place of `handle`,
-- so rows already written stay valid, and the app keeps writing both until the
-- web card reads `handle`. The icon is derived from the url's domain when drawn
-- and is no longer stored, but an old `icon` key is still tolerated.
-- ---------------------------------------------------------------------------
create or replace function public.card_links_valid(v jsonb) returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $$
	select case
		when v is null then false
		when jsonb_typeof(v) <> 'array' then false
		when jsonb_array_length(v) > 8 then false
		else not exists (
			select 1
			from jsonb_array_elements(v) as e
			where jsonb_typeof(e) <> 'object'
				or jsonb_typeof(e -> 'url') is distinct from 'string'
				or length(e ->> 'url') > 300
				-- a handle, under either name
				or not (
					jsonb_typeof(e -> 'handle') = 'string'
					or jsonb_typeof(e -> 'label') = 'string'
				)
				or (e ? 'handle' and (jsonb_typeof(e -> 'handle') <> 'string' or length(e ->> 'handle') > 40))
				or (e ? 'label' and (jsonb_typeof(e -> 'label') <> 'string' or length(e ->> 'label') > 40))
				or (e ? 'position' and jsonb_typeof(e -> 'position') <> 'number')
				or (e ? 'icon' and jsonb_typeof(e -> 'icon') not in ('string', 'null'))
		)
	end;
$$;

comment on function public.card_links_valid(jsonb) is
	'Shape check for cards.links: an array of at most 8 {url, handle (or legacy label), position?} objects.';

-- ---------------------------------------------------------------------------
-- 3. The default sticker spot: a 64 × 64 square in the bottom-right corner of
-- the content box (x 166–230, y 266–330 of 250 × 350), stored as its centre.
-- Cards still at the old default were never moved, so they follow it.
-- ---------------------------------------------------------------------------
alter table public.cards alter column affiliation_x set default 0.792;
alter table public.cards alter column affiliation_y set default 0.851;

update public.cards
	set affiliation_x = 0.792, affiliation_y = 0.851
	where affiliation_x = 0.853 and affiliation_y = 0.895;

-- ---------------------------------------------------------------------------
-- 4. Sticker size, as a fraction of the card's width, so a sticker is the same
-- size at every render scale. Null on placements that predate it; those keep
-- drawing at the old base size times `scale`.
-- ---------------------------------------------------------------------------
alter table public.sticker_placements
	add column if not exists size numeric;

alter table public.sticker_placements
	drop constraint if exists sticker_placements_size_range;

alter table public.sticker_placements
	add constraint sticker_placements_size_range check (size is null or (size > 0 and size <= 1));

-- ---------------------------------------------------------------------------
-- 5. Snapshots (version 3).
--
-- Spec §8: a collected card must render exactly as it looked at scan time.
-- Version 2 froze `style` whole (so photo_height and alignment already come
-- along) but took the name, bio and links from the *profile* and had no
-- pronouns, so a card that overrode any of them was collected wrong. Version 3
-- resolves them the way the app does — the card's value, else the profile's —
-- and adds sticker size. Everything else is unchanged from the live function.
-- ---------------------------------------------------------------------------
create or replace function public.collect_card(target_username text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_collector uuid := auth.uid();
  v_owner public.profiles%rowtype;
  v_card public.cards%rowtype;
  v_last timestamptz;
  v_snapshot jsonb;
  v_bonus text;
  v_bonus_foil public.sticker_foil;
  v_collection_id uuid;
  v_collected_at timestamptz;
begin
  if v_collector is null then
    raise exception 'not_authenticated' using errcode = '28000', hint = 'Sign in to collect cards.';
  end if;

  select * into v_owner from public.profiles where username = lower(target_username);
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002', hint = 'No one has that username.';
  end if;

  if v_owner.id = v_collector then
    raise exception 'cannot_collect_self' using errcode = 'P0001', hint = 'That is your own card.';
  end if;

  if v_owner.active_card_id is null then
    raise exception 'no_active_card' using errcode = 'P0001', hint = 'They have no card on display yet.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_collector::text || ':' || v_owner.id::text));

  select max(collected_at) into v_last
    from public.collections
   where collector_id = v_collector and owner_id = v_owner.id;

  if v_last is not null and v_last > now() - public.collect_cooldown() then
    raise exception 'cooldown' using errcode = 'P0001',
      detail = (v_last + public.collect_cooldown())::text,
      hint = 'You already collected this card recently.';
  end if;

  select * into v_card from public.cards where id = v_owner.active_card_id;

  v_snapshot := jsonb_build_object(
    'version', 3,
    'card_id', v_card.id,
    'title', coalesce(v_card.display_name, v_owner.display_name),
    'pronouns', coalesce(v_card.pronouns, v_owner.pronouns),
    'bio', coalesce(v_card.bio, v_owner.bio),
    'art_url', v_card.art_url,
    'art_x', v_card.art_x,
    'art_y', v_card.art_y,
    'art_scale', v_card.art_scale,
    'style', coalesce(v_card.style, '{}'::jsonb),
    'affiliation', (
      select jsonb_build_object(
               'id', f.id, 'name', f.name, 'mark', f.mark,
               'color_a', f.color_a, 'color_b', f.color_b,
               'x', v_card.affiliation_x, 'y', v_card.affiliation_y)
        from public.fandoms f
       where f.id = v_card.affiliation),
    'links', case
      when jsonb_array_length(coalesce(v_card.links, '[]'::jsonb)) > 0 then v_card.links
      else coalesce(v_owner.links, '[]'::jsonb)
    end,
    'stickers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'sticker_id', sp.sticker_id,
               'x', sp.x, 'y', sp.y,
               'rotation', sp.rotation, 'scale', sp.scale, 'z_index', sp.z_index,
               'foil', sp.foil, 'size', sp.size)
             order by sp.z_index, sp.created_at)
        from public.sticker_placements sp
       where sp.card_id = v_card.id), '[]'::jsonb),
    'owner', jsonb_build_object(
      'id', v_owner.id,
      'username', v_owner.username,
      'display_name', v_owner.display_name,
      'avatar_url', v_owner.avatar_url)
  );

  select sp.sticker_id, sp.foil into v_bonus, v_bonus_foil
    from public.sticker_placements sp
    join public.stickers s on s.id = sp.sticker_id
   where sp.card_id = v_card.id and s.is_active
   order by random()
   limit 1;

  insert into public.collections (collector_id, owner_id, card_id, card_snapshot, bonus_sticker_id, bonus_foil)
  values (v_collector, v_owner.id, v_card.id, v_snapshot, v_bonus, coalesce(v_bonus_foil, 'none'))
  returning id, collected_at into v_collection_id, v_collected_at;

  if v_bonus is not null then
    insert into public.sticker_inventory (owner_id, sticker_id, foil, quantity)
    values (v_collector, v_bonus, v_bonus_foil, 1)
    on conflict (owner_id, sticker_id, foil)
    do update set quantity = public.sticker_inventory.quantity + 1;
  end if;

  return jsonb_build_object(
    'collection_id', v_collection_id,
    'collected_at', v_collected_at,
    'bonus_sticker_id', v_bonus,
    'bonus_foil', coalesce(v_bonus_foil, 'none'),
    'card_snapshot', v_snapshot
  );
end;
$function$;
