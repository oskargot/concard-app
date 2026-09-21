# Concard-app Repo Audit

**Scope note (read before the findings):** this audit could not access two of its own reference
sources. `concard-design-bible.md` is not present in this repository and was not reachable from this
environment, so every "design bible §N" claim recorded below is *what the code says the bible says*,
not something checked against the bible's actual text — record accordingly. Likewise, the `concard`
web repo (which owns the live Supabase schema and migrations) was out of this session's repo scope,
so `src/lib/database.types.ts` (a "hand-maintained mirror," per its own header) could not be checked
against the real, deployed DDL — only against the three migration files this repo happens to carry
and against how the app code actually calls the client. Where a finding depends on either gap, it
says so.

## Verdict

**This is a cleanup, not a rebuild.** The core data model — a `cards` row reduced to one `CardView`
shape, a `collections` row holding a frozen `card_snapshot` that a collector's binder reads directly
and never joins live — is implemented consistently everywhere except one screen. Three confirmed
"Wrong" claims are stale documentation (a leftover Skia/dev-build warning, a font claim, an
undocumented third foil engine) that mislead a reader but don't affect runtime behavior. Two more are
small, mechanical bugs (a tilt-range constant duplicated out of sync, a "the editor tells you" UI path
that never fires). None of these require touching the data model.

