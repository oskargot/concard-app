# Stickers — Progress

## Current phase

All phases built, plus the 2026-09-24 review fixes and the web card port. Status: **waiting on Oskar** — apply the migrations, upload the art (the 45 Noto emoji are ready), run the device checks (all under Needs Oskar).

## Phase summaries

### Phase 8 — Hardening (done 2026-09-23)

Shipped: small deco stickers draw their 192 px thumbnail instead of decoding the 592 px art (most
on-card stickers, all minis); mini binder/scan cards draw stickers without foil canvases; the
client-side security review ([appended here](security-review-phase2.md)) found nothing; CLAUDE.md
now maps the sticker code; HANDOFF §9 has a "Decided" column. Dead code: the prototype catalog,
glyph map and `StickerLayer` were removed in Phases 3 and 5; the old foil lab engines are
**proposed** for deletion, not deleted (Needs Oskar).

**Where "done" stands** (HANDOFF §5): editor, drawer, place / move / scale / rotate / remove,
combining, fandom submission, collect grants and the binder all work end to end on-device and in
web screenshots, and are wired to the live schema. What isn't proven yet needs you: the migrations
applied, the art uploaded, a real two-account collect, the feel of foil and gestures in Expo Go on
your iPhone, and the web foil / web card decisions.

Check on device (the ones that matter most, across all phases):

1. `/dev/stickers`: tilt the glitter card — does the glitter sticker match it? Does each rung read as a step up?
2. Edit card: pinch to both clamps, twist, drag from the drawer, drop back on it.
3. `/dev/stickers?perf=1` and a full drawer of foiled stickers: still smooth?
4. Stickers tab: combine something; is the reveal right?
5. After the migrations: collect a real card between two accounts; both stickers arrive.

### Phase 7 — Web parity (sticker layer done 2026-09-23; full pixel parity waits on two decisions)

