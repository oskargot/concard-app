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
- **@shopify/react-native-skia** for the foil shader (pinned to the Expo SDK 57
  version, `2.6.2`)
- **react-native-svg** for card silhouettes and the QR
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

Expo Go ships Skia on SDK 57, so the shader foil runs there
with no development build — confirmed on a physical device. This repo said
otherwise for a while; it was wrong.

Start the dev server with **`npm start`**, not a bare `npx expo start`.
`scripts/start.js` does two things the plain command gets wrong on this setup:
it advertises an address the phone can actually route to (a VPN or hypervisor
adapter otherwise wins, and the failure is quiet -- the bundle still loads
while Fast Refresh never connects), and it asks for Expo Go explicitly. It
prints which address it chose, and how to override it:

```sh
npm start              # Expo Go, on the best address it can find
npm start -- -c        # same, clearing Metro's cache
REACT_NATIVE_PACKAGER_HOSTNAME=<ip> npm start   # force an address
```

Keep Skia pinned to the version the SDK expects -- `npx expo install --check`
-- since Expo Go's native side is built against exactly that.

A shader that fails to _compile_ reports itself on the canvas, with the
offending source line, rather than going silently white.

### There is no development build any more

`expo-dev-client` used to be a dependency, from when Skia was believed to need
a custom build. It doesn't, and its presence alone made the Expo CLI hand out
`exp+concard://expo-development-client/?url=...` deep links that do nothing in
Expo Go -- so it was removed.

If a future native module does need one, add it back and rebuild:

```sh
npx expo install expo-dev-client
eas build --profile development --platform ios   # the profile is still in eas.json
npm start -- --dev-client
```

There is no Mac here, so `expo run:ios` can't build locally; the `development`
profile in `eas.json` is a dev client with internal (ad-hoc) distribution, and
`eas device:create` registers the iPhone. The checked-in `android/` directory
is from that era too.

## Layout

```
app/                    expo-router routes
  (auth)/               sign in · claim a username · first card (§10)
  (tabs)/               My Card · Scan · Binder (design bible §11)
  dev/foil-lab          every foil kind on a real card, through the production path
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
  foil/                 the foil: one SkSL shader, a recipe per kind
```

## The foils

The foils are the product: a Concard is meant to look like an object you would
screenshot. Each one is a single SkSL runtime shader, screen-blended over the
real card face, that emits only the light a holographic laminate would throw
back — it draws no card of its own and never darkens anything.

The recipe is the one from
[TiltHologramCard](https://github.com/DongGukMon/TiltHologramCard), as maths: a
rainbow read along one tilt-driven axis, two soft light bands read along the
same axis so colour and shine travel together, a spotlight glare, and a
_material_ that says how much of each pixel is foil. Four materials, one per
foil kind:

| Kind      | Recipe    | Material                                                         |
| --------- | --------- | ---------------------------------------------------------------- |
| `glitter` | `sprayed` | a photographed spray of paint flecks (`assets/foil/sprayed.png`) |
| `cosmic`  | `stars`   | four-point stars over fine dust (`assets/foil/stars.png`)        |
| `holo`    | `linear`  | fine diagonal stripes computed in the shader; no texture         |
| `mosaic`  | `mosaic`  | a baked facet map, every triangle lit at its own tilt            |

The mosaic map is not a picture: its channels are per-triangle phase, seam and
brightness, generated by `scripts/make-foil-textures.py`. Two rules hold across
all four: the material is sampled at `fragCoord` and never at a tilt offset, so
the pattern is pinned to the card and only the light moves; and every light
term slides _opposite_ the finger, the way a fixed light reflects off a card
you tilt toward it.

Every value that controls the look is a named constant at the top of
`src/card/foil/foil-sksl.ts`, baked into the shader source — edit, save, and the
phone recompiles. That module has no React Native imports, so
`node scripts/foil-sksl.js <recipe>` prints the exact SkSL for checking in the
[Skia Labs](https://skialabs.dev) editor first.

Tier 0 draws no shader: just the sliding glare every card has, and the edge lip
that gives a flat rectangle its thickness.

**`/dev/foil-lab` exists to check foils on real hardware, on both platforms.**
It runs every kind through the production card path while you tilt.

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

## Credits

- **Noto Emoji** — the emoji deco stickers are baked from Google's
  [Noto Emoji](https://github.com/googlefonts/noto-emoji) artwork (`v2.047`,
  `png/512/`), Copyright 2013 Google LLC, Apache License 2.0. The PNGs and the
  licence live in `sticker-src/noto/`; the baked stickers are derived works of
  them.
- **Outfit**, **Fredoka** and **Space Grotesk** fonts (`assets/fonts/`), SIL
  Open Font License 1.1.
- **Simple Icons** link-pill glyphs (`simple-icons`), CC0.
