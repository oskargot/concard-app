# Stickers — Progress

## Current phase

Phase 0 — Orientation and ground truth. Status: in progress

## Phase summaries

_(none yet)_

## Needs Oskar

- [ ] **Open the two draft PRs.** `gh` isn't installed on this machine, so I can't open them. Branches are pushed: `concard-app` `feat/stickers` and `concard` (web) `feat/stickers`. Blocking: nothing; it only lets you watch progress on GitHub.
- [ ] **The product Design Bible isn't on this machine.** CLAUDE.md cites its §6 (card fields), §7 (tiers), §10 (signup) and §12 (chrome physicality), but the only "bible" on disk is the web repo's `DESIGN.md` ("Design & Brand Bible v0.1 — Creative Direction"), whose §12 is Color and which never mentions a web stack. I copied that one into `docs/design-bible.md` with a correction and stickers section; drop the product bible in there (or tell me where it is) and I'll fold it in. Blocking: nothing; I'm following CLAUDE.md, the style guide as implemented in `src/theme`/`src/ui`, and this spec.

## Questions (defaults taken)

- Q: HANDOFF §1.1 says collect has a "per-person 24h cooldown". Live `collect_cooldown()` returns **72 hours**, and the web repo's `docs/DESIGN.md` also says 72h. → took default: leave the server's 72h alone (the sticker grant just rides whatever the cooldown is); noted as a divergence in CLAUDE.md. (§1.1)
- Q: HANDOFF §0 Phase 0 says to confirm the web repo is "cloned next to concard-app". It's at `../concard-web/concard`, one level deeper. → took default: use it there; no move.

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
- [ ] Update CLAUDE.md to the truth (web repo location + stack, cooldown, foil lab files, harness, lint) and add a Stickers section summarising HANDOFF §1.
- [ ] `docs/design-bible.md`: copy the bible on disk, correct it, add a Stickers section.
- [ ] Push both branches.

## Log

- 2026-09-23 — Started Phase 0. No PROGRESS.md existed; created it.
- 2026-09-23 — Harness up; first screenshots of `/dev/cards` and `/dev/stickers` look right (card gallery + fandom sticker lab render on the web target; Skia foil absent there, as expected).
