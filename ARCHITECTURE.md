# Architecture Overview

This document orients an agent (or a new contributor) working in `concard-app`. It reflects the
actual structure of this repository — a single Expo/React Native client — not a generic
frontend/backend split. See `CLAUDE.md` for deeper per-module rationale; this file is the map.

## 1. Project Structure

```
concard-app/                     # Expo/React Native app (this repo). Git root.
├── app/                         # expo-router file-based routes
│   ├── (auth)/                  # onboarding, login, username claim, forced first card
│   ├── (tabs)/                  # My Card · Scan · Binder · Stickers (main app shell)
│   ├── card/edit.tsx            # the card editor screen
│   └── dev/                     # card/foil preview screens — no Supabase needed
├── src/
│   ├── auth/                    # AuthProvider — session/profile state, route gating
│   ├── card/                    # the card renderer (the core product surface)
│   │   ├── editor/              # in-card style/photo/link editing controls
│   │   └── foil/                # the Skia shader foil (one SkSL core, a recipe per tier)
│   ├── stickers/                # fandom sticker catalog, layout, rendering
│   ├── store/                   # zustand store + Supabase sync (scan queue, collections)
│   ├── lib/                     # Supabase client, env handling, username/collect parsing,
│   │                            # generated DB types
│   ├── theme/                   # palette + design tokens ("dark velvet display case")
│   └── ui/                      # shared chrome kit (Button, Panel, Field, ScreenHeader, …)
├── assets/                      # self-hosted fonts (Outfit, Fredoka, Space Grotesk), images
├── supabase/migrations/         # migrations authored here but owned/applied by the `concard`
│                                # web repo (see §4 and §9)
├── scripts/                     # dev tooling (e.g. the `npm start` wrapper)
├── app.json                     # Expo config (bundle ids, deep-link domains, fonts, plugins)
├── package.json                 # dependencies and npm scripts
└── CLAUDE.md                    # detailed architecture notes per module (read this too)
```

There is no `backend/`, `frontend/`, or `common/` split: this repo is the mobile client only. The
server-side counterpart (web app + Supabase schema/migrations) lives in the separate `concard`
repository — see §3.2 and §4.

## 2. High-Level System Diagram

```
[Convention attendee]
        |
        v
[Concard mobile app]  (this repo — Expo/React Native, iOS + Android, via Expo Go)
        |
        |  supabase-js (REST/RPC over HTTPS, AsyncStorage-persisted session)
        v
[Supabase project]  (Postgres + Auth + Storage)
   - shared with the `concard` web app
   - schema/migrations owned by the `concard` repo
        ^
        |
[concard.me web app]  (separate repo: public /username profile pages, same DB)
```

Two Concard app instances interact indirectly through Supabase: one user's "My Card" screen shows
a QR encoding their profile URL; another user's "Scan" screen reads that QR and calls the shared
`collect_card` RPC, which writes a `collections` row read back by both apps' binders.

## 3. Core Components

### 3.1. Mobile App (this repo)

Name: Concard app

Description: The only client in this repo. Lets a user claim a username, build a digital trading
card (photo, name, bio, style, links), show it as a QR code, scan other people's cards to collect
them, and view a binder of everyone they've met. Routing and auth-status gating are handled by
`app/_layout.tsx` + `src/auth/AuthProvider.tsx`, which collapse session/profile state into one
`AuthStatus`: `unconfigured → signed-out → needs-username → needs-card → ready`.

Technologies: Expo SDK 57, React Native 0.86, React 19.2, expo-router (file-based routing),
react-native-reanimated 4 + gesture-handler (tilt/flip/drag), @shopify/react-native-skia (the foil
shader), react-native-svg (card silhouettes, QR), zustand (client state), TypeScript (strict).

Deployment: Distributed via Expo Go during development — including the Skia shader foil, since
Expo Go ships Skia on SDK 57 (see "Why blend modes, and where Skia fits" in `CLAUDE.md`). No CI/CD
or store deployment pipeline is configured in this repo at present.

Key subsystems (see `CLAUDE.md` for full detail on each):

