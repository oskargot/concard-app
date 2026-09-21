# concard-app

The Concard mobile app — Expo (React Native), iOS and Android.

Concard is a social app for meeting people at conventions, framed around
collecting each other's digital trading cards. The product spec is the **Concard
Design Bible**; this repo implements the app half of §4. The web half
(`concard.me` + the public `/username` pages) lives in
[`concard`](https://github.com/oskargot/concard), which is also where the
Supabase schema and migrations live — both surfaces share one project.

## Stack

- **Expo SDK 57** / React Native 0.86 / React 19.2 — the whole app runs in Expo
  Go, Skia shader foil included
- **expo-router** for file-based navigation
- **react-native-reanimated** 4 + **gesture-handler** for tilt, flip and drag
- **react-native-svg** for the foils' dot and facet fields
- **@shopify/react-native-skia** for the shader-based foil (Stage C — pinned to
  the Expo SDK 57 version, `2.6.2`)
- **Supabase** for Postgres, Auth and Storage — shared with the web app

## Getting started

```sh
npm install
cp .env.example .env   # fill in from your Supabase project, Settings -> API
npx expo start
```

Without a `.env` the app shows a setup screen naming what is missing rather than
failing on every screen. The Supabase project is the same one the web app uses;
this branch needs the migration in `concard` that adds the per-card identity
columns.

Scan the QR with Expo Go. Then open **My Card → the foil lab**.

| Command             | What it does            |
| ------------------- | ----------------------- |
| `npm start`         | Dev server              |
| `npm run typecheck` | `tsc --noEmit`          |
| `npm run lint`      | ESLint + Prettier check |
| `npm run format`    | Prettier write          |

## Skia and Expo Go

Expo Go ships Skia on SDK 57, so `/dev/skia-smoke` and the shader foil run there
with no development build — confirmed on a physical device. This repo said
otherwise for a while; it was wrong.

A development build is still available (`expo-dev-client` is installed) and is
worth reaching for if you add a native module Expo Go does not carry, but
nothing in the foil path needs one today. Keep Skia pinned to the version the
SDK expects — `npx expo install --check` — since Expo Go's native side is built
against exactly that.

The route keeps a lazy require and an error boundary around the canvas. They no
longer guard a missing native module; they catch a **shader** that fails to
compile, which would otherwise be a silent white rectangle. A compile error is
reported on the canvas with the offending source line.

You build the dev client **once** (any time the native deps change), install it
on the phone, and after that iterate on JS with a normal `expo start`.

### One-time setup

```sh
npm install -g eas-cli   # or: npx eas-cli@latest
eas login                # your Expo account
eas init                 # links this repo to an EAS project, writes the projectId into app.json
```

### Build and install the dev client (iOS, from Windows)

There is no Mac here, so `expo run:ios` can't build locally — the dev client is
built in **EAS cloud**. The `development` profile in `eas.json` is a dev client
with internal (ad-hoc) distribution.

```sh
eas device:create        # register the iPhone once — follow the link/QR on the device to install the profile
eas build --profile development --platform ios
```

When the build finishes, EAS shows a QR / install link; open it on the registered
iPhone to install the app. (Android, if wanted later:
`eas build --profile development --platform android`, then install the `.apk`.)

### Day-to-day after it's installed

```sh
npx expo start --dev-client
```

Open the app you installed (not Expo Go) and it connects to this dev server;
Fast Refresh works exactly as in Expo Go. You only rebuild when a native
dependency changes — editing JS/TS never needs a new build.

## Layout

```
app/                    expo-router routes
  (auth)/               sign in · claim a username · first card (§10)
  (tabs)/               My Card · Scan · Binder (design bible §11)
  dev/foil-lab          every foil layer, individually switchable
  dev/skia-smoke        the SkSL holo finish over a real card (Stage C1)
  dev/cards             every card look on fixture data
src/auth/               session and profile state; the route gate
src/lib/                Supabase client, env, username rules, generated types
src/ui/                 buttons, fields, panels — deliberately quiet chrome
src/theme/              "dark velvet display case" palette (style guide) + tokens
src/card/               the card renderer
  card-style.ts         style tokens, shared verbatim with the web app
  tiers.ts              the foil ladder — card tiers and sticker foils
  CardShell.tsx         frame band, inset face, silhouettes
  CardFace.tsx          photo, name, handle, pronouns, bio, links
  FlipCard.tsx          owns tilt and flip; hands tilt to both faces
  foil/                 the foil renderer
```

## The foils

The foils are the product: a Concard is meant to look like an object you would
screenshot. They are a port of the CSS trading-card foil technique, which became
possible in **React Native 0.86** — it added `mixBlendMode` (the full CSS blend
set), `experimental_backgroundImage` (gradient syntax), `filter`, and
`isolation`.

Two deliberate departures from the CSS original:

- CSS `background-blend-mode` blends several backgrounds inside one element.
  React Native has no equivalent, so each layer is its own View with its own
  `mixBlendMode` and the stack does the same job.
- The CSS version animates `background-position` from pointer coordinates. Here
  each moving layer is oversized and **translated** by Reanimated instead,
  because a transform is driven on the UI thread and a restyle is not.

`repeating-linear-gradient` is not in React Native's parser, so
`foil/gradients.ts` expands repeating patterns into explicit stops.

### Skia (Stage C)

The blend-mode route above was built to avoid a native module. It got the foils
close but not to "physical holo", so Stage C uses **Skia** for real shader
control — which, as it turns out, costs nothing: Expo Go ships Skia (see "Skia
and Expo Go" above). This is a deliberate, staged bet, not a rewrite:

- **C0 (done):** Skia wired up, with a smoke canvas at `/dev/skia-smoke` proving
  it draws on a card-sized surface and answers the same `rx`/`ry` tilt the foils
  read.
- **C1 (this stage):** one real holo finish as an SkSL runtime effect
  (`src/card/foil/SkiaSmoke.tsx`), screen-blended over a real card at
  `/dev/skia-smoke`. It emits light only and draws no card, so it composites
  over the existing renderer rather than replacing it. Every value that controls
  the look is a named constant at the top of that file; edit and save to retune.
  Production foil is untouched.
- **C2:** the tier recipes (glitter / cosmic / mosaic) on top of that base,
  selectable in the foil lab and compared A/B against the blend-mode engines
  before anything switches.

The blend-mode engines stay until Skia clearly wins in the lab, and Skia is only
pulled into the card path — never unrelated screens.

**`/dev/foil-lab` exists to check foils on real hardware, on both platforms.**
Every layer can be toggled, its blend mode cycled and its opacity nudged while
you tilt the card.

## Decisions that diverge from the bible or the web app

These were resolved deliberately; each is worth revisiting.

| Topic                                     | Decision                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Glitter is earned**                     | The web card's base face carries a glitter layer (`.glint`). Here it does not: bible §7 makes tier 0 "holo base, no extra effect" and tier 1 Glitter, so a base card that already glittered would make the first upgrade invisible.                                                                                                                                                       |
| **One foil renderer**                     | Card tiers (`plain → glitter → cosmic → mosaic`) and sticker foils (`none → glitter → holo`) share `foil/Foil.tsx` and one vocabulary. `glitter` is a rung on both ladders and must look identical in both places.                                                                                                                                                                        |
| **Rate limit stays per-person**           | Bible §7 specifies 24hr per _card_, but with 5 cards per user that lets one person hand out five collects a day by swapping actives — the farming the same section says it prevents. The cooldown stays per `(collector, owner)` as the web app's `collect_card()` has it, and the meeting is credited to whichever card was active at scan time. Per-card tier progression is unchanged. |
| **Card fields are a union**               | The bible's §6 field list drops the web app's background colour (18 tints) and fandom badge, the two loudest personalisation levers already shipping. Both are kept, and the bible's additions (pronouns, per-card label, bio alignment, link layout) are added on top.                                                                                                                   |
| **`bio_align` / `link_layout` are style** | Bible §6 lists them as card fields. They live in the existing `style` jsonb with the other four axes rather than as their own columns, so there is one check constraint to extend instead of two columns to add.                                                                                                                                                                          |
| **Bio cap**                               | The column stays at 200 chars so cards written by the web app remain valid; the bible's 140 is enforced in the app's editor.                                                                                                                                                                                                                                                              |
| **Self-hosted fonts**                     | Outfit (app chrome) and Fredoka + Space Grotesk (card face, kept pixel-synced with the web card) ship as TTFs in `assets/fonts/` rather than via `@expo-google-fonts`. Same reasoning as the web app: a con hall is exactly where a third-party font request fails. (The wrapper packages also force a conflicting `react-dom`.)                                                          |

`react-dom` is pinned via `overrides` to `19.2.3`: `expo-router` pulls
`@expo/metro-runtime`, which depends on `react-dom@19.3.0`, whose `react` peer
(`^19.3.0`) conflicts with the `react@19.2.3` that Expo SDK 57 pins. `react-dom`
is only used by the web target, so matching it to `react` keeps the tree
resolvable.

## Status

Phase 2 of 7, plus the card editor and the meet loop.

- **In:** the card renderer and foil lab; email/password auth, the username claim
  and the forced first card; the card editor (text in place, style, per-card
  links, affiliation, photo upload); the meet loop end to end — My Card flips to
  a real QR (`EXPO_PUBLIC_SITE_URL || 'https://concard.me'` + username, the same
  contract the web scanner reads), the scanner parses that same URL (or a bare
  username) via `src/lib/username.ts`'s `usernameFromScan`, scans queue offline
  in `useConcardStore` and drain through `collect_card` in `src/store/sync.ts`,
  and the binder replaces its starter demo cards with a live `collections` read
  the first time a signed-in user is seen.
- **Not in:** the QR back on other card looks under `/dev/cards`, the card
  switcher, stickers inventory/combine/placement UI, photo pan/zoom, events,
  friends, DMs, purchases, settings.
- **Known gaps in the meet loop:** `tier`/`meeting_count` are computed
  client-side from `collections` rows (the schema has no running total, so this
  is a count query per owner, not a server-authoritative field); a collected
  card's fandom badge is dropped rather than rendered, since the snapshot's
  affiliation shape doesn't carry the app's `style_category` and drawing it
  needs a fandoms-table lookup this drain doesn't do; the events feature isn't
  wired, so a binder card's back shows "in person" rather than a venue.

Nothing has been run against a live Supabase project on a device yet — that
needs a real `.env` and two accounts to test the scan → collect → binder loop
end to end (see the handoff's manual test script).
