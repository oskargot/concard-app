# Sticker schema — security review (Phase 2)

Reviewed 2026-09-23 against the repo's `vibe-security` skill (secrets, database access control,
data access / input validation) — the migrations are
`concard/supabase/migrations/20260924000000…04`. Every rule below is exercised as a real
`authenticated` / `anon` role with RLS on by `supabase/dev/test_stickers.sql`
(`pnpm db:test:stickers`).

## Findings

No critical or high findings.

**Fixed during review**

- **Medium — a BEFORE trigger ran ahead of RLS on someone else's card.** `sticker_placements_check()`
  is `SECURITY DEFINER` and Postgres runs BEFORE triggers before RLS's `WITH CHECK`, so an insert
  aimed at another user's card reached the trigger, which locked that card row (`FOR UPDATE`)
  before the insert was refused. Nothing was written, but anyone could briefly lock anyone's card.
  Now the trigger refuses a card that isn't `auth.uid()`'s (`not_your_card`) before taking the
  lock. Tested.
- **Low — `submit_fandom()` leaked a pending fandom's id.** Its `fandom_exists` error carried the
  existing row's id in `detail`, including someone else's pending submission. Now only an
  approved fandom's id is returned.

**Accepted, logged**

- **Low — who submitted an approved fandom is readable.** `fandoms.submitted_by` is visible to
  everyone on approved rows (the public policy is row-level). Profiles are public anyway, so this
  links a user to a fandom name they suggested. Column privileges would fix it but both clients
  `select('*')` from `fandoms`, which column privileges would break. Option for later: null
  `submitted_by` on approval, or move it to a private table.
- **Low — rejected names can be resubmitted.** The 3-pending cap bounds spam at any moment, and
  every submission waits for Oskar; a banned-names list can come later if it's needed.

## Checklist

| Area                                   | Result                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secrets                                | Service-role key read only by `scripts/stickers/ingest.ts` from git-ignored `.env.local`; never `EXPO_PUBLIC_*`, never committed. `.env` now ignored too.                                                                                                                                                                                              |
| RLS on every table                     | New table `collection_sticker_grants`: RLS on, SELECT only for the collector, INSERT/UPDATE/DELETE revoked from `anon`/`authenticated`; written only by `collect_card()`.                                                                                                                                                                              |
| `USING (true)`                         | Only the existing public catalog reads (`stickers`, approved `fandoms`) — intended. `fandoms` was `true`; now `status = 'approved'`, plus submitters see their own.                                                                                                                                                                                    |
| Sensitive fields on user-writable rows | `cards.affiliation` guarded (approved + active fandoms only). Placements: `card_id`, `sticker_id`, `foil`, `is_affiliation` immutable on update; x / y / scale / size / z bounded by CHECKs; the live UPDATE policy's missing `WITH CHECK` is covered by that immutability trigger. `fandoms.status` has no user write path at all.                    |
| SECURITY DEFINER                       | `submit_fandom`, `collect_card`, `combine_stickers`, `sticker_available_count` validate `auth.uid()` and their inputs; `search_path` pinned (`'public'`, matching the live functions; every reference is schema-qualified). Trigger functions have `EXECUTE` revoked from `public`/`anon`/`authenticated`. `anon` can't call `submit_fandom` (tested). |
| Client trust                           | The sticker grant and its 10% foil roll happen inside `collect_card()`; the RPC still takes only a username. Name length, pending cap, per-card cap, scale and position are all enforced in the DB.                                                                                                                                                    |
| Races                                  | Pending cap under a per-user advisory lock; per-card cap under a row lock on the card; combine under the existing per-pile lock and now counts only spare (unplaced) copies.                                                                                                                                                                           |
| Storage                                | `stickers` bucket: public read by design, `image/webp` only, 1 MB cap, **no** `storage.objects` policies, so only the service role writes. Objects are never overwritten (`upsert: false`).                                                                                                                                                            |
| Deletion                               | Sticker definitions can't be deleted by anyone, service role included (trigger); retiring is `is_active = false`.                                                                                                                                                                                                                                      |

## Client side (Phase 8)

Reviewed the app's and the web's sticker code against the same checklist. No findings.

- **Secrets.** The only privileged key anywhere is the ingest's `SUPABASE_SERVICE_ROLE_KEY`, read
  by `scripts/stickers/ingest.ts` from git-ignored `.env.local`; nothing in `src/` or `app/` can
  reach it. Both clients use the publishable key only. The web's local dev `.env` holds
  placeholders, not a real project, and is git-ignored.
- **Client trust.** Every limit the clients show — spare copies, the 20 cap, the scale clamp, the
  24-character name, the 3-pending cap, combining — is advisory; the database enforces each one
  again (Phase 2). Writes go through RLS-checked `sticker_placements` rows or the
  `combine_stickers()` / `submit_fandom()` / `collect_card()` RPCs, and a refused write snaps the
  editor back to the server's state.
- **Rendering untrusted text.** Fandom names are user-submitted. The app draws them through
  react-native-svg `Text`, the web through Svelte text interpolation inside `<text>` — both escape;
  nothing is injected as markup. Pending names are visible only to their submitter (RLS).
- **URLs.** Sticker art URLs are built from `*_path` columns the schema pins to
  `<id>/<16 hex>-<kind>.webp`, so a row can't point an `<img>` or Skia image elsewhere.