- **Card renderer** (`src/card/`) — `CardShell` + `CardFace` + `CardOverlay` composed by
  `FlipCard`, mirroring the web app's `Card.svelte` pixel-for-pixel via a shared `CardView` shape
  (`src/card/types.ts`).
- **Foil system** (`src/card/foil/`) — one SkSL runtime shader (`foil-sksl.ts`, drawn by
  `SkiaFoil.tsx`) with a recipe per foil kind, screen-blended over the face by `Foil.tsx`.
- **Card editor** (`app/card/edit.tsx`, `src/card/editor/`, `src/card/use-card-editor.ts`) — the
  card edits itself in place (no separate form UI); autosaves via a debounced update.
- **The meet loop** (`app/(tabs)/card.tsx`, `scan.tsx`, `binder.tsx`, `src/store/`) — QR-based
  collection flow: scan → offline queue (`useConcardStore`) → `collect_card` RPC → binder.

### 3.2. External Counterpart (separate repository, not in this repo's scope)

Name: `concard` (web app)

Description: Serves `concard.me` and the public `/username` profile pages, and owns the shared
Supabase schema and migrations. Schema changes are coordinated there, not in this repo, even though
this repo may author a migration file under `supabase/migrations/` as a proposal to be copied over
(see §9).

Technologies: Not verified from this repo; treat as out of scope. Consult the `concard` repository
directly for its stack.

Deployment: Not managed from this repo.

## 4. Data Stores

### 4.1. Supabase Postgres

Name: Shared Concard database

Type: PostgreSQL (via Supabase)

Purpose: Stores users, profiles, cards, and the collection history that powers the meet loop. This
repo does not own the schema — the `concard` web repo does — but consumes it through
`src/lib/database.types.ts` (generated types) and reads/writes it via `supabase-js`.

Key tables/RPCs referenced by this app: `profiles`/users (username, session identity),
`cards` (per-card style/content — face fields, `style` jsonb holding `bio_align`/`link_layout`,
soon `links` per the pending migration), `collections` (one row per collect event, the source of
truth this app derives `tier`/`meeting_count` from client-side), and the `collect_card()` RPC
(rate-limited per `(collector, owner)` pair, not per-card — a deliberate departure from the design
bible, see `CLAUDE.md`).

### 4.2. Supabase Storage

Name: `card-art` bucket (added by a pending migration — see §9)

Type: Object storage (Supabase Storage)

Purpose: Holds uploaded card photos for the editor's photo-upload flow.

### 4.3. On-device state

Name: `useConcardStore` (zustand) + AsyncStorage

Type: In-memory store, persisted session via `@react-native-async-storage/async-storage`

Purpose: Holds the offline `scan_queue` (optimistic pending binder cards from a scan, drained by
`ConcardSync`/`src/store/sync.ts` once connectivity returns) and the Supabase Auth session (no
cookies on RN).

## 5. External Integrations / APIs

Service Name: Supabase (Auth, Postgres via PostgREST/RPC, Storage)

Purpose: Backend of record — authentication, all app data, and card photo storage. Shared with the
`concard.me` web app; this repo never owns migrations, only proposes them (see §9).

Integration Method: `@supabase/supabase-js` client (`src/lib/supabase.ts`), configured for RN with
AsyncStorage session persistence, `detectSessionInUrl: false`, and an `AppState`-driven auto-refresh
listener. `supabase: Client | null` is null when `.env` is unconfigured; every call site must guard
(`requireSupabase()` throws only for call sites already behind such a guard).

Integration Method (deep links): `EXPO_PUBLIC_SITE_URL`-based profile URLs
(`https://concard.me/<username>` by default) are encoded into the "My Card" QR and parsed back by
`src/lib/username.ts`'s `usernameFromScan`, ported verbatim from the web app so both surfaces accept
the same link shape. iOS `applinks:concard.me` and an Android `VIEW` intent filter are declared in
`app.json` for the same host.

## 6. Deployment & Infrastructure

Cloud Provider: Supabase (managed Postgres/Auth/Storage). No separate cloud infrastructure is
provisioned from this repo.

Key Services Used: Supabase project (shared with the `concard` web repo); Expo/EAS tooling is
present in the stack but no build/submit configuration exists in this repo yet.

