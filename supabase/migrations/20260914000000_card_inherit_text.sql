-- Inherit text on cards: null means "use the profile's value".
--
-- The editor writes cards.display_name / pronouns / bio. Until these columns
-- exist, PostgREST 204s ("Could not find the 'display_name' column of 'cards'
-- in the schema cache") and every autosave fails — including style and links.
--
-- Copy into the `concard` web repo's supabase/migrations and apply there, or
-- run this in the Supabase SQL editor on the shared project.

alter table public.cards
	add column if not exists display_name text;

alter table public.cards
	add column if not exists pronouns text;

alter table public.cards
	add column if not exists bio text;

comment on column public.cards.display_name is
	'Override for profiles.display_name. Null inherits the profile.';
comment on column public.cards.pronouns is
	'Override for profiles.pronouns. Null inherits the profile.';
comment on column public.cards.bio is
	'Override for profiles.bio. Null inherits the profile.';
