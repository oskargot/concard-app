-- Security hardening found by a vibe-security audit of the shared project.
--
-- THIS FILE DOES NOT BELONG TO THIS REPOSITORY. The shared Supabase schema is
-- owned by the `concard` web repo (see CLAUDE.md) — copy this into its
-- `supabase/migrations/` and apply it there. It lives here only because the
-- audit that found these issues ran from the app repo. Already applied
-- directly to the shared project so the fixes are live now; this file exists
-- so the `concard` repo's migration history doesn't diverge from what's
-- actually deployed.

-- 1. sticker_available_count() accepted an arbitrary p_owner_id with no check
--    against auth.uid(), so any anon/authenticated caller could read any
--    user's private sticker_inventory counts via
--    POST /rest/v1/rpc/sticker_available_count. Every legitimate caller
--    (sticker_placements_check()'s trigger) already passes the card's own
--    owner, which is always the current session's auth.uid() by the time a
--    placement insert reaches the trigger -- so scoping to the caller is a
--    no-op for real usage and closes the leak for everyone else.
create or replace function public.sticker_available_count(p_owner_id uuid, p_sticker_id text, p_foil sticker_foil default 'none'::sticker_foil)
returns integer
language sql
stable security definer
set search_path to 'public'
as $function$
  select case when auth.uid() = p_owner_id then
    coalesce((select quantity from public.sticker_inventory
                where owner_id = p_owner_id and sticker_id = p_sticker_id and foil = p_foil), 0)
    - (select count(*)::int
         from public.sticker_placements sp
         join public.cards c on c.id = sp.card_id
        where c.owner_id = p_owner_id and sp.sticker_id = p_sticker_id and sp.foil = p_foil)
  else 0 end;
$function$;

revoke execute on function public.sticker_available_count(uuid, text, sticker_foil) from public, anon;

-- 2. These are trigger / event-trigger functions -- Postgres only invokes them
--    inside a trigger context, so the anon/authenticated grants are inert
--    today, but they're needless surface flagged by the security advisor.
revoke execute on function public.cards_autoactivate() from public, anon, authenticated;
revoke execute on function public.grant_starter_stickers() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.sticker_placements_check() from public, anon, authenticated;

-- 3. Pin search_path on the remaining functions that were missing it
--    (all SECURITY INVOKER, so this is defense-in-depth, not a live hole).
alter function public.collect_cooldown() set search_path = '';
alter function public.card_links_valid(jsonb) set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function public.profiles_check_username() set search_path = '';
alter function public.profiles_check_active_card() set search_path = '';

-- 4. Duplicate card-art storage policies (this repo's migration created one
--    set under "owners ..." names; an equivalent set under "users ..."
--    names was applied elsewhere). Keep the set this repo tracks.
drop policy if exists "card art is public" on storage.objects;
drop policy if exists "users upload their own card art" on storage.objects;
drop policy if exists "users replace their own card art" on storage.objects;
drop policy if exists "users delete their own card art" on storage.objects;
