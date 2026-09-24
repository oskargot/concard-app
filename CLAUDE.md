# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Concard is an Expo/React Native (iOS + Android) app for meeting people at conventions, framed around
collecting each other's digital trading cards. It implements the app half of the **Concard Design
Bible** product spec. The web half (`concard.me` + public `/username` pages) lives in the separate
`concard` repository, which also owns the shared Supabase schema and migrations — coordinate schema
changes there, not here. On this machine it is checked out at `../concard-web/concard`:
**SvelteKit 2 with Svelte 5**, TypeScript, Tailwind v4, Netlify adapter, pnpm (not on PATH —
`npx pnpm@10.33.0 …`). Its checks are `pnpm check`, `pnpm lint` and `pnpm test`.

Run all commands from this directory (`concard-app/`, the Git repository root).

## Commands

```sh
npm ci                # install from package-lock.json
npm start             # Expo dev server (Expo Go)
npm run android       # start targeting Android
npm run ios           # start targeting iOS
npm run typecheck     # tsc --noEmit, strict mode
npm run lint          # ESLint (Expo flat config) + Prettier check
npm run format        # Prettier write
npm run shots -- /dev/stickers   # screenshot routes on the web target (see below)
```

Prettier runs with `endOfLine: 'auto'`: `core.autocrlf` checks files out as CRLF here, and without it
`prettier --check` failed every file. `package.json` / `app.json` are prettier-ignored because npm and
Expo rewrite them in their own style.

There is no test framework or build script configured. Before submitting changes, run `typecheck` and
`lint`, then verify affected flows in Expo Go — especially card rendering, tilt, and flip on both
platforms via `/dev/cards` and `/dev/foil-lab`.

`npm run shots -- [--phase=N] [--name=x] <route>…` (`scripts/shots.mjs`) is the autonomous check: it
starts Expo's web target on :8082 if nothing is there, drives the installed Chrome through
`playwright-core` at 390 × 844 @2x, and writes PNGs to `docs/stickers/shots/phase-N/`. It proves layout
and logic only — the web target has no Skia runtime, so foil is absent, and blend modes and gestures
differ from native. Device checks in Expo Go still own how foil and gestures feel.

Copy `.env.example` to `.env` and fill in Supabase settings before running. Without a `.env` the app
shows a setup screen naming what's missing rather than failing on every screen (`src/lib/env.ts`,
`missingSupabaseEnv`). Never put service-role keys or secrets in `EXPO_PUBLIC_*` variables — Expo
inlines that prefix into the client bundle.

## Architecture

### Routing and auth gating (`app/`, `src/auth/AuthProvider.tsx`)

File-based routes via expo-router: `(auth)/` for onboarding, `(tabs)/` for the main app, `dev/` for
card and foil previews (no Supabase needed there).

`AuthProvider` collapses session/profile state into one `AuthStatus`:
`unconfigured → signed-out → needs-username → needs-card → ready`. Signing up isn't finished until
there's a username _and_ a first card (design bible §10) — those are forced routes, not dismissible
prompts. `app/_layout.tsx`'s `AuthGate` redirects to whichever route the current status calls for,
but never fights ordinary navigation elsewhere, and leaves `dev/*` alone entirely.

### The card renderer (`src/card/`)

The core product surface, built to the **card spec** (the "Concard Card Spec" handoff, which
supersedes the style guide's Card Face section and the bible's card layout). The card is designed once
in a fixed **250 × 350 unit** space (1 unit = 0.01 in, a 2.5 × 3.5 in trading card) and every render —
hero, detail, binder (~106 px), the web `/username` page — draws that identical layout scaled by
`width / 250`. Nothing reflows between sizes. A live card and a frozen collection snapshot both reduce
to one `CardView` (`src/card/types.ts`) and must never drift from how they looked the day they were
collected.

