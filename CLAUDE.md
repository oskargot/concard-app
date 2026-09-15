# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Concard is an Expo/React Native (iOS + Android) app for meeting people at conventions, framed around
collecting each other's digital trading cards. It implements the app half of the **Concard Design
Bible** product spec. The web half (`concard.me` + public `/username` pages) lives in the separate
`concard` repository, which also owns the shared Supabase schema and migrations — coordinate schema
changes there, not here.

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
```

There is no test framework or build script configured. Before submitting changes, run `typecheck` and
`lint`, then verify affected flows in Expo Go — especially card rendering, tilt, and flip on both
platforms via `/dev/cards`, `/dev/foil-lab`, and `/dev/foil-sampler`.

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

The core product surface. `Card.tsx` composes three pieces that must stay in lockstep — this mirrors
the web app's `Card.svelte` and the two renderers must agree pixel-for-pixel, since a live card and a
frozen collection snapshot both reduce to one `CardView` (`src/card/types.ts`) and must never drift
from how they looked the day they were collected:

- `CardShell.tsx` — the physical shell: metal frame band (gradient), inset face, foil stack. Sizes
  everything off a single `width` prop using `u(n)` (`n cqw`, i.e. 1% of card width) since RN has no
  container queries. `shellMetrics()` is the shared geometry other code can hook into.
- `CardFace.tsx` — photo, name, handle, pronouns, bio, links: the content under the light.
- `CardOverlay.tsx` — stickers and the fandom badge, drawn _outside_ the face clip so they can hang
  over the card edge.
- `FlipCard.tsx` — owns tilt (drag) and flip (tap) via Reanimated `SharedValue`s, and hands the same
  `rx`/`ry` down to both faces so their light can never desync. At rest the card is a flat view (no
  `perspective`); on drag it promotes to a hardware texture and applies `rotateX/Y` to that bitmap
  instead of re-compositing text/gradients under perspective (that was the "glassy pixelation" fix).
- `card-style.ts` — style tokens (frames, backgrounds, shapes) **ported verbatim from the web app**
  and must stay in sync with it and with the `cards_style_shape` DB check constraint. Also derives
  text/hatch colors from the background (`inkFor`) so any background inverts to readable text.
- `tiers.ts` — the foil ladder. Two systems share one vocabulary here: **card tiers** (design bible
  §7, per card per collector, earned by repeat meetings) and **sticker foils** (web app enum, two
  copies at one tier combine into the next). `glitter` is a rung on both and must look identical in
  both places.

### The foil system (`src/card/foil/`)

`Foil.tsx` is a from-scratch port of the CSS trading-card foil technique, made possible by RN 0.86's
`mixBlendMode`, `experimental_backgroundImage` (gradient syntax), `filter`, and `isolation`. Two
deliberate departures from the CSS original, both load-bearing:

- CSS blends several backgrounds in one element via `background-blend-mode`; RN has no equivalent, so
  every layer here is its own `View` with its own `mixBlendMode`, stacked to the same effect.
- CSS animates `background-position` from pointer coords; here each moving layer is oversized and
  _translated_ by Reanimated instead, because a transform runs on the UI thread and a restyle doesn't.
  In production the per-layer `PARALLAX` table is empty on purpose — `FlipCard` already owns the
  physical 3D tilt, and translating foil layers every frame would invalidate the hardware texture that
  tilt depends on. The card tilting _is_ the light cue.

`RECIPES` maps each `FoilKind` (`none | glitter | holo | cosmic | mosaic`) to an ordered list of
layers; `DEFAULTS` holds each layer's blend mode and opacity. `gradients.ts` expands
`repeating-linear-gradient` (not supported by RN's parser) into explicit stops. `speckle.ts` generates
deterministic glitter/star/facet fields from a seed (pass the card id) so a card's sparkle pattern is
stable across renders. `FoilV2.tsx` / `recipes.tsx` are an experimental shine+glare engine, toggled via
`engine="v2"`; production code leaves `engine` unset (legacy).

**Why no Skia**: `@shopify/react-native-skia` isn't available in Expo Go, and shader-based foils would
force a development build. The blend-mode approach above needs nothing beyond what Expo Go ships, so
the whole renderer runs there. `/dev/foil-lab` exists specifically to check every layer (toggle,
blend-mode cycle, opacity) against real hardware on both platforms.

### The card editor (`app/card/edit.tsx`, `src/card/editor/`, `src/card/use-card-editor.ts`)

The card is the interface — there are no option panels. Three things follow from that and are
load-bearing:

- **`CardFace` edits itself.** It takes an optional `edit` prop and swaps its `Text` nodes for
  `TextInput`s carrying the identical style (`FaceText`). The editor deliberately has no copy of the
  face layout: that geometry is what keeps the app and the web card pixel-identical, and a forked
  editing renderer would be a second place for it to drift. With `edit` absent every branch collapses
  to what it drew before. `faceBands()` exports the same measurements so controls can sit beside the
  band they change.
- **Style axes are arrows in the gutter**, one per band — frame at the header, photo shape at the
  photo, bio alignment at the bio, outline at the bottom edge — plus swatch rails down the outer
  edges for the eighteen face colours. `stageLayout()` claims the gutters in priority order and drops
  the rails below the card rather than let it shrink past `COMPACT_BELOW`, where the face would
  collapse to a thumbnail mid-edit. `link_layout` has no control because `CardFace` does not render
  it yet — adding one before it draws would be a dead switch.
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

`palette.ts` / `tokens.ts` hold the "arcade dusk" palette and non-color tokens (design bible §12):
medium rounded corners, subtle glow on interactive elements, Fredoka for display type and Space
Grotesk for body. `src/ui/index.tsx` holds deliberately quiet chrome (`Button`, `Field`, `Panel`, …) —
flat raised surfaces with a real hairline, no gradients — because cards are meant to be the loudest
thing on screen.

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
  exactly what the cooldown is meant to prevent. Matches the web app's `collect_card()`.
- **Card fields are a union** of the bible's §6 list and the web app's existing fields (background
  tint, fandom badge) — nothing already shipping was dropped to match the bible.
- **`bio_align` / `link_layout` live in the `style` jsonb**, not as their own DB columns, despite the
  bible listing them as card fields — one check constraint to extend beats two new columns.
- **Bio cap stays at the DB's 200 chars**; the bible's 140 is enforced only in the app's editor, so
  cards already written by the web app remain valid.

## Status

Phase 2 of 7, plus the card editor. In: card renderer, foil lab, email/password auth, username claim,
forced first card, card editor (text in place, style, per-card links, affiliation, photo upload). Not
in: QR back, card switcher, stickers, photo pan/zoom, scanner + offline queue, binder, settings — Scan
and Binder tabs are currently placeholders. Nothing has been exercised against a live Supabase project
yet.

**The editor needs a migration this repo does not own.** `supabase/migrations/20260915000000_card_links_and_art.sql`
adds `cards.links` and the `card-art` storage bucket; copy it into the `concard` web repo and apply it
there. Until then the editor detects the missing column, saves everything else, and says so — links
are the only thing that won't persist.