The one finding that does touch the core data model is real and worth prioritizing before anything
else: **`app/(tabs)/card.tsx` (the "My Card" tab) does not use the app's own single row→`CardView`
conversion.** It hand-builds a second, competing version of the same object, and that second version
disagrees with the canonical one on three separate fields — per-card links, stickers, and the fandom
affiliation badge. This is a contained, well-understood bug (one file, one screen, one fix: route it
through the existing `Card`/`cardViewFrom`/`useCard` pipeline like every other screen already does),
not evidence of a split architecture. Every other consumer (`app/card/edit.tsx`, `app/dev/cards.tsx`,
and the binder/scan/home screens for *other people's* cards) already goes through the shared pipeline
correctly.

Counts: **6 Wrong**, **3 Contradicts** (all three touching the core data model — cards/links/stickers
— not just presentation, but all three rooted in the single file above), **3 Unclear** (all three are
"I don't have the reference material to check this," not "the code is ambiguous").

---

## Wrong

| Finding | File:line | What it claims | What's true | Pile |
| --- | --- | --- | --- | --- |
| Skia requires a dev build | `README.md:14-15`, `README.md:84-91`, `CLAUDE.md:95-96`, `ARCHITECTURE.md:78-79` | "`@shopify/react-native-skia` is not available in Expo Go... shader-based foils would mean a development build" / "no custom native module requires a dev build yet — see 'Why no Skia'" | Expo's own docs list `@shopify/react-native-skia` as bundled in Expo Go since **SDK 46** (mid-2022); it has shipped in every Expo Go build since. The claim was true once, a long time before this app's SDK 57. Note: the actual defensive-code artifacts the task brief describes (`app/dev/skia-smoke.tsx`, `SkiaBoundary`, the lazy `require`, the `DEV CLIENT · SKIA` eyebrow string) are **not present in this repo** — no file or symbol matching them exists anywhere in the tree or git history under that name. Either they were already removed in an earlier pass, or they never existed in this checkout. The prose claim itself survives in three docs regardless. | Wrong |
| Space Grotesk is a settled typeface | Pervasive. Primary: `CLAUDE.md:141`, `README.md:109`, `ARCHITECTURE.md:27`, `src/theme/tokens.ts:49-51`, `app/_layout.tsx:29-31`, `src/stickers/font-metrics.ts:283,413,546-547`. Consuming call sites: `app/dev/stickers.tsx:285,305`, `app/dev/foil-sampler.tsx:119`, `app/dev/foil-lab.tsx:375`, `app/card/edit.tsx:276`, `app/(auth)/first-card.tsx:295` | CLAUDE.md states flatly: "The card face keeps its own fonts (`font.display` = Fredoka, `font.body*` = Space Grotesk)... a rendered card stays pixel-identical to the web card." Treated throughout as a shipped, load-bearing decision. | Per the audit brief's own seed finding (which this session could not independently verify against the bible — see scope note above): Space Grotesk was retired with the arcade direction, and design bible §14 lists display/body typefaces as an **open question**, not a decision. Unlike the Skia claim, this isn't one stale comment — the typeface is wired into font loading (`app/_layout.tsx`), the theme token module (`src/theme/tokens.ts`), a 260-line hand-maintained metrics table (`font-metrics.ts`), and half a dozen inline styles. If the bible really leaves this open, the app has quietly foreclosed it everywhere at once. | Wrong |
| Foil "tilt range matches FlipCard" | `src/card/foil/Foil.tsx:136`, `src/card/foil/FoilV2.tsx:20`, `src/card/foil/FoilPokemon.tsx:48` — each: `const TILT_RANGE = 16;` with a comment claiming it matches `FlipCard`'s clamp | All three foil engines hardcode a local `TILT_RANGE = 16` and comment it as matching `FlipCard`'s tilt clamp, then divide/interpolate the shared `rx`/`ry` values against that 16. | `FlipCard.tsx:45` defines the actual constant: `export const TILT_RANGE = 10;`, and the pan gesture (`FlipCard.tsx:133-134`) clamps `rx`/`ry` to ±10, never ±16. `src/card/CardShell.tsx:19,119-120` gets this right — it imports the real constant from `FlipCard` and uses it. The three foil files do not import it; they redeclare a different number and assert it matches. Effect: the light/glare/parallax in all three foil engines never reaches the visual extreme the code was tuned for — at max real-world tilt (±10°) they're driven to only 10/16 (62.5%) of their intended amplitude. | Wrong |
| "The editor detects the missing column... and says so" | `src/card/use-card-editor.ts:137,214-229,344`; claim repeated in `ARCHITECTURE.md:213-214` and implied by `CLAUDE.md`'s pending-migration note | The editor's `linksBlocked` flag is documented (interface comment at `use-card-editor.ts:116`) and exposed to the UI (`app/card/edit.tsx:218`) as the signal that tells the user their links won't save because `cards.links` doesn't exist yet on the live project. | `linksBlocked` is initialized `false` (line 137) and **never set to `true` anywhere in the file.** `save()` (lines 214-229) does detect a missing `links` column via `missingCardColumn()` and adds it to `missingCardColumns.current` — but that's a `useRef` used only to silently drop the field and retry the write; nothing in that path calls `setLinksBlocked(true)`. The UI branch at `edit.tsx:218` is therefore dead: on a project missing the migration, links silently fail to persist with no user-facing warning, contradicting the documented behavior. | Wrong |
| CLAUDE.md's foil-system writeup omits an entire engine | `CLAUDE.md:69-93` (the foil-system section) | Describes exactly two foil engines: the production layer stack (`Foil.tsx`) and an "experimental shine+glare engine... toggled via `engine=\"v2\"`" (`FoilV2.tsx`/`recipes.tsx`). | A third engine, `pokemon` (`src/card/foil/FoilPokemon.tsx`, `pokemon-recipes.tsx`, selected via `engine="pokemon"` in `Foil.tsx:212-225`), exists in the code and is wired into `/dev/foil-lab` (see git history: "Add a pokemon-cards-css-faithful foil engine to the foil lab"). CLAUDE.md's module-level writeup was not updated when it was added. | Wrong |
| "[Tier thresholds] live in exactly one place" | `src/card/tiers.ts:27-28` | The comment above `CARD_TIERS` says the bible calls the thresholds tunable, "so they live in exactly one place." | `app/(tabs)/binder.tsx:243` hardcodes the same value as a raw literal: `(selected.meeting_count / 8) * 100` for the progress-bar fill, instead of deriving it from `tiers.ts` (e.g. `CARD_TIERS[CARD_TIERS.length - 1].meetings`, which is `8`). If a threshold in `tiers.ts` is retuned, this progress bar silently goes stale — exactly the drift the comment claims can't happen. | Wrong |

## Contradicts

All three entries below are different symptoms of one root cause: `app/(tabs)/card.tsx` — the "My
Card" tab, the main screen showing a user's own live card — does not use the app's documented,
single row→`CardView` conversion. It fetches the `cards` row itself and hand-assembles an
`EditableCard`, bypassing `cardViewFrom` and the `Card`/`CardOverlay` component pair that every other
screen touching a card (the editor, `/dev/cards`) uses.

| Finding | File:line | What it claims | What's true | Pile |
| --- | --- | --- | --- | --- |
| Two disagreeing row→CardView conversions | Canonical: `src/card/card-view.ts:57-75` (`cardViewFrom`), used by `src/card/use-card.ts` and `src/card/use-card-editor.ts`. Competing: `app/(tabs)/card.tsx:35-63` | `src/card/use-card.ts:6-7`: "Both [My Card and the editor] funnel through `cardViewFrom`, so the card My Card shows and the card the editor edits can never disagree about what the row means." `CLAUDE.md:122-123` states the same about `cardViewFrom` generally: "the single row→`CardView` conversion... so a card can't render differently depending on which screen loaded it." | `app/(tabs)/card.tsx` never imports `cardViewFrom` or `useCard`. Its own `useEffect` (lines 35-63) queries `cards` and `sticker_placements` directly and builds the `EditableCard` object by hand. It disagrees with `cardViewFrom` in three concrete ways, each below. | Contradicts |
| Per-card links vs. profile links | `src/card/card-view.ts:70` (`links: normalizeLinks(card.links)`) and `src/card/use-card-editor.ts:72-74` (draft prefers `card.links`, falls back to `profile.links` only when the card's own value is null) — vs. `app/(tabs)/card.tsx:59` (`links: Array.isArray(profile.links) ? ... : []`) | The editor (and the canonical conversion) model: a card's `links` column is the per-card content; `profiles.links` is only the seed a new card starts from (explicitly stated in `supabase/migrations/20260915000000_card_links_and_art.sql:18-21`: "profiles.links stays as the default a new card starts from"). | `app/(tabs)/card.tsx:59` reads `profile.links` unconditionally and never reads `card.links` (the fetched `row` from `cards` is otherwise fully used — display_name, pronouns, bio, art_*, style — just not `links`). It also skips `normalizeLinks`, casting directly instead. Net effect: a link list set per-card in the editor is correctly saved to `cards.links` and correctly shown while still in the editor, but the My Card tab — the screen a user actually looks at afterward — shows their *profile*-level links instead, silently ignoring the per-card override the editor just wrote. | Contradicts |
| Stickers and the fandom affiliation badge render on some screens, not others, with no visible logic tying that to the data | Canonical composition: `src/card/Card.tsx:47-64` (always renders `CardOverlay`, which draws both `PlacedSticker[]` **and** `Affiliation`) — used only by `app/card/edit.tsx:17,183` and `app/dev/cards.tsx:14`. Every tab screen (`app/(tabs)/index.tsx:21`, `app/(tabs)/card.tsx:11,73`, `app/(tabs)/scan.tsx:10`, `app/(tabs)/binder.tsx:17`) imports `StickerLayer` directly instead and never imports `CardOverlay` or `Card`. | `src/card/CardOverlay.tsx:1-8`: "Everything that sits outside the face clip: the fandom affiliation and stickers... Affiliation art goes through `StickerRenderer`." Implies any full card render includes both. `src/card/editor/AffiliationRow.tsx` lets a user set an affiliation, and it is visible while editing (through `Card`/`CardOverlay`). | On `binder.tsx` this substitution is *documented and intentional* — collected-card snapshots never carry affiliation data (`snapshotToView` in `src/store/sync.ts:44` hardcodes `affiliation: null`, with a comment explaining why), so there's nothing for `CardOverlay` to draw there anyway. But on `app/(tabs)/card.tsx` (My Card) and `app/(tabs)/index.tsx` (Home) — both showing the *signed-in user's own* card, which does have real `affiliation`/`affiliation_x`/`affiliation_y` columns — the same substitution is undocumented, and on `card.tsx` specifically the live-fetch object (lines 47-61) doesn't even include an `affiliation` field, so `updateActiveCard`'s `Partial` patch leaves whatever affiliation was already in the persisted zustand state (the `STARTER_CARD` default, `null`). Net effect: setting a fandom affiliation in the editor is invisible everywhere except the editor's own preview. | Contradicts |

## Unclear

| Finding | File:line | What it claims | What's true | Pile |
| --- | --- | --- | --- | --- |
| Sticker economy schema may not reflect the live database | `src/lib/database.types.ts:125-256` (`stickers`, `sticker_inventory`, `sticker_placements`, `combine_stickers`, `sticker_available_count`, `collections.bonus_sticker_id`/`bonus_foil`) vs. this repo's own migrations (`supabase/migrations/*.sql`, which never define any of those objects — `20260918184415_security_hardening_...sql` only *alters* functions like `grant_starter_stickers()` and `sticker_placements_check()` that must already exist elsewhere) | `database.types.ts:1-5` says it's "a hand-maintained mirror of the `concard` repo's supabase/migrations," to be regenerated with the Supabase CLI once linked. | Whether this rich, per-user sticker-inventory-plus-combine model is what's actually deployed, or an ahead-of-schema aspiration hand-typed into the mirror, can't be settled from this repo — the DDL lives in the `concard` web repo, out of this session's scope. What's independently verifiable: the app itself implements none of it. `src/stickers/catalog.ts` is a flat, hardcoded 8-item array with a fixed `unlocked: true/false` per item (not per-user state — see `app/(tabs)/stickers.tsx:31`, `owned = STICKER_CATALOG.filter(item => item.unlocked).length`, which is the same count for every user), no read of `sticker_inventory`, and no call to `combine_stickers` or `sticker_available_count` anywhere in `src/` or `app/`. `useConcardStore.ts`'s `addSticker`/`updateSticker`/`removeSticker` actions (lines 238-275) are never called from any screen. Would be settled by comparing against the `concard` repo's actual migrations. | Unclear |
| Two `StickerDefinition` types, same name, different shapes | `src/stickers/catalog.ts:10-17` vs. `src/stickers/types.ts:39-51` | `catalog.ts:3-11`'s own header acknowledges both exist: "The prototype glyph catalog in `catalog.ts` is a separate, older shape and stays in place until a later stage replaces it... do not import this `StickerDefinition` from new sticker rendering code." | Can't tell from the code alone whether this is a deliberately staged migration (as the comment claims) that's on track, or a migration that stalled — `app/(tabs)/stickers.tsx` (the one screen a user sees for stickers) still runs entirely on the old `catalog.ts` shape, and nothing in the repo imports the new `types.ts` shape from a *user-facing* screen (only `CardOverlay`'s affiliation path and the dev stickers screen touch it). Would be settled by knowing whether `app/(tabs)/stickers.tsx` is scheduled for a rewrite. | Unclear |
| Design-bible section citations throughout the code | Scattered — e.g. `src/card/types.ts:9,20`, `src/card/tiers.ts:7`, `src/auth/AuthProvider.tsx:5`, `src/store/sync.ts:215`, `CLAUDE.md` and `README.md` decision tables | Dozens of comments cite specific bible sections (§4, §6, §7, §10, §14) as justification for specific values (140-char bio cap, 2/4/8 tier thresholds, forced-first-card gating, per-person not per-card rate limiting, etc.). | None of these could be checked against the bible's actual text in this session (see scope note at the top) — only against each other and against the code's own behavior, which they're internally consistent with. Would be settled by running this same audit with `concard-design-bible.md` available. | Unclear |

---

## The eight contradiction-hunt questions

**1. Snapshots.** Yes — confirmed, and correctly implemented. `collections.card_snapshot` (`Json`,
`database.types.ts:211`) is read directly by `src/store/sync.ts`'s `snapshotToView` (both on a fresh
collect, `sync.ts:166`, and on every subsequent binder load, `sync.ts:246`) and never re-joined
against a live `cards`/`profiles` row. The payload carries `title`, `bio`, `pronouns`, `art_*`,
`style`, `links`, and `stickers` at the top level (`sync.ts:26-49`), plus an `owner` sub-object for
`id`/`username`/`display_name`. Two fields are deliberately *not* trusted from the snapshot even
though it may carry them: `affiliation` is always forced to `null` on a collected card (documented
gap — the snapshot's fandom shape doesn't match the app's generative one), and `tier`/`meeting_count`
are computed client-side from a `collections` row count rather than read from any snapshot field,
since the schema has no running total (`sync.ts:98-108`, `224-260`). No code path was found reading
*live* card data for an already-collected card.

**2. Stickers.** The bible is silent on this per the task brief; the code has nonetheless committed to
two different, disagreeing models — a rich one in the (unverified) schema and a thin one in the app
— see the Unclear and Contradicts entries above. Summary: the schema types describe stickers coming
from a catalog (`stickers` table), owned per-user in quantity (`sticker_inventory`, keyed by
sticker+foil), placed per-card via a dedicated table (`sticker_placements`, with x/y/rotation/scale/
z_index/foil), unlockable via meeting people (`grant_starter_stickers()`, `bonus_sticker_id` on a
`collections` row), and upgradable in foil tier by combining two copies (`combine_stickers`,
`sticker_available_count`) — matching the "two copies at one tier combine into the next" language in
`src/card/tiers.ts:9`. The app implements none of the inventory/combine/bonus parts: its one sticker
screen (`app/(tabs)/stickers.tsx`) reads a hardcoded catalog with a fixed unlock flag, identical for
every user. Equipping is per-*card* (`sticker_placements.card_id`, `PlacedSticker` in `CardView`), not
per-user — consistent between the schema and the type definitions — but whether an equipped sticker
is baked into a snapshot or resolved live is answered two different ways depending on which card:
a *live* card built via `cardViewFrom` always has `stickers: []` (comment: "a card drawn from a row
alone simply has none yet" — `card-view.ts:73`), while `app/(tabs)/card.tsx` live-fetches
`sticker_placements` for the signed-in user's own card outside that pipeline (see Contradicts above),
and a *collected* card's stickers come from whatever the snapshot's `stickers` array held at collect
time (`sync.ts:46`) — i.e., baked in, not resolved live, for anyone else's card.

**3. Tiers.** Yes, per-card-per-collector, matching the bible as the code describes it:
`CollectedCard.tier`/`meeting_count` (`src/card/types.ts:98-105`) are scoped to one `(collector,
owner)` pair, computed by counting `collections` rows for that pair (`sync.ts:100-108`), not a global
or per-owner-only count. The 2/4/8 meeting thresholds are declared once, in `src/card/tiers.ts:39-44`
(`CARD_TIERS`), with the module's own comment claiming this is the only place they live — but that
claim is false; see the Wrong-pile entry above (`binder.tsx:243` duplicates the `8` as a raw literal).

**4. Cards.** The app's own code only ever deals with one card at a time per user:
`profiles.active_card_id` (`database.types.ts:25`) is the single field every screen reads
(`AuthProvider.tsx:151` gates onto its presence/absence; `app/card/edit.tsx:67` and
`app/(tabs)/card.tsx:36-38` both key off it directly). Nothing in `src/` or `app/` lists, creates, or
switches between multiple cards for one user — there is no card-switcher screen (confirmed absent;
CLAUDE.md, README, and ARCHITECTURE.md all separately list "card switcher" under "Not in"). The schema
does model more than one card per user: `cards_per_user_cap()` (`database.types.ts:238-241`) implies a
configurable cap greater than one, but no app code calls it or exposes a way to reach a second card.
So: the app behaves as if it's one card per user; the schema leaves room for more; nothing currently
contradicts that, since the "more than one" path is simply unbuilt rather than built differently.

**5. Foil.** Three implementations, not one, all selectable via `Foil.tsx`'s `engine` prop
(`'legacy' | 'v2' | 'pokemon'`, `Foil.tsx:54`): the production layer stack (`Foil.tsx` itself, default),
an experimental shine+glare engine (`FoilV2.tsx`), and a structural port of a specific open-source CSS
technique (`FoilPokemon.tsx`, explicitly a "layer-for-layer" port per its own header comment). None
share shader source — there are no shaders anywhere in this app (see the Skia finding above); all
three are React Native `View`s with `mixBlendMode`/`experimental_backgroundImage`. They don't share a
recipe table either (`Foil.tsx`'s `RECIPES`, `recipes.tsx`'s `FOIL_RECIPES`, and
`pokemon-recipes.tsx`'s `POKEMON_RECIPES` are three separate, independently authored tables), though
they do share lower-level utilities (`hashSeed`/`facetField`/`glitterField` from `speckle.ts`,
`EdgeLip` from `layers.tsx`). Tilt drives all three, consistently in *direction* (light sits opposite
the drag in every engine, each with a comment saying so) but not in *magnitude*: see the Wrong-pile
`TILT_RANGE` finding — all three foil files assume a ±16° range while the actual driver
(`FlipCard.tsx:45`) clamps to ±10°.

**6. Offline.** Yes, a local scan queue exists: `useConcardStore`'s `scan_queue`
(`useConcardStore.ts:28`), persisted to `AsyncStorage` via zustand's `persist` middleware
(`useConcardStore.ts:280-291`), drained by `ConcardSync.tsx` on `NetInfo` connectivity events and
whenever a new scan is enqueued while online. The collect rate limit lives **server-side only**: the
client never computes or checks a cooldown itself — it calls the `collect_card` RPC
(`sync.ts:151-153`) and, on a `'cooldown'` error code, surfaces the server's own `retryAt` from the
error's `details` field (`src/lib/collect.ts:40`). `COLLECT_COOLDOWN_MS` (`collect.ts:45`, 72 hours) is
declared client-side only as documentation ("mirrors `collect_cooldown()` in SQL") and is not used to
block a scan before it's sent — it exists for display/formatting (`formatRetryIn`), not enforcement.
The actual `collect_cooldown()` function lives in the `concard` repo's schema and could not be checked
against this constant (see scope note).

**7. Theme.** Mostly tokens, with real hardcoded-hex leakage. `src/theme/palette.ts` is the one
declared source for app-chrome color, and its own header states the intended rule explicitly: "Anything
that needs a colour should name a role rather than inlining a hex." In practice: card-face rendering
files (`CardBack.tsx`, `CardOverlay.tsx`, `StickerLayer.tsx`, `Foil.tsx`) inline hex literals for
colors that don't have a chrome-palette role (arguably correct, since CLAUDE.md separately states the
card face must never borrow chrome tokens) — but two *chrome* screens also inline hex that duplicates
an existing palette value instead of importing it: `app/(tabs)/scan.tsx:22` hardcodes
`'#b9c9ff' `/`'#9ff0dc'` (which are `palette.holo`/`palette.teal`) in a gradient string, and
`app/(tabs)/index.tsx:88` hardcodes `'#fbf9f3'`/`'#17161b'` for the QR code's own colors. Separately,
the holo gradient stops are defined independently in two places with currently-matching but
structurally unlinked values: `palette.ts:103` (`HOLO_STOPS`) and `card-style.ts:23`
(`FRAMES.holo`) — the latter is explicitly "ported verbatim from the web app," so the duplication is
by design, but it is still two literal arrays that would need to be changed in lockstep and nothing
enforces that. No second, competing *palette module* was found — `palette.ts` is genuinely the only
place role-to-color mappings are declared; the legacy "arcade dusk" aliases at the bottom of the same
file (`void`, `rose`, `cream`, etc.) are old names pointing at the same current values, not a second
palette.

**8. Schema.** Could not be fully answered — see the scope note and the first Unclear entry.
What's checkable from this repo alone: `database.types.ts`'s `cards`/`profiles`/`collections`/
`fandoms` tables line up with the fields `CardView`, `cardViewFrom`, and `use-card-editor.ts` actually
read and write (`display_name`/`pronouns`/`bio` nullable-inherits, `style`/`links` jsonb, `art_*`,
`affiliation`/`affiliation_x`/`affiliation_y`). One field present in the types but read nowhere in
`src/`/`app/`: `profiles.notifications_on_collect` (`database.types.ts:27`) — declared, never
referenced by any screen or store. The sticker-related tables (§2 above) are present in the types but
absent from this app's own three migration files, so whether they match the *live* schema is the
open question recorded under Unclear.

### Questions the code does not answer

None of the eight came back "unimplemented" outright — every one has at least a partial, checkable
answer in this repo, even where that answer is "the app hasn't built its half of what the schema
implies" (stickers) or "not enough reference material to fully check" (schema parity). The one true
gap surfaced along the way, worth a bible section if it doesn't have one already: **there is no
written model anywhere in this repo for what "your own card, as you see it on your own device outside
the editor" is supposed to show.** The editor has one (`Card`/`cardViewFrom`), collected-card
rendering has one (the snapshot), but the three screens that show your *own* live card outside the
editor (`card.tsx`, `index.tsx`, `scan.tsx`'s "my card" preview) each independently reinvented a
partial version of it, and none of the three agree with each other or with the editor on what fields
that reinvented version should carry (see the Contradicts section). A design-bible section — or even
just a decision to route those three screens through the existing `useCard`/`Card` pipeline — would
close this.

## Out-of-scope items reported as requested

**`android/` and `ios/`:** neither directory exists in the working tree. Both are explicitly
gitignored (`.gitignore:23-24`, `/ios` and `/android`), and `git log --all -- android/ ios/` returns no
history — they have never been committed. Running `expo prebuild` is safe as far as version control is
concerned; there is nothing to lose.