CI/CD Pipeline: None configured in this repo at present (no `.github/workflows`). Local gates before
submitting changes are `npm run typecheck` and `npm run lint`, plus manual verification of card
rendering/tilt/flip in Expo Go via `/dev/cards` and `/dev/foil-lab`.

Monitoring & Logging: None configured in this repo.

## 7. Security Considerations

Authentication: Supabase Auth, email/password, session persisted client-side via AsyncStorage
(`bindAutoRefresh` keeps tokens fresh across app backgrounding).

Authorization: Enforced at the database layer (Postgres RLS / grants) owned by the `concard` repo —
see its migrations (this repo's own `supabase/migrations/` includes a
`security_hardening_sticker_count_and_grants.sql` file authored here but intended to be applied
there).

Data Handling: `EXPO_PUBLIC_*` env vars are inlined into the client bundle by Expo — never place
service-role keys or other secrets behind that prefix (`src/lib/env.ts` holds only the public
Supabase URL/publishable key and the public site origin). The QR/deep-link contract intentionally
encodes a stable username, never a session token, so a scanned/shared QR cannot be replayed as
credentials.

Key Practices: `missingSupabaseEnv` degrades to a setup screen instead of failing silently across
every screen when `.env` is absent or incomplete.

## 8. Development & Testing Environment

Local Setup Instructions: Copy `.env.example` to `.env` and fill in Supabase settings, then
`npm ci` and `npm start` (see root `README.md` and `CLAUDE.md` for the full command list and the
`/dev/*` preview routes).

Testing Frameworks: None configured — there is no test runner in this repo. Verification is
`npm run typecheck` (`tsc --noEmit`, strict), `npm run lint` (ESLint + Prettier check), and manual
exercise of affected flows in Expo Go.

Code Quality Tools: ESLint (Expo flat config) + Prettier (`npm run format` to auto-fix), TypeScript
strict mode.

## 9. Future Considerations / Roadmap

- **Pending schema migration not yet applied.** `supabase/migrations/20260915000000_card_links_and_art.sql`
  adds `cards.links` and the `card-art` storage bucket but is owned by (and must be copied into and
  applied from) the `concard` web repo. Until then, the editor detects the missing column, saves
  everything else, and reports that links won't persist.
- **Nothing has been exercised against a live Supabase project on a device**, per `CLAUDE.md`'s
  Status section — the scan → collect → binder loop between two real accounts is wired but untested
  end-to-end on hardware.
- **Not yet built:** card switcher, stickers inventory/combine/placement UI, photo pan/zoom, events,
  friends, DMs, purchases, settings (see `CLAUDE.md` §Status for the current phase, 2 of 7).
- **No CI pipeline or automated test suite exists** — a natural next step once the meet loop is
  verified live.

## 10. Project Identification

Project Name: Concard (mobile app)

Repository URL: `oskargot/concard-app` (this repo). Related: `oskargot/concard` (web app + shared
Supabase schema).

Primary Contact/Team: Oskar Hirsch (see repository ownership).

Date of Last Update: 2026-09-18

## 11. Glossary / Acronyms

- **Design Bible**: The Concard product spec this app implements the app-half of (referenced
  throughout `CLAUDE.md` as "the bible").
- **Card**: A user's digital trading card — the core content object, rendered by `src/card/`.
- **Tier**: The foil ladder for a _collected_ card, earned by repeat meetings between the same two
  people (`plain → glitter → cosmic → mosaic`), computed client-side from `collections` row counts.
- **Foil**: The shine/holo rendering effect applied to a card or sticker, implemented in
  `src/card/foil/`.
- **Sticker foil**: A separate foil vocabulary for stickers (`none → glitter → holo`) that shares
  code and the `glitter` rung with card tiers but is otherwise a distinct progression.
- **Binder**: The screen listing every card a user has collected (`app/(tabs)/binder.tsx`).
- **Collect / `collect_card`**: The act (and its backing Supabase RPC) of recording that one user
  scanned another's card, rate-limited per `(collector, owner)` pair.
- **CardView**: The single normalized shape (`src/card/types.ts`) both a live card and a frozen
  collection snapshot reduce to before rendering, so they can never visually drift.