- `layout/` — **the shared part; no React Native imports**, so the web card must import the same
  files. `spec.ts` holds every number in the spec. `front.ts`'s `layoutFront()` turns content + style
  into absolute rects in card coordinates _and the exact strings to draw_ (name ellipsised, pronoun
  pill truncated, bio wrapped into whole lines, handles cut), plus divider stops, `H_max` and
  `canAddLink`. `measure.ts` measures with `outfit-metrics.ts` — real Outfit advances + GPOS kerning
  generated from the bundled TTFs by `scripts/make-outfit-metrics.py` (spec §9). Renderers only
  position what `layoutFront` returns, one `Text` per line, so iOS, Android and web cannot break a
  line in different places. `back.ts` is the back's geometry; `crop.ts` is the focal-point cover crop.
- `CardShell.tsx` — the frame: 8-unit edge band in the card's edge colour (`FRAMES`), radius 12
  outside / 4 inside, the face, the foil stack, and an `overlay` slot outside the face clip.
  `shellMetrics(width)`'s `u(n)` converts design units to px. Every dimension is multiplied out
  rather than one `scale` transform applied, so text lays out at its real pixel size and stays crisp.
- `CardFace.tsx` — name, `@username` + pronoun pill, photo zone, bio box, link pills (Simple Icons
  via `LinkIcon.tsx`, derived from the url's domain in `link-platforms.ts`). All card text is Outfit
  with `allowFontScaling={false}`. `useFrontLayout(view)` normalises the view (old persisted
  cards/snapshots included) and memoises the layout.
- `CardOverlay.tsx` — stickers and the fandom affiliation, drawn in the overlay above everything,
  tier foil included (spec §4, §7). Positions are card fractions; the affiliation's default spot is
  the spec's 64 × 64 bottom-right corner of the content box (`BADGE_HOME`).
- `CardBack.tsx` — graphite face, the card's own edge colour, the QR tile + `concard.me/username`
  centred (`CardQr.tsx` draws the matrix itself so the quiet zone is exactly 4 modules). Variants:
  `qr` (your card), `placeholder` (an offline scan: neutral edge, stand-in code) and `record`.
- `FlipCard.tsx` — owns tilt (drag) and flip (tap) via Reanimated `SharedValue`s, and hands the same
  `rx`/`ry` down to both faces so their light can never desync. At rest the card is a flat view (no
  `perspective`); on drag it promotes to a hardware texture and applies `rotateX/Y` to that bitmap
  instead of re-compositing text/gradients under perspective (that was the "glassy pixelation" fix).
- `card-style.ts` — style tokens (edges, faces) **ported verbatim from the web app** and in sync
  with the `cards_style_shape` DB check constraint, plus the spec's `photo_shape`, `alignment` and
  `photo_height`. `inkFor` derives the spec's colour roles per face: primary text = `ink`, dim text =
  `mute`, line colour = `line`, raised colour = `raised` (drawn at 60%). `normalizeStyle` reads both
  photo-shape spellings (`square`/`round` are the DB's old names for `sharp`/`rounded`) and the old
  `bio_align` key; `styleToJson` writes the old spellings while `WRITE_LEGACY_PHOTO_SHAPES` is on.
- `tiers.ts` — the foil ladder. Two systems share one vocabulary here: **card tiers** (design bible
  §7, per card per collector, earned by repeat meetings) and **sticker foils** (web app enum, two
  copies at one tier combine into the next). `glitter` is a rung on both and must look identical in
  both places.

### The foil system (`src/card/foil/`)

A foil is one SkSL runtime shader, screen-blended over the face. It emits light only and draws no
card, so it brightens the face and never darkens it. Production is three files (the rest of `foil/` —
`FoilPokemon`, `FoilSwatch`, `FoilTexture`, `FoilV2`, `SkiaSmoke`, `SkiaTextured`, `layers`, `recipes`,
… — are earlier lab engines reached only from `/dev/foil-sampler` and `/dev/skia-smoke`; never build on
them):

- `foil-sksl.ts` — the shader source and every look value. One core (the TiltHologramCard stack as
  maths: a rainbow and two soft light bands read along one tilt-driven axis, plus a spotlight glare)
  and a _material_ per recipe: `sprayed` and `stars` sample fleck PNGs in `assets/foil/`, `linear`
  computes stripes in the shader, `mosaic` samples a baked facet map whose channels are per-triangle
  phase / seam / brightness (generated by `scripts/make-foil-textures.py`). Every constant is baked
  into the source, so editing one and saving recompiles on the phone. The module has no RN imports,
  so `node scripts/foil-sksl.js <recipe>` prints the exact SkSL for checking in the Skia Labs
  editor before it reaches a device.
- `SkiaFoil.tsx` — compiles a recipe, binds its texture as a child shader, feeds the uniforms from
  `rx`/`ry`. `idle="still"` (thumbnails) drops the frame clock so a grid never redraws every frame.
- `Foil.tsx` — maps `FoilKind` → recipe (`glitter → sprayed`, `cosmic → stars`, `holo → linear`,
  `mosaic → mosaic`), wraps the canvas in the `isolation: isolate` + `mixBlendMode: screen` stack,
  and draws the two plain RN layers a shader cannot: the edge lip (needs to darken), and the
  _gloss_ — the glare's white wash as a sliding gradient built by `glossGradient()` from the same
  numbers the shader lights its flecks with. Per spec §7 the tier foil covers the whole face,
  photo included: the shader stack sits at `zIndex: 3` over CardFace's lifted photo (`1` / `2`), and
  the gloss at `zIndex: 6` over everything. Stickers sit above both, in CardShell's overlay.
  Every card has the gloss, tier 0 included (it replaced tier 0's static copy of the web card's
  specular shine).

Two rules hold everywhere: the material is sampled at `fragCoord` and never at a tilt offset, so
the pattern is pinned to the card and only the light moves (a fleck that crawls on tilt reads as a
sticker, not a finish); and every light term slides _opposite_ the finger (`LIGHT_DIRECTION`),
matching `CardShell`'s face light.

This replaced the earlier blend-mode layer stack (RN 0.86 `mixBlendMode` + gradient views) and its
experimental engines. Expo Go ships Skia on SDK 57, so no dev client is needed. `/dev/foil-lab`
runs every kind through the production card path on real hardware. `@shopify/react-native-skia` must
stay at the exact version in `node_modules/expo/bundledNativeModules.json` (2.6.2 on SDK 57) — Expo Go's
native side is built against that one, and Oskar has no Apple developer licence for a dev client.

### The card editor (`app/card/edit.tsx`, `src/card/editor/`, `src/card/use-card-editor.ts`)

The card is the interface — there are no option panels. These follow from that and are
load-bearing:

- **`CardFace` edits itself.** With an `edit` prop, a tapped name / pronoun pill / bio becomes a
  `TextInput` with the identical style in the identical box until it blurs, then the exact card
  rendering (real ellipsis, whole-line bio) returns — that is the live preview. The photo takes a
  drag to reframe and a pinch to zoom (`art_x`/`art_y`/`art_scale` are the spec's focal point +
  zoom); the picker no longer pre-crops. `Card` draws the **divider** (`editor/DividerHandle.tsx`) in
  the overlay: 14-unit steps from 112 to `H_max`, a haptic tick per step, a 44 pt touch target.
  Editor-only affordances never render without `edit`. `faceBands()` reads the same layout so the
  side controls follow the photo as it moves.
- **Nothing is clipped silently.** `editor/fit-notices.ts` turns the layout into sentences under the
  card (cut name, truncated pronouns, hidden bio, hidden bio lines); `LinkRows` previews each pill's
  cut and blocks adding a row the photo leaves no room for (links never shrink the photo).
- **Style axes are arrows in the gutter**, one per band — alignment at the header, photo shape at
  the photo, edge colour at the links — plus one row of the eighteen face colours spanning the
  width above the card.
- **No Supabase, or nobody signed in, edits the on-device card.** Dev builds skip `AuthGate`, so
  the tabs are reachable without either; `useLocalCardEditor` then edits the store's persisted
  `active_card` (what Home and the Card tab draw) and the screen says so, rather than spinning on a
  card row that can never load.
- **Links are paste-a-url.** The domain picks the icon, the handle is parsed from the path per
  platform (`link-platforms.ts`) and pre-filled, then it's the user's. Icons are generated from the
  `simple-icons` devDependency by `node scripts/make-link-icons.mjs`; the app ships only the paths.
  `/dev/card-editor` runs the whole editor on local state, no sign-in needed.
- **Autosave, no save button.** `useCardEditor` debounces the whole editable row into one update.
  Reads and writes both honour the inherit rule: null `display_name` / `pronouns` / `bio` mean "use
  the profile's", so the editor resolves them for display and writes null back whenever the value
  matches the profile again.

`cardViewFrom` (`card-view.ts`) is the single row→`CardView` conversion, shared by the editor and by
`useCard` so a card can't render differently depending on which screen loaded it.

### Supabase (`src/lib/`)

`supabase.ts` exports `supabase: Client | null` — null when unconfigured, so every call site must
guard rather than the module throwing at load (`requireSupabase()` throws for call sites already
behind a guard). Client config for RN specifically: `AsyncStorage` session persistence (no cookies),
`detectSessionInUrl: false` (Concard's deep links are `/username` collection links, not OAuth
redirects), and an `AppState` listener (`bindAutoRefresh`) to keep tokens fresh across backgrounding.
`react-native-url-polyfill/auto` must be imported before the client — supabase-js needs a complete
`URL` implementation that Hermes lacks. `database.types.ts` is generated from the shared schema owned
by the `concard` web repo.

### Theme (`src/theme/`) and shared chrome (`src/ui/`)

`palette.ts` / `tokens.ts` hold the palette and non-color tokens for the "dark velvet display case"
chrome (Concard style guide): a neutral dark ground → surface → raised ramp, one holo accent
(`#b9c9ff`) per screen, and **Outfit** for all app-chrome type. Per the card spec the card face is
Outfit too (400 / 600 / 700), measured from the same TTFs; Fredoka and Space Grotesk remain only in
stickers and older chrome. `src/ui/index.tsx` holds the chrome kit (`Button`, `HoloButton`, `Chip`,
`IconCircle`, `CountBadge`, `ScreenHeader`, `QrGlyph`, `AmbientGlow`, `Field`, `Panel`, …): quiet flat
surfaces with a real hairline, with the holo gradient reserved for primary CTAs and the Scan control
so cards stay the loudest thing on screen. `palette.ts` also keeps the old "arcade dusk" role names
(`void`, `rose`, `cream`, …) as deprecated aliases mapped to their nearest guide value, so any
not-yet-migrated screen still compiles and renders on-palette; new code should use the guide roles.

Fonts ship as self-hosted TTFs in `assets/fonts/` rather than via `@expo-google-fonts`, on the same
reasoning as the web app: a convention hall is exactly where a third-party font request fails.

## Notable dependency pin

`react-dom` is pinned via `package.json` `overrides` to match the `react` version Expo SDK 57 pins.
`expo-router` pulls `@expo/metro-runtime`, which wants a newer `react-dom` whose `react` peer would
otherwise conflict. `react-dom` is only used by the web target, so pinning it keeps the tree
resolvable without touching anything RN actually runs.

## Decisions that diverge from the design bible or the web app

Each of these was resolved deliberately and is worth re-checking before assuming the bible or the web
app is the source of truth:

- **Glitter is earned in the app but not on the web.** The web card's base face always carries a
  glitter layer; the app's tier 0 has none, so the first upgrade to tier 1 (Glitter) is visible.
- **Collect rate limiting is per-person, not per-card**, despite bible §7 saying per-card — with 5
  cards per user, per-card would let one person farm five collects a day by swapping actives, which is
  exactly what the cooldown is meant to prevent. Matches the web app's `collect_card()`. The window is
  **72 hours** (`collect_cooldown()`, live and in the web repo's `docs/DESIGN.md`), not the bible's 24.
- **Card fields are a union** of the bible's §6 list and the web app's existing fields (background
  tint, fandom badge) — nothing already shipping was dropped to match the bible.
- **`alignment` / `photo_height` live in the `style` jsonb**, not as their own DB columns, despite
  the spec listing them as card fields — `collect_card()` freezes `style` whole, so snapshots carry
  them with no function change. `bio_align` is still written alongside `alignment` for the web card.
- **Collected cards keep the `record` back**, not the spec's QR back, so a binder card still can't be
  re-scanned remotely; the spec's offline placeholder back is used for scans still pending sync.
- **Bio cap stays at the DB's 200 chars**; the bible's 140 is enforced only in the app's editor, so
  cards already written by the web app remain valid.

## Status

Phase 2 of 7, plus the card editor and the meet loop (My Card QR → Scan → `collect_card` → Binder).
In: card renderer (to the card spec), foil lab, email/password auth, username claim, forced first
card, card editor (text in place, style, photo/bio divider, photo reframing, per-card links with
parsed handles, affiliation, photo upload), and the meet loop end to end — see "The meet loop" below.
Stickers are in (see "Stickers" below; their schema waits on the migrations being applied). Not in: card switcher, the web card's port to the spec, events, friends, DMs, purchases, settings. Nothing has been exercised against a live Supabase project
on a device yet — the code paths are wired, but no one has run the scan → collect → binder loop between
two real accounts.

### The meet loop (`app/(tabs)/card.tsx`, `scan.tsx`, `binder.tsx`, `src/store/`)

My Card's `FlipCard` back is a real QR (`react-native-qrcode-svg`) encoding `profileUrl(SITE_ORIGIN,
username)` — a stable profile URL, never a session token, matching exactly what the web app's own QR
and scanner use. `src/lib/username.ts`'s `usernameFromScan` (ported verbatim from the web app) is the
single parser both the scanner and any manual "type a username" fallback go through; it accepts a
URL on an allowed host (`src/lib/env.ts`'s `ALLOWED_QR_HOSTS`, which includes whatever
`EXPO_PUBLIC_SITE_URL` is set to) or a bare username.

A scan enqueues into `useConcardStore`'s `scan_queue` and immediately adds an optimistic, `pending`
binder card so the queue is visible before it syncs. `ConcardSync` drains the queue through
`src/store/sync.ts`'s `syncPendingScans` whenever connectivity returns, calling the shared
`collect_card` RPC and resolving each scan into the real snapshot it returns — never a client-guessed
shape. `collect_card` returns a snapshot directly (no follow-up `collections` select keyed on a
scan-time `card_id`, since the QR no longer carries one); `tier`/`meeting_count` are not columns the
schema tracks, so they come from a count of `collections` rows for that (collector, owner) pair,
mapped through `src/card/tiers.ts`. Errors from `collect_card` (cooldown, cannot-collect-self, no
active card, not authenticated) are parsed by `src/lib/collect.ts` (also ported from web) and surfaced
in the scan and binder screens rather than silently dropped; only permanent failures evict the queued
scan, and `not_authenticated` pauses the whole drain rather than losing anything.

The binder's starter demo cards (`DEMO_BINDER`) are a first-run fixture, not a fallback that coexists
with real data forever: the first successful live `collections` fetch (`fetchMyCollections`, run once
per signed-in session by `ConcardSync`) or synced scan clears them. A collected card's back is `CardBack`'s
`record` variant — no QR — so a binder card can never be re-scanned remotely; only my own active card's
back is `qr`. A scan still pending sync shows the `placeholder` back (neutral edge, stand-in code).

**The editor needs migrations this repo does not own.** (As of 2026-09-23 the live project already has
the `card_spec_v2` constraints, the v3 `collect_card()` snapshot, `sticker_placements.size` and the
`card-art` bucket, but the web repo's `supabase/migrations/` has none of this repo's four files — they
were applied by hand. Check the live `pg_constraint` before assuming either way.)
`supabase/migrations/20260915000000_card_links_and_art.sql`
adds `cards.links` and the `card-art` storage bucket; `20260923000000_card_spec_v2.sql` widens the
style and links constraints for the card spec (eight links with handles, new photo-shape names,
`photo_height`), moves the default sticker spot, adds `sticker_placements.size`, and makes
`collect_card()` snapshot the card's own name / pronouns / bio / links. Copy both into the `concard`
web repo and apply them there. Until then the editor degrades rather than failing: a missing column
is dropped from the save and named, photo shapes are written under their old names, and a seventh or
eighth link is kept on screen while only the first six save.

**The web card must be ported to the spec too.** Parity is a hard requirement: the web renderer should
import `src/card/layout/`, `link-platforms.ts`, `link-icons.ts` and `card-style.ts` verbatim and only
position what `layoutFront()` returns.

## Stickers

`docs/stickers/HANDOFF.md` is the spec and wins over this file for stickers; `docs/stickers/PROGRESS.md`
records how it was built, every default taken, and what still waits on Oskar. In short:

- **Two kinds, kept apart everywhere in the UI.** _Deco_ stickers are art, each baked from one PNG
  (emoji are the Noto Emoji set, never live emoji text). _Fandom_ stickers are generative text
  (`FandomSticker`, `fandom-layout`, `fandom-styles`); names are user-submitted and live only once
  Oskar sets `fandoms.status = 'approved'`. Order within a kind is `sort_order`, then foil.
- **Foil ladder** `none → glitter → holo → cosmic → mosaic` (`STICKER_FOILS`, `nextStickerFoil`
  in `src/card/tiers.ts`); two spare copies combine into one at the next (`combine_stickers()`).
- **Getting them**: `collect_card()` grants up to one deco and one fandom sticker, picked server-side
  from the snapshot, keeping their foil 10% of the time; the free affiliation is a placement.
- **20 stickers per card** (`MAX_STICKERS_PER_CARD`, `max_stickers_per_card()`), **plus** at most one
  affiliation, which doesn't count toward them — picking a fandom is part of a card save, and a full
  card mustn't make that save fail.

Where things live:

- `scripts/stickers/` — the ingest. `pipeline.ts` is the pure `png → {full, mask, thumb}` core
  (die-cut by Gaussian blur + threshold, baked shadow, content-hashed names); `ingest.ts` bakes,
  dry-runs, uploads and upserts rows (service-role key from `.env.local` only);
  `fetch-noto.ts` vendors the emoji; `make-fixtures.ts` bundles a few bakes for offline use;
  `make-button-icon.ts` bakes the editor's die-cut button icon.
- `src/stickers/` — rendering and data. `StickerRenderer` (dispatch + `stickerBox`), `DecoSticker`
  (one image; one canvas when foiled), `FandomSticker` (SVG; foil through a MaskedView of its own
  die cut, native only), `StickerFoil` (the card's `FoilFill` evaluated in the card's light field
  — see below), `shimmer.tsx` (the one shared idle clock), `definitions.ts` / `assets.ts`
  (placement → drawable, fixture → bucket URL → glyph fallback), `inventory.ts` / `live.ts` /
  `local-catalog.ts` (live and on-device inventories, schema-era tolerant),
  `use-card-stickers.ts` (editor placements + autosave), `use-sticker-inventory.ts` (Stickers tab +
  combine), `fandoms.ts` (submission), `GrantLine.tsx` (collect feedback).
- `src/card/editor/` — `StickerButton`, `StickerDrawer`, `StickerEditLayer` (drag / pinch 0.5–2× /
  rotate, drop on the drawer to remove), `AffiliationRow` (with "Submit a fandom").
- `src/card/snapshot.ts` reads v2–v4 collection snapshots and a collect's grants.

**A sticker's foil is the card's foil.** `SkiaFoil.tsx` exports `FoilFill`, the shader element the
card's own canvas draws; a sticker draws the same element with `edge={0}` (no card clip / rim), a
local matrix that maps each sticker pixel to the point of the card it covers (so it's lit by the
card's `rx`/`ry` and glare), and a texture matrix that pins the flecks to the sticker at the card's
fleck size. It's composited like the card's foil actually lands (premultiplied source-over — the
card's stack is isolated), clipped with mask → `srcIn` foil → `srcATop` gloss. Plain stickers are
a plain image: no canvas, no clock. Minis (`detail="thumb"`) draw stickers without foil.

The web target loads CanvasKit (`index.web.js`, wasm copied by `scripts/setup-skia-web.mjs`), so
`npm run shots` shows real foil; it caps at ~16 Skia canvases per page (one WebGL context each).
The harness takes `--actions=<json>` scripts (click / text / type / tap / drag / eval / shot) —
see `docs/stickers/shots/phase-*/*.json`.

The web repo draws the same stickers from the same files: `scripts/sync-sticker-renderer.mjs` copies
the fandom layout verbatim, and `src/lib/stickers/resolve.ts` mirrors `definitions.ts`. Its foil is
still its own CSS `FoilFx` (a decision logged for Oskar).