Shipped (web, `feat/stickers`): the web card draws deco stickers from the ingest's art and fandom
stickers from the **same layout code** as the app (`fandom-layout.ts`, `fandom-styles.ts`,
`font-metrics.ts` copied verbatim by `scripts/sync-sticker-renderer.mjs`, with the app's own TTFs
under the app's family names), at the app's geometry (centre, `size` as a fraction of card width —
long edge for deco — `scale`, rotation + the same wobble). The affiliation is now the fandom
sticker on the web too (the old badge is gone), drawn from its placement once migrated. v4
snapshots and `size` / `is_affiliation` are read. `FoilFx` clips to the new masks.
Shot: [app vs web, same v4 snapshot](shots/phase-7/side-by-side.png) — positions and sizes agree.
What still differs, and why it isn't fixable inside this phase: the **card** underneath (the web
card hasn't been ported to the card spec — CLAUDE.md lists that as its own job) and the **foil**
(the web's CSS `FoilFx` isn't the app's SkSL engine; see Needs Oskar).
Check on device / in a browser: 1. `pnpm dev` → `/dev/stickers` next to the app's binder view of the demo scan: same stickers, same places?
Needs Oskar: the two decisions below.

### Phase 6 — Collect integration (done 2026-09-23)

Shipped: `src/card/snapshot.ts` reads v2/v3/v4 snapshots (v4 stickers carry kind, asset paths,
label and style; the affiliation — previously dropped from collected cards — now draws, from its
placement when there is one). Sync reads the collect's `stickers` grants (falling back to
`bonus_sticker_id`) onto the binder card; `fetchMyCollections` reads them from
`collection_sticker_grants`. A quiet "You got … + …" line with thumbnails sits under the binder
card's detail and under the Scan screen's recent strip. With no Supabase, a demo scan replays a
**real** v4 `collect_card()` response — printed by the migrated function in PGlite
(concard `scripts/collect-fixture.mjs`) — through the same parsing, and credits the grants to the
on-device inventory. Also fixed: the demo scan's username had a hyphen, which usernames can't have,
so it never worked.
Shots: [binder](shots/phase-6/scan--binder.png),
[binder detail + grants](shots/phase-6/scan--binder-detail-grants.png),
[inventory after the collect](shots/phase-6/scan--inventory-after-collect.png).
Check on device:

1. Scan → "Preview with a demo scan" → Binder: does the new card match the owner's card (stickers, foils, the Sci-fi affiliation) at mini size and in the detail view?
2. Is the "You got …" line quiet enough next to the card?
3. After migrations are applied, a real collect between two accounts: both stickers arrive in the collector's Stickers tab.
   Needs Oskar: nothing new.

### Phase 5 — Inventory and combining (done 2026-09-23)

Shipped: the Stickers tab is the real inventory (live or on-device): Deco / Fandom, five foil
chips, tiles with real foil and counts; a detail sheet you can tilt, with owned / on cards / spare,
and **Combine** (two spare → one at the next foil; `combine_stickers()` live) that re-opens on the new
pile with a reveal — the foil engine's own light swept across it, plus a pop. Fandom submission in
the affiliation picker: name field capped at 24, live preview by the real renderer, "In review"
tiles that can't be picked, the 3-pending cap. The prototype catalog and glyph map are deleted.
Shots: [inventory](shots/phase-5/stickers--inventory.png),
[detail](shots/phase-5/stickers--detail-before-combine.png),
[after combine](shots/phase-5/stickers--combine-after.png),
[fandom inventory](shots/phase-5/stickers--inventory-fandom.png),
[submission preview](shots/phase-5/card-edit--submit-preview.png),
[pending](shots/phase-5/card-edit--submit-pending.png).
Check on device:

1. Stickers → a sticker you have two spare of → Combine: does the reveal read as "it got shinier"? Is it short enough?
2. Tilt the sticker in its detail sheet: does its foil move like a card's?
3. Is "Combine 2 → 1 Glitter" readable on the holo button? (The web target can't draw that gradient.)
4. Submit a fandom with a long name (20–24 characters): is the preview still readable?
   Needs Oskar: approve or reject submissions by setting `fandoms.status` in the dashboard (optionally fix `style_category` while you're there).

### Phase 4 — Editor: button, drawer, placement (done 2026-09-23)

Shipped: the floating die-cut sticker button (bottom-right, rides above the drawer, sinks in when
pressed or open); the drawer (Deco / Fandom, 5 × 4 visible, spare copies only, ×N badges, foil
order, tap to place at centre, hold-and-drag out to place anywhere, drag a sticker back onto it to
put it away); on-card editing (drag, pinch 0.5–2×, two-finger rotate, last touched on top, centre
kept on the card, the affiliation included); autosave per gesture — live `sticker_placements`
writes with rollback on refusal, or the on-device store with a seeded local inventory.
Shots: [button at rest](shots/phase-4/card-edit--button-rest.png),
[drawer / pressed](shots/phase-4/card-edit--drawer-deco.png),
[fandom tab](shots/phase-4/card-edit--drawer-fandom.png),
[tap-placed](shots/phase-4/card-edit--placed-by-tap.png), [moved](shots/phase-4/card-edit--moved.png),
[dragged out](shots/phase-4/card-edit--dragged-out.png),
[put back](shots/phase-4/card-edit--removed-into-drawer.png),
[clamps + rotation](shots/phase-4/card-edit--clamps-rotated.png).
Check on device:

1. Edit card → sticker button: does it feel physical (bevel, sinks in), and never hide something you can't scroll past?
2. Pinch a sticker to both ends: does it stop cleanly at ½× and 2×? Twist it with two fingers while dragging.
3. Hold a drawer tile and drag it onto the card: does it land under your finger? Is a quick swipe still a scroll?
4. Drag a sticker onto the open drawer: "Drop to put it back" shows, and the tile's count goes up.
5. Move your fandom affiliation: does it stay where you put it after leaving and reopening the editor?
   Needs Oskar: nothing new (the live path needs the Phase 2 migrations to be fully exercised).

### Phase 3 — Renderer (done 2026-09-23)

Shipped: stickers are drawn by the card's own foil engine. `SkiaFoil` now exposes `FoilFill` (the
same shader element the card draws) with a local matrix, a sticker-anchored texture matrix and a
`u_edge` switch; a foiled sticker is lit as the patch of card it covers (same `rx`/`ry`, same glare
and gloss), with its flecks at the card's size and clipped to its baked mask. Deco: one image, or one
canvas when foiled. Fandom: the SVG plus the foil through a MaskedView of its own die cut (native
only). All five rungs; one shared shimmer clock; bundled fixtures; `/dev/stickers` rewritten. Every
card screen (Home, Card, Binder, Scan) now draws real stickers through `CardOverlay`; the prototype
`StickerLayer` is gone. The web target now runs real Skia (CanvasKit) so screenshots show foil.
Shots: [lab at rest](shots/phase-3/dev-stickers.png),
[lab tilted](shots/phase-3/dev-stickers-tilt-0-6-0-6--tilt.png),
[home + binder](shots/phase-3/root--regress.png).
Check on device:

1. `/dev/stickers`, tilt the glitter card: do the sparkles sticker's flecks match the card's in size and colour, and move with the same light?
2. Same page: does each rung (glitter, holo, cosmic, mosaic) read as a step up from the one before? (§9 asks whether holo reads as an upgrade over glitter.)
3. Fandom stickers at every rung (ladder rows 3–4): is the foil on the letters and white rim only, never the shadow? (Web can't show this.)
4. `/dev/stickers?perf=1`: 20 foiled stickers on one card — does tilting it stay smooth?
5. Home / Binder: stickers sit where they did, and nothing is drawn twice.
   Needs Oskar: nothing new.

### Phase 2 — Schema (done 2026-09-23; applying it is Oskar's)

Shipped (web repo, `feat/stickers`): five migrations `20260924000000`–`04` — sticker kinds + baked
asset columns, the five-rung foil ladder in `combine_stickers()` (which now spends only unplaced
copies), the `stickers` bucket, fandom submissions (status on `fandoms`, 24-char names, 3 pending
per person, approval → fandom sticker, RLS), placement rules (20 per card, scale 0.5–2, centre on
the card), the affiliation as a free placement kept in sync with the old columns, and
`collect_card()` granting one deco + one fandom sticker with the 10% foil roll server-side
(snapshot v4, `collection_sticker_grants`). All of it runs against a reconstruction of the
**live** schema in PGlite (`pnpm db:test:stickers`, ~60 checks as real RLS roles, including a
400-collect foil-roll test). Types updated in both repos.
[Security review](security-review-phase2.md): no critical/high; two fixed, two low ones logged.
Check on device: nothing new on the phone.
Needs Oskar: apply the migrations, then run the ingest upload (both under "Needs Oskar").

### Phase 1 — Ingest pipeline (done 2026-09-23)

Shipped: `scripts/stickers/pipeline.ts` (pure `png → {full, mask, thumb}`, exact float maths, no
filesystem), `ingest.ts` CLI (dry run, content-hashed immutable names, idempotent, guarded upload +
row upsert), 45 vendored Noto emoji with manifest and licence, the
[contact sheet](shots/ingest-contact-sheet.png), and the die-cut sticker-button icon
(`assets/stickers/button-icon.webp`).
Check on device: nothing to run on the phone yet. Worth a look: the contact sheet — is the rim
weight right (3.5% of the long edge)? Is the soft baked shadow wanted?
Needs Oskar: to upload, put `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `concard-app/.env.local`
and run `node scripts/stickers/ingest.ts` — **after** the Phase 2 migrations (bucket + columns) are
applied.

### Phase 0 — Orientation and ground truth (done 2026-09-23)

Shipped: `feat/stickers` in both repos (pushed); web repo found (SvelteKit 2 / Svelte 5); Skia
confirmed Expo-Go-safe (2.6.2 = SDK 57's bundled version), so no dev-client blocker; live schema
read; `npm run shots` harness; lint green on Windows; `.env` ignored; CLAUDE.md corrected and given
a Stickers section; `docs/design-bible.md`.
Check on device: 1. `npm start` still opens the app in Expo Go (only tooling changed — a
`playwright-core` devDependency and prettier config).
Needs Oskar: open the draft PRs; the product bible (both under "Needs Oskar").

## Needs Oskar

- [x] **Delete the old foil lab engines?** Nothing ships them: `src/card/foil/{FoilPokemon,FoilSwatch,FoilTexture,FoilV2,SkiaSmoke,SkiaTextured,layers,recipes,pokemon-recipes,speckle,gradients,sampler-gradients}` and their routes `app/dev/foil-sampler.tsx`, `app/dev/skia-smoke.tsx` (≈ 4,000 lines). I left them because they're your lab and CLAUDE.md already says not to build on them. Say the word and they go. → **Done 2026-09-24** (you approved): deleted with the `assets/foil/pokemon-cards-css/` textures only they loaded — commit `3d8316d`.
- [ ] **After the art upload**, the web's own older bakes (`static/stickers/*`, `scripts/bake-stickers.mjs`, `sticker-art.ts`) only serve stickers that have no ingest art; once every live sticker has `full_path`, they can go too.

- [x] **Decide the web's foil engine.** Sticker foil can only match across platforms if both run the same engine. Options: (a) load CanvasKit on the web card and run the app's SkSL as-is — exact parity, ~8 MB wasm (the app's web target already does this, `index.web.js`); (b) port `foil-sksl.ts` to a WebGL shader — small, but a second implementation to keep in step (holo-lab's GLSL is close to it); (c) keep the web's CSS `FoilFx` — cheapest, visibly different (see the holo heart in the side-by-side). I'd suggest (a) for the card component only, lazily loaded. Blocking: foil parity on the web. → **Decided 2026-09-24: the same engine on both.** Built as (a): the web runs `foil-sksl.ts` through `canvaskit-wasm` 0.41.0 on one shared GPU surface, lazily loaded — web `c69b983`, `71b12af`.
- [x] **Schedule the web card's port to the card spec.** Sticker geometry already matches, but pixel parity of a whole card needs the web card itself on `src/card/layout/` (listed in CLAUDE.md as pending). Blocking: HANDOFF §5 Phase 7's "pixel-for-pixel". → **Done 2026-09-24**: the web card draws `layoutFront()` from files synced verbatim (`scripts/sync-card-spec.mjs`); every text line and icon within 0.04 units of the app, foil within a mean 1.8–4.1/255 — evidence in the web repo's `docs/card-port/`. Web `a1f34c3`–`7266b6c`.

- [ ] **Apply the sticker migrations** — `concard` repo, `supabase/migrations/20260924000000_sticker_enums.sql` through `20260924000004_collect_sticker_grants.sql`, **in order, each on its own** (the first adds enum values, which Postgres won't let later statements in the same transaction use). Paste each into the SQL editor (the CLI history is out of step — see the drift item). They were written against the live schema as it is today and tested on a reconstruction of it (`pnpm db:test:stickers`). Blocking: live sticker placement / collect / submission; the app works on fixtures until then.
- [ ] **Then upload the sticker art**: put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `concard-app/.env.local` (git-ignored) and run `node scripts/stickers/ingest.ts`. Needs the migrations first (bucket + columns). Blocking: real deco art on live cards.
- [ ] **FYI, migration history has drifted.** Live has four migrations applied by hand from the app repo (`20260914`–`20260923`, incl. card_spec_v2) that the web repo's folder doesn't have — and the web folder's `20260914000000_card_identity_fields.sql` has the _same_ version number as the app's `20260914000000_card_inherit_text.sql`. Live also lacks columns the web history creates (`stickers.glyph`/`rarity` — re-added by my migration — and `profiles.is_admin`) and still has `cards.title`. I didn't reconcile it (renumbering applied migrations is your call); `supabase/dev/live_schema_20260923.sql` records what live actually is. Blocking: nothing, but `supabase db push` won't do the right thing until it's sorted.

- [ ] **Open the two draft PRs.** `gh` isn't installed on this machine, so I can't open them. Branches are pushed: `concard-app` `feat/stickers` and `concard` (web) `feat/stickers`. Blocking: nothing; it only lets you watch progress on GitHub.
- [ ] **The product Design Bible isn't on this machine.** CLAUDE.md cites its §6 (card fields), §7 (tiers), §10 (signup) and §12 (chrome physicality), but the only "bible" on disk is the web repo's `DESIGN.md` ("Design & Brand Bible v0.1 — Creative Direction"), whose §12 is Color and which never mentions a web stack. I copied that one into `docs/design-bible.md` with a correction and stickers section; drop the product bible in there (or tell me where it is) and I'll fold it in. Blocking: nothing; I'm following CLAUDE.md, the style guide as implemented in `src/theme`/`src/ui`, and this spec.

- [ ] **Card links are still capped at 6 live.** The live `card_links_valid()` still refuses more than six links — the links half of the app's `20260923000000_card_spec_v2.sql` never reached live, though its style half did. Both editors save the first six and say so. Applying that function's widening (eight links, with handles) lifts it. Blocking: the seventh and eighth link.
- [ ] **Card links don't fall back to the profile's.** A card shows its own links only (the app's rule, now the web's too), but `collect_card()` snapshots the profile's links when the card has none. Your live card has none and your profile has one, so the card and a collected copy of it differ. Pick one rule. Blocking: nothing.

## Questions (defaults taken)

- Q: Live `cards.bio` is `NOT NULL DEFAULT ''`, so `coalesce(card.bio, profile.bio)` in `collect_card()` never falls back to the profile's bio — a card with no bio of its own snapshots an empty one. Pre-existing (the app's `20260914000000_card_inherit_text.sql` made it nullable, but live never got that part). → took: left alone, not a sticker change; flagged here. (§4)

- Q: Where does a tapped drawer sticker land? → took: the card's centre, slightly high (0.5, 0.45), per §2.2's tap-to-place. Drag-out is implemented too (hold ~140 ms, then drag), so tap is a convenience, not a fallback. (§2.2)
- Q: Removing when the drawer is closed? → took: removal is only by dropping on the open drawer, as specified; nothing else deletes. (§1.4)
- Q: The affiliation in the editor. → took: it's movable like any sticker; its position saves through the card's affiliation columns (which the schema mirrors into its placement), its rotation / scale through its placement row once the migrations are live (on-device, through the store). Dropping it on the drawer clears the affiliation — it was never an inventory copy. (§1.1, §1.4)
- Q: While a sticker is being dragged, its foil's light field updates on release rather than every frame (the placement is committed then). Worth a look on device; cheap to change if it shows. (§1.6)

- Q: Base size for non-square deco art. → took: STICKER_BASE_WIDTH (24% of card width) is a deco sticker's **long edge** (its whole baked canvas, rim and shadow included); for fandom stickers it's the width. Otherwise tall art (penguin, boba) would come out much bigger than wide art. (§1.4)
- Q: Should flecks scale when a sticker is pinched bigger? → took: no — a foil's flecks stay the card's size wherever it is, like one sheet of foil stock cut into stickers of different sizes. The _light_ is the card's too. (§1.3, §3.2)
- Q: Web can't show fandom foil — react-native-masked-view's web build drops its children. → recorded; web shots show deco foil only. Native is unaffected. (§6.2)
- Q: Web can't draw more than ~16 Skia canvases per page (one WebGL context each). `/dev/cards` hits it (its foiled demo stickers go white on web); `/dev/stickers` stays under it by showing two ladder rows on web and five on native. Web-only; recorded. (§6.2)
- Q: Plain stickers get no gloss (the spec keeps `none` fully static), foiled ones do, clipped to their die cut. (§1.6)

- Q: The free affiliation's size. → took: its placement stores `size = 0.256` (the card spec's 64-unit badge spot / 250), not the 0.24 deco base, so existing affiliations look unchanged. (§1.4)
- Q: Snapshot asset "URLs" (§1.5). → took: store object **paths** in the immutable `stickers` bucket; clients prepend their own `<SUPABASE_URL>/storage/v1/object/public/stickers/`. Same permanence, no project host baked into rows. (§1.5, §4)
- Q: Does the affiliation count toward the 20 cap, and can it be granted on collect? → took: yes to both — it's a fandom sticker visible on the card. **Cap reversed on review (2026-09-24):** the affiliation no longer counts — a card holds 20 non-affiliation stickers plus at most one affiliation, so picking a fandom (a card save) can never fail on a full card. It can still be granted on collect. (§1.1, §1.4)
- Q: Rejected fandoms. → took: the submitter can still read their own rejected rows (so the picker can say "not approved" rather than silently dropping it), and a rejected name may be submitted again. (§1.2)
- Q: Old placements (size null). → took: they keep drawing at the old 15.33% base × scale; only the scale range tightened (0.5–2). New placements write size 0.24. (§1.4)

- Q: HANDOFF §1.1 says collect has a "per-person 24h cooldown". Live `collect_cooldown()` returns **72 hours**, and the web repo's `docs/DESIGN.md` also says 72h. → took default: leave the server's 72h alone (the sticker grant just rides whatever the cooldown is); noted as a divergence in CLAUDE.md. (§1.1)
- Q: HANDOFF §0 Phase 0 says to confirm the web repo is "cloned next to concard-app". It's at `../concard-web/concard`, one level deeper. → took default: use it there; no move.

- Q: Storage layout — HANDOFF says upload "under `stickers/<sticker_id>/<hash>-…`". → took: bucket `stickers`, object key `<sticker_id>/<hash>-{full,mask,thumb}.webp`, so the public URL reads `…/public/stickers/<id>/<hash>-full.webp`. (§3.1)
- Q: One hash or three? → took: one hash per sticker version, of the input PNG bytes + the pipeline recipe, shared by its three files. Re-running with the same PNG and recipe always gives the same names. (§3.1)
- Q: "One cheap shadow consistent with how cards sit" (§3.2). → took: bake a soft, nearly centred lift shadow into `full.webp` (ink `rgb(23,22,27)` at 28%, the web's die-cut shadow colour); the mask excludes it so foil never spills into it. Zero runtime cost. Easy to drop (a recipe constant) if you'd rather have none.
- Q: Thumb size needs the drawer's column count, which is Phase 4's call. → took: 4 columns on a 390 pt screen ≈ 64 pt of art per tile → thumbs are 192 px on the long edge. (§2.2)
- Q: "Add the licence notice … to wherever the app lists credits" — the app has no credits screen. → took: README "Credits" section + `sticker-src/noto/LICENSE`; a credits line goes on a settings/about screen when one exists. (§3.3)
- Q: Noto's licence — its README says the images are Apache 2.0, but its root `LICENSE` file at `v2.047` is the OFL text. → took: vendored both (`LICENSE` = upstream's Apache notice from `svg/LICENSE`, `LICENSE-OFL`), documented in `sticker-src/noto/README.md`. (§3.3)
- Q: The emoji set reuses the 12 live sticker ids (star, heart, …) so existing inventory and placements get real art rather than being orphaned; 33 new ids join as `drop`. (§3.3)

## Feedback from Oskar

_(none yet)_

## Tasks — Phase 0

- [x] Create `feat/stickers` in both repos. App branches from `claude/card-spec-v2` (HEAD `8da1cd7`, contains `main`), because the card-spec work is what stickers sit on. Web branches from `main` (`cb2040b`, up to date with origin).
- [x] Find the web repo and confirm its stack: `../concard-web/concard`, **SvelteKit 2 + Svelte 5**, TypeScript, Tailwind v4, `@sveltejs/adapter-netlify`, pnpm 10 (not on PATH; `npx pnpm@10.33.0` works). Its checks: `pnpm check` (svelte-check), `pnpm lint` (prettier + eslint), `pnpm test` (vitest). `node_modules` not installed yet.
- [x] Settle the Skia question. Production foil = `CardShell → foil/Foil.tsx → foil/SkiaFoil.tsx` (SkSL in `foil-sksl.ts`). `@shopify/react-native-skia` is **2.6.2, exactly the version in Expo SDK 57's `bundledNativeModules.json`**, and every other native dep matches too, so it runs in Expo Go on iOS. `expo-dev-client` was already removed (`12badca`). No hard stop. The other files in `src/card/foil/` (FoilPokemon, FoilSwatch, FoilTexture, FoilV2, SkiaSmoke, SkiaTextured, layers, recipes, pokemon-recipes, speckle, gradients, sampler-gradients) are only reached from `/dev/foil-sampler` and `/dev/skia-smoke` — lab code, candidates for Phase 8 dead-code removal.
- [x] Read the live schema (read-only). Findings that matter for Phase 2: `sticker_foil` = none, glitter, holo; `stickers` live has **no `glyph` or `rarity` columns** (the app's `database.types.ts` and web init migration both still list them); `sticker_placements` already has `size` and range checks (x −0.14..1.02, y −0.10..0.96, scale 0.25..3); `collect_card()` already writes the v3 snapshot from `20260923000000_card_spec_v2.sql`; buckets: only `card-art`; 12 stickers (4 starter), 8 fandoms, 3 placements, 1 card, 0 collections.
- [x] `.gitignore`: ignore `.env` (was only `.env*.local`).
- [x] Verification harness: `npm run shots -- [--phase=N] [--name=x] <route>…` (`scripts/shots.mjs`). Starts Expo web on :8082 if needed, drives the installed Chrome via `playwright-core` (no browser download), 390×844 @2x, waits for React to paint, writes `docs/stickers/shots/phase-N/<route>.png`. Cold start ≈30 s. — shots: [dev-cards](shots/phase-0/dev-cards.png), [dev-stickers](shots/phase-0/dev-stickers.png)
- [x] Make `npm run lint` green: `endOfLine: 'auto'` in `prettier.config.mjs` (CRLF from `core.autocrlf` was failing every file); `.prettierignore` gains `package.json`/`app.json` (npm/expo rewrite them), `.claude/`, and `HANDOFF.md` (kept verbatim); formatted `ARCHITECTURE.md`.
- [x] Update CLAUDE.md to the truth (web repo location + stack, cooldown, foil lab files, harness, lint) and add a Stickers section summarising HANDOFF §1.
- [x] `docs/design-bible.md`: copy the bible on disk, correct it, add a Stickers section.
- [x] Push both branches. — commits `2072d30`, `8f06dd8`

## Tasks — Phase 1

- [x] `scripts/stickers/`: pure core `buffer → {full, mask, thumb}` (trim, fit 512, pad, blur-threshold die-cut at r ≈ 3.5% of long edge, white fill under art, content hashes) with `sharp`.
- [x] Vendor the Noto Emoji set: ~40 con-culture emoji as 512px PNGs at a pinned ref, Apache 2.0 licence alongside; add the credit to the repo (and to the app's credits later, when there is a screen for it).
- [x] `scripts/stickers/ingest.ts` CLI: folder + optional manifest in; `--dry-run` writes to a local folder; idempotent; upload + row upsert when `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local` (dry-only otherwise, and say so).
- [x] Contact sheet from the dry run → `docs/stickers/shots/ingest-contact-sheet.png`; eyeball outline consistency and tune r.
- [x] Verify idempotency by re-running (no changed hashes / files). — re-run: 0 files written, index unchanged, md5 of every output identical; a from-scratch bake into an empty folder is byte-identical too. — commit `86422ee`
- [x] Render the die-cut sticker-button icon through the same pipeline (§2.1), for Phase 4. — `scripts/stickers/make-button-icon.ts`: a four-point sparkle in the palette's holo gradient (pink → holo → teal), die-cut by `makeSticker`.

Phase 1 notes (what I checked): contact sheet has all 45 on a dark ground, a light card-face ground, and
the mask; rims are one consistent weight, points round off, bays fill (whiskers, sparkle clusters,
dango), masks register with the art exactly. Sizes: full ≈ 40 KB, thumb ≈ 16 KB, mask ≈ 7 KB each;
bake ≈ 0.7 s per sticker.

## Tasks — Phase 2

- [x] Install the web repo's deps; run its checks as a baseline. — `pnpm check` had 5 pre-existing errors (`routes/admin/stickers/+page.server.ts`, `routes/dev/cards/+page.svelte`); still exactly those 5. `pnpm lint` failed on CRLF like the app → same `endOfLine: 'auto'` fix, `DESIGN.md` prettier-ignored; green now.
- [x] ~~Commit the four hand-applied app migrations into the web repo~~ → not done: one collides with a web migration's version number, so it needs your call (Needs Oskar). Instead `supabase/dev/live_schema_20260923.sql` reconstructs the live public schema from its catalogs, and the new migrations are tested on that.
- [x] Migration A — sticker definitions: `kind`, asset path columns, `art_aspect`, `rarity` (live lacks it), `fandom_id`; foil enum `cosmic`, `mosaic`; `combine_stickers()` ladder; `stickers` storage bucket (public read, service-role writes).
- [x] Migration B — fandom submissions: status / `submitted_by` / `style_category` on `fandoms`, 3-pending cap, name-length cap (derive from `fandom-layout.ts`), approval trigger → `stickers` row, RLS.
- [x] Migration C — placements: `MAX_STICKERS_PER_CARD` (20), scale 0.5–2, centre-in-card bounds; the free affiliation placement (`is_affiliation`), migrating `cards.affiliation*` into it.
- [x] Migration D — `collect_card()`: two-sticker grant (one per kind, uniform pick from the snapshot's placements, `STICKER_COPY_FOIL_CHANCE` = 0.10 roll server-side), `collection_sticker_grants`, snapshot v4 carrying kind + asset URLs / label + style category, grants in the response.
- [x] Test the migrations against a scratch Postgres if one's available (the web repo has `pnpm db:test`); otherwise dry-run the new CHECKs as SELECTs over live rows. — no local Postgres, so PGlite (Postgres in WASM, a web devDependency): `pnpm db:test:stickers` = auth + storage shims → live schema → migrations → `supabase/dev/test_stickers.sql`. Also dry-ran every new CHECK over live rows read-only: only the one scale of 2.09, which the migration clamps. Web `676abd0`.
- [x] Security review (`vibe-security` skill) of every new function and policy. — [security-review-phase2.md](security-review-phase2.md).
- [x] Hand-update `src/lib/database.types.ts` (app) and the web types. — app `788f4d3`, web `26a82a4` (web foil maps now climb to mosaic too).

## Tasks — Phase 3

- [x] Extend `STICKER_FOILS` to all five rungs; `PlacedSticker` carries `kind` + deco asset paths / fandom label + style (snapshot v4 shape) and `is_affiliation`; one placement → definition resolver. — `src/card/tiers.ts`, `src/card/types.ts`, `src/stickers/definitions.ts`, `assets.ts`, `constants.ts`.
- [x] Local fixtures from the dry run: a subset of baked stickers bundled under `assets/stickers/fixtures/` + a generated index, for `/dev/stickers` with no Supabase. — 14 stickers, 844 KB, `scripts/stickers/make-fixtures.ts` → `src/stickers/fixtures.generated.ts`.
- [x] One shared shimmer clock (a single shared value) that foiled stickers read; paused when nothing foiled is on screen. — `src/stickers/shimmer.tsx`, mounted at the root; its frame callback only runs while a foiled sticker is mounted and nothing has paused it.
- [x] Deco renderer: `full` image + the card's own foil engine clipped to `mask` (no second foil implementation). — `DecoSticker.tsx`, `StickerFoil.tsx`; engine change in `SkiaFoil.tsx` / `foil-sksl.ts` (card output verified unchanged: 0.026/255 mean diff on the foil-lab card).
- [x] Fandom stickers: accept every foil rung, masked to the renderer's own shape. — `FandomSticker` `silhouette` mode is the mask; native only (see Questions).
- [x] Make Skia render on the web target (CanvasKit) so screenshots can show foil at all — or record why not. — `index.web.js` loads CanvasKit before the router; `scripts/setup-skia-web.mjs` copies the wasm to `public/` (git-ignored). `package.json` `main` is now `index` (native `index.js` just imports `expo-router/entry`).
- [x] Rewrite `/dev/stickers`: every sticker at every foil, loose and on a card; a glitter sticker beside a glitter card. — `?tilt=x,y` pins a light for screenshots; `?perf=1` is the 20-sticker card.
- [x] Performance check: 20 foiled stickers on one card. — can't be measured headless; built as `/dev/stickers?perf=1` and put on the device checklist. Each foiled sticker is one Skia canvas (native: one Metal/GL surface each); if 20 stutters on device, Phase 8's fallback is one shared canvas per card.

Phase 3 notes (what I checked): tilted, the glitter sticker on the glitter card carries flecks of the card's size in the card's local hue (blue where the card is blue) — the light field lines up. The loose ladder reads as five distinct rungs. Found and fixed on the way: (1) sticker foil was screen-blended, but the card's foil actually lands as premultiplied source-over (Foil.tsx isolates its stack), so the sticker washed out where the card showed flecks — now composited the same way; (2) masking with `dstIn` left a 1-px foil line / faint box edge past the mask image on fractional-size canvases — now mask → foil `srcIn` → gloss `srcATop`.

## Tasks — Phase 4

- [x] Floating sticker button pinned bottom-right (safe area, clear of the swatch rail at every `stageLayout()`), die-cut icon, bevel + pressed-in state. — `src/card/editor/StickerButton.tsx`; the page's bottom padding grows by the button's height (and by the whole drawer while it's open) so nothing is stuck behind either.
- [x] Bottom-sheet drawer over the lower editor: Deco / Fandom switch, 4 columns × 4 rows visible, scrolls; available count > 0 only; count badge when > 1; order `sort_order` then foil desc; thumbnails. — `src/card/editor/StickerDrawer.tsx`. **5 columns** (tiles ≈ 65 pt on a 390 pt screen): four columns made a four-row sheet ~440 pt tall, covering most of the card.
- [x] Inventory source: live `sticker_inventory` + available counts when signed in; a local fixture inventory otherwise (the editor already runs Supabase-less). — `src/stickers/inventory.ts`, `live.ts` (works before and after the migrations), `local-catalog.ts`, store `sticker_inventory`.
- [x] Place: drag a tile out onto the card (tap-to-place at centre as fallback); new placements `size = 0.24`, scale 1, top z.
- [x] Move / pinch (0.5–2 clamp) / two-finger rotate on the card; last touched to the top; centre kept on the card. — `src/card/editor/StickerEditLayer.tsx`.
- [x] Remove by dragging back onto the drawer; returns to inventory.
- [x] Autosave placements (insert / update / delete on `sticker_placements`; local store when Supabase-less); 20 cap in the UI. — `src/stickers/use-card-stickers.ts`.
- [x] Screenshots: button at rest + pressed, drawer on both kinds, a card with stickers moved / scaled at both clamps / rotated / one removed. — driven by the harness's new `--actions` scripts (`docs/stickers/shots/phase-4/*.json`); commit `cf0f834`.

Phase 4 notes (what I checked): every shot above against §2.1/§2.2/§1.4. Found and fixed: on web a
sticker's `<img>` swallowed the drag (browser image-drag) — the art is now never the touch target.
Couldn't check headless: pinch and rotate (mouse has one pointer — clamp states were staged through
the store instead), haptics, and the live write path (no signed-in session here, and the live
schema predates the migrations).

## Tasks — Phase 5

- [x] Stickers tab reads the real inventory (live or local): Deco / Fandom switch + five foil filter chips; tiles with foil + counts. — `app/(tabs)/stickers.tsx`, `src/stickers/use-sticker-inventory.ts`.
- [x] Sticker detail: name, foil, owned / placed counts; **Combine** when ≥ 2 spare at one foil below mosaic → `combine_stickers()` (local: store) + a short reveal with the existing reveal/foil machinery. — commit `993c917`. There's no separate reveal component in the app (the binder only has a `revealed` flag), so the reveal is the foil engine's tilt driven by Reanimated, not a new animation system.
- [x] Delete `src/stickers/catalog.ts` (and anything else of the prototype glyph path) once nothing imports it. — also `DEMO_STICKER_GLYPHS`; `StickerLayer.tsx` went in Phase 3.
- [x] Fandom submission in `AffiliationRow`: "Submit a fandom", text field (24-char cap), live preview with the real renderer, submit → `submit_fandom()`; pending shows "In review", unselectable. — `src/card/editor/AffiliationRow.tsx`, `src/stickers/fandoms.ts`; commit `610ee6f`. Offline / signed out, a submission stays on the device "In review" (only the live project can approve).
- [x] Screenshots: inventory, detail, combine before/after, a pending submission.

## Tasks — Phase 6

- [x] Snapshots: read v4 (`card_snapshot.stickers[]` with kind / asset paths / label / style / is_affiliation) into `CardView`, keeping v2/v3 working; the affiliation drawn from its placement when present. — `src/card/snapshot.ts`.
- [x] Sync: read `stickers` (the grants) from the `collect_card` response, add them to the local inventory view, and keep the legacy `bonus_*` fallback.
- [x] Collect feedback (§2.5): a quiet line / small thumbnails of the granted stickers in the scan result and on the binder card. — `src/stickers/GrantLine.tsx`.
- [x] Binder cards draw stickers correctly at mini size (they already go through `CardOverlay`); check against the owner's card. — binder shot vs the fixture's placements: same stickers, positions, foils.
- [x] A faithful fixture of a v4 collect response, exercised through the real sync code path, with screenshots. — commit `b5328c6`; web `e0ca01d`.

## Tasks — Phase 7

- [x] Survey the web card (`Card.svelte`, `FoilFx`, `HoloFoilFx`, `StickerGlyph`, `lib/card.ts`, `/username`) and how it gets placements + definitions. — pre-spec card; CSS foil (`FoilFx`, glitter/holo looks only); own older bakes at a fixed 15.33% box; no fandom stickers (a gradient badge instead).
- [x] Deco stickers on web from the same baked assets (`full` + foil masked by `mask`), positioned by the same centre / size / scale / rotation / wobble maths as the app's `CardOverlay`.
- [x] Fandom stickers on web: port the generative renderer (`fandom-layout.ts`, `fandom-styles.ts`, `font-metrics.ts` are RN-free) as SVG, foil masked to its silhouette. — copied verbatim + `FandomSticker.svelte`; the foil mask lives inside the SVG because an SVG mask _image_ can't load web fonts.
- [~] Foil on web: the same five looks — reuse the app's SkSL? (WebGL/CanvasKit vs CSS) — decide, record, build. → **logged as a decision for Oskar** (Needs Oskar); the web keeps its CSS foil, now clipped to the new masks.
- [x] Web reads v4 snapshots + placements with definitions; `/username` and the binder. — `catalogFrom(stickers, fandoms)` carries style categories.
- [x] Side-by-side screenshots: the same card in the app (web target) and the web app. — web `4e53e67`, `3edc380`; web `/dev/stickers` runs on a placeholder `.env` (no real project) with `PUBLIC_STICKER_ASSET_BASE=/sticker-fixtures/`.

## Tasks — Phase 8

- [x] Performance: count what a card with 20 foiled stickers and a full drawer costs (canvases, images, frame callbacks); cut what's cheap to cut; list what needs a device to judge. — a foiled sticker = 1 Skia canvas + 2 decoded images (full or thumb, plus mask); plain = 1 image, no canvas, no clock; one shared frame callback for all sticker shimmer. Cut: thumbnails for small stickers; no foil canvases on minis. Needs a device: 20 foiled on one card, a drawer of foiled tiles. If either stutters, the next step is one shared canvas per card. Commit `e26198c`.
- [x] Security review of the client-side sticker code (RPC use, what's trusted, secrets). — no findings; appended to security-review-phase2.md.
- [x] Dead code: anything the sticker work orphaned; propose (not delete) the old foil lab engines. — proposal under Needs Oskar.
- [x] Docs: CLAUDE.md (stickers architecture + status), design bible stickers section, HANDOFF §9 marked with what was decided. — commit `a58a8fd`.
- [x] Final summary + device checklist. — the Phase 8 summary above.

## Log

- 2026-09-23 — Started Phase 0. No PROGRESS.md existed; created it.
- 2026-09-23 — Harness up; first screenshots of `/dev/cards` and `/dev/stickers` look right (card gallery + fandom sticker lab render on the web target; Skia foil absent there, as expected).
- 2026-09-23 — CLAUDE.md + design-bible.md done, branches pushed. Phase 0 done; starting Phase 1. `sticker-src/` doesn't exist (no placeholder PNGs from Oskar yet) → proceeding with the emoji set alone (§3.4).
- 2026-09-23 — Phase 1: pipeline, ingest, Noto set (45), contact sheet, button icon; idempotency verified. Committed `86422ee` + icon/credits. Starting Phase 2.
- 2026-09-23 — Phase 2: five migrations + PGlite test on the reconstructed live schema, security review, types in both repos. Web `676abd0`, `26a82a4`; app `788f4d3`. Starting Phase 3.
- 2026-09-23 — Phase 3: foil engine extended (FoilFill), deco + fandom renderers, shimmer clock, fixtures, web CanvasKit, /dev/stickers; every card screen on CardOverlay; StickerLayer deleted. Commits `7ba4ab9`, `71a6855`, `39a0ba0`. Starting Phase 4.
- 2026-09-23 — Phase 4: sticker button, drawer, on-card editing + autosave (live and on-device), harness `--actions`. Commit `cf0f834`. Starting Phase 5.
- 2026-09-23 — Phase 5: Stickers tab inventory + combine + reveal; fandom submission; prototype catalog deleted. Commits `993c917`, `610ee6f`. Starting Phase 6.
- 2026-09-23 — Phase 6: v4 snapshots, collect grants → binder + inventory, GrantLine, faithful collect fixture from PGlite, demo-scan username fix. App `b5328c6`, web `e0ca01d`. Starting Phase 7.
- 2026-09-23 — Phase 7: web sticker layer at the app's geometry, verbatim fandom renderer, v4 snapshots on web, side-by-side. Web `4e53e67`, `3edc380`. Foil engine + card-spec port logged for Oskar. Starting Phase 8.
- 2026-09-23 — Phase 8: thumbnails for small stickers, no foil on minis, client security review, CLAUDE.md + HANDOFF §9. All phases built; waiting on Oskar.
- 2026-09-24 — Review fixes to the editor's live write path (never yet run against a real server): a serial write chain per placement with editor-made ids (`b312f71`), the affiliation's turn across a fandom change (`234b861`), the affiliation out of the 20 cap (`fe0e640`), readable refusals + fandom names counted in characters (`0cc5521`); old foil lab engines deleted (`3d8316d`). Shots in `shots/review-fixes/`; `node scripts/stickers/check-write-chain.ts` exercises the chain.
- 2026-09-24 — Oskar's calls: same foil engine on both platforms, port the web card, delete the foil lab. Migrations: the affiliation left out of the cap, placement ids frozen into v4 snapshots, an explicit select grant on `collection_sticker_grants` (web `31e3bb1`). Web: editor ranges to the new checks, the card on the synced card spec, the app's SkSL through CanvasKit on one shared surface, CSS foil deleted, parity evidence in `docs/card-port/` (web `a888868`–`7266b6c`). App sticker ranges now match the checks.
