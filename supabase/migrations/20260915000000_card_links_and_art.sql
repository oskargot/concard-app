-- Per-card links, and a bucket for card photos.
--
-- THIS FILE DOES NOT BELONG TO THIS REPOSITORY. The shared Supabase schema is
-- owned by the `concard` web repo (see CLAUDE.md) — copy this into its
-- `supabase/migrations/` and apply it there. It lives here only because the app
-- is what needs it, and the app repo is where it was written.
--
-- Until it is applied, `app/card/edit.tsx` still renders and edits links; the
-- writes are what fail, and `cards.links` reads as `[]`.
--
-- Also apply 20260914000000_card_inherit_text.sql (display_name / pronouns / bio)
-- or autosave 204s on `display_name` and never reaches this column.
--
-- Why a column and not the `style` jsonb: `bio_align` and `link_layout` went
-- into `style` because they *are* style. Links are content — they belong beside
-- `bio` and `art_url`, and they need their own size and shape constraints.
--
-- Why per-card rather than `profiles.links`: a Cosplay card and a Business card
-- are the same person pointing at different things. That is the whole reason a
-- user gets more than one card, and sharing one link list across all of them
-- defeats it. `profiles.links` stays as the default a new card starts from.

-- The shape check. A CHECK constraint may not contain a subquery, so the
-- per-element test has to live in an IMMUTABLE function. CASE is used rather
-- than a chain of ANDs because Postgres does not promise left-to-right
-- short-circuiting, and `jsonb_array_elements` throws on a non-array.
create or replace function public.card_links_valid(v jsonb) returns boolean
language sql
immutable
parallel safe
as $$
	select case
		when v is null then false
		when jsonb_typeof(v) <> 'array' then false
		when jsonb_array_length(v) > 6 then false
		else not exists (
			select 1
			from jsonb_array_elements(v) as e
			where jsonb_typeof(e) <> 'object'
				or jsonb_typeof(e -> 'url') <> 'string'
				or jsonb_typeof(e -> 'label') <> 'string'
				or length(e ->> 'url') > 300
				or length(e ->> 'label') > 40
				-- `icon` is optional, but when present it is a string
				or (e ? 'icon' and jsonb_typeof(e -> 'icon') not in ('string', 'null'))
		)
	end;
$$;

comment on function public.card_links_valid(jsonb) is
	'Shape check for cards.links: an array of at most 6 {label, url, icon?} objects.';

alter table public.cards
	add column if not exists links jsonb not null default '[]'::jsonb;

alter table public.cards
	drop constraint if exists cards_links_valid;

alter table public.cards
	add constraint cards_links_valid check (public.card_links_valid(links));

comment on column public.cards.links is
	'Per-card link chips, rendered by CardFace. Seeded from profiles.links when a card is created.';

-- Card photos.
--
-- Public because a card is public by definition: concard.me/<username> renders
-- the same art_url to anyone with the link, so a signed URL would buy nothing
-- and cost the web card a round trip. Writes stay owner-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'card-art',
	'card-art',
	true,
	5242880, -- 5 MB; the app uploads at quality 0.8, well under this
	array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
	set public = excluded.public,
		file_size_limit = excluded.file_size_limit,
		allowed_mime_types = excluded.allowed_mime_types;

-- Objects are keyed `<owner_id>/<card_id>/<timestamp>.<ext>`, so the first path
-- segment is the owner and that is what every policy below checks.
drop policy if exists "card art is readable by anyone" on storage.objects;
create policy "card art is readable by anyone"
	on storage.objects for select
	using (bucket_id = 'card-art');

drop policy if exists "owners upload their own card art" on storage.objects;
create policy "owners upload their own card art"
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'card-art'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

drop policy if exists "owners replace their own card art" on storage.objects;
create policy "owners replace their own card art"
	on storage.objects for update
	to authenticated
	using (
		bucket_id = 'card-art'
		and (storage.foldername(name))[1] = auth.uid()::text
	)
	with check (
		bucket_id = 'card-art'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

drop policy if exists "owners delete their own card art" on storage.objects;
create policy "owners delete their own card art"
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'card-art'
		and (storage.foldername(name))[1] = auth.uid()::text
	);
