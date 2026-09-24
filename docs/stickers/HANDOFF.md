# Stickers — Claude Code Build Loop Handoff

*Put this file at `docs/stickers/HANDOFF.md` in `concard-app`. It is the spec for the sticker feature and the operating manual for the loop that builds it. Where it conflicts with the design bible, CLAUDE.md, or the web app, this file wins for stickers. Where it's silent, the bible and CLAUDE.md win.*

---

## 0. How to use this document

You are running a long, mostly unattended build loop. Oskar checks in periodically, not continuously. That shapes every rule below:

- **State lives in files, not in your context.** Your context will fill and sessions will restart. `docs/stickers/PROGRESS.md` is the single source of truth for where the work stands. A fresh session with no memory must be able to read this file plus PROGRESS.md and continue correctly.
- **Don't block on questions.** If something is ambiguous, write it in the Questions section of PROGRESS.md, take the default listed in §9 (or the most conservative option if none is listed), note that you did, and keep working. Only the hard stops in §7 halt you.
- **Small, verified steps.** One task per iteration, each ending in a green typecheck/lint, screenshots where the task is visual, and a commit.

### Kickoff prompt (Oskar pastes this to start or resume a session)

> Read `docs/stickers/HANDOFF.md` and `docs/stickers/PROGRESS.md` in full, then `CLAUDE.md`. Continue the sticker build loop from where PROGRESS.md says it stands. Follow the loop protocol in §6 exactly. Don't ask me questions in chat — log them in PROGRESS.md and keep going.

---

## 1. What we're building

Stickers are collectible decorations people put on their cards. There are two kinds, kept separate everywhere in the UI:

- **Deco stickers** — art. Each one is generated from a single PNG. Emoji are just another set of deco stickers (rasterized, see §3.3).
- **Fandom stickers** — the existing generative text stickers (`src/stickers/FandomSticker.tsx`, `fandom-layout.ts`, `fandom-styles.ts`). Free-text names, submitted by users, approved manually by Oskar before they go live.

Within a kind, stickers aren't grouped; they're ordered by `sort_order`. Packs are a future shop concept only.

### 1.1 Getting stickers

**From collecting a card (the main source).** When you collect someone's card, you get *up to one* deco sticker and *up to one* fandom sticker, copied from the ones placed on that card. The owner keeps theirs; this is a copy.

- For each kind, pick one placed sticker of that kind uniformly at random. If the card has none of that kind, you get nothing for that kind.
- The copy's foil is usually `none`. With probability `STICKER_COPY_FOIL_CHANCE` (default **0.10**, one server-side constant, easy to tune) it inherits the foil of the sticker it was copied from.
- This is decided **server-side inside `collect_card`**, never on the client. The client must not be able to choose or influence the roll.
- It uses the same snapshot moment as the card snapshot (sync time), so the sticker you got is always one that's visible on the card you collected.
- Collect's existing per-person 24h cooldown applies; there's no separate sticker limit.
- This replaces the current single `bonus_sticker_id` mechanic.

**Starter stickers.** Keep the existing `grant_starter_stickers()` trigger. Update its set to real deco stickers once they exist.

**Your own affiliation.** Choosing your fandom in the editor (the existing affiliation picker) places that fandom sticker for free — it doesn't consume inventory. Additional fandom stickers on a card come from inventory like any other sticker. *(This is a decision made in drafting; see §9.)*

**Later, not in scope:** shop (packs), daily draw (one random sticker per kind per day), user-submitted deco PNGs. The data model must not block any of these. `stickers.source` already has `shop` and `drop`; a user-submitted deco sticker should be able to go through the same ingest pipeline as Oskar's PNGs (§3), just triggered differently.

### 1.2 Fandom submissions

Fandom names are free text. A user can submit a new fandom from the editor's affiliation picker. It's stored as `pending` and is **not usable anywhere** (not placeable, not grantable, not visible to other users) until Oskar approves it. The submitter sees it in the picker marked "In review." Oskar approves or rejects by flipping a status column in the Supabase dashboard — no admin UI in this scope.

Rendering isn't guaranteed to look good for every string; that's what review is for. Cap pending submissions at **3 per user** (server-enforced), and cap the name length at whatever `fandom-layout.ts` can reasonably fit (determine it, document it, and enforce it in both client and DB).

On approval, the fandom becomes a sticker definition (a `stickers` row of kind `fandom`), and its style category comes from `styleCategoryForFandom` or a column Oskar can set during review.

### 1.3 Foil tiers and combining

Stickers use the same foil vocabulary and renderer as cards. The sticker ladder is:

`none → glitter → holo → cosmic → mosaic`

Two copies of the same sticker at the same foil combine into one copy at the next rung. Foils must match. `mosaic` is the ceiling. Extend the `sticker_foil` enum and `STICKER_FOILS` in `src/card/tiers.ts`, and update `combine_stickers`. The CLAUDE.md rule still holds and now covers more rungs: **any foil that exists on both a card and a sticker must look identical in both places.**

Only placed-on-nothing copies count: `sticker_available_count` (owned minus placed) already encodes that a sticker on your card is "used." Removing a sticker from your card returns it to inventory.

### 1.4 Placing stickers

- Stickers can go anywhere on the card, overlapping anything, including hanging past the edge (`CardOverlay` already draws outside the face clip). Keep each sticker's **center** inside the card bounds so none can be lost off-card.
- Gestures: drag to move, pinch to scale, two-finger rotate. Scale clamps to **0.5×–2×** of the sticker's base size. Base size at 1× is `STICKER_BASE_WIDTH` = **24% of card width** (constant, tune by eye).
- The most recently touched sticker comes to the top (z-index).
- Remove by dragging the sticker back onto the drawer; it returns to inventory.
- Positions are stored as 0..1 of card size (existing `PlacedSticker` convention) so binder cards and web cards scale linearly and look identical.
- Soft cap: `MAX_STICKERS_PER_CARD` = **20**. Enforce it in the DB and the UI.
- Editing autosaves like the rest of the editor. No save button.

### 1.5 Snapshots

When a card is collected, its stickers freeze with it, exactly as placed. Later moves by the owner never change a collected snapshot. Sticker *identity* is the definition id plus foil, not the placement: if the owner moves a sticker and you collect them again, the copy you get is the same sticker and combines normally.

Snapshots must be self-sufficient, following the existing `Affiliation` pattern in `src/card/types.ts`. Extend `PlacedSticker` so a snapshot carries everything needed to draw it forever: `kind`, plus the immutable asset URLs for deco, or `label` and `style_category` for fandom.

Sticker definitions and their storage objects are **never deleted**. `is_active = false` retires a sticker from acquisition only; existing copies and snapshots keep rendering.

### 1.6 Animation

The only animation is foil shimmer. There's no idle bob or wobble. Stickers with foil `none` are fully static, in the drawer and on cards.

- On a card, sticker foil follows the card's own light (the same `rx`/`ry` `FlipCard` passes down), plus the same gentle idle shimmer cards get when there's no tilt input.
- In the drawer, foiled stickers use idle shimmer only.
- All shimmer runs off **one shared clock** (a single shared value), not one animation per sticker.
- Pause shimmer when the drawer is closed or the sticker is offscreen.

---

## 2. UI

### 2.1 The sticker button (card editor)

Move the sticker button out of the scroll flow in `app/card/edit.tsx`. It becomes a floating button **pinned bottom-right**, above the safe-area inset, in thumb reach, and it stays put while the editor scrolls. It must not cover the card's right-edge swatch rail at any `stageLayout()` configuration; adjust placement or the scroll content's bottom padding so nothing is ever unreachable behind it.

Its icon gets the **die-cut treatment**: a white outline around the glyph, the same outline the stickers have. If practical, run the icon through the same ingest pipeline (§3) so it's literally drawn like a sticker. It keeps the chrome's 3D physicality (bevel highlight, pressed state pushes in) from bible §12.

### 2.2 The drawer (inside the editor)

Tapping the sticker button opens a bottom sheet over the lower part of the editor. The card stays visible above it.

- A two-way switch at the top: **Deco / Fandom**.
- A grid showing **four full rows** at rest. It scrolls for more. Pick a column count that keeps tiles large enough to read on a 390pt-wide screen; state the choice in PROGRESS.md.
- Only stickers with available count > 0 appear, each with a small count badge when it's > 1. Foil is visible on the tile itself; don't put a text label on it.
- Order: `sort_order`, then foil descending within the same sticker.
- Drag a sticker out of the drawer onto the card to place it. Tap-to-place (drops it at card center) is an acceptable fallback if drag-out is unreliable on a platform; log it if you use it.
- Use thumbnails (§3.2) here, never full-size assets.

### 2.3 Stickers tab (inventory and combining)

`app/(tabs)/stickers.tsx` becomes your real inventory, replacing the prototype `STICKER_CATALOG`.

- The same Deco / Fandom switch, plus the existing foil filter chips (extended to all five rungs).
- Tapping a sticker opens detail with its name, foil, owned count, and placed count. If you have ≥2 available at the same foil and it's below `mosaic`, show a **Combine** action. Combining calls `combine_stickers` and plays a short reveal of the new foil using the existing reveal/foil machinery. Don't invent a new animation system.
- Delete `src/stickers/catalog.ts` and the glyph path in `StickerLayer.tsx` once nothing imports them.

### 2.4 Fandom submission

This lives in the existing `AffiliationRow` picker: a "Submit a fandom" entry at the end, with a text field, a live preview drawn with the real generative renderer, and a submit button. Pending submissions show in the picker as "In review" and can't be selected.

### 2.5 Collect feedback

When a synced collect grants stickers, show them. A short line or small sticker thumbnails in the scan result or on the binder card's reveal is enough. Keep it quiet; the card reveal is still the main event.

### 2.6 Visual rules

Everything follows the style guide and bible §12: neutral graphite chrome, the holo accent used sparingly, and cards (and now stickers) as the loudest things on screen. Chrome uses Outfit. The card face keeps its own fonts.

---

## 3. PNG → sticker pipeline

A deco sticker is generated from **one PNG with transparency**, and it must be cheap to render. So all the expensive work happens **once, at ingest**, never at draw time.

### 3.1 Ingest script

Create `scripts/stickers/ingest.ts` (Node + `sharp`; must run on Windows). The input is a folder of PNGs plus an optional manifest (name, kind, sort_order, rarity). For each PNG:

1. Trim transparent borders and fit to 512px on the long edge.
2. Pad by the outline width.
3. **Die-cut outline:** blur the alpha channel by radius *r*, then threshold it at a low value. That gives a smooth, rounded dilation of the silhouette, which is cheap and good-looking. Choose *r* as a fixed fraction of the long edge (start around 3.5%) so outlines look consistent across stickers. Fill the dilated silhouette white and composite the art on top.
4. Emit three immutable assets, named by content hash:
   - `full.webp` — outlined sticker, lossless or near-lossless WebP with alpha.
   - `mask.webp` — the dilated silhouette's alpha (the foil clips to this, so foil covers the outline too, like a real foil sticker).
   - `thumb.webp` — the outlined sticker at drawer size ×3 density.
5. Upload to a public `stickers` storage bucket under `stickers/<sticker_id>/<hash>-{full,mask,thumb}.webp`, with long cache headers. Objects are never overwritten; a changed PNG makes new hashes.
6. Upsert the `stickers` row with the new asset paths.

The script must be idempotent (re-running with unchanged input changes nothing) and support `--dry-run`, which writes outputs to a local folder so they can be eyeballed without touching Supabase. Commit a contact sheet image from the dry run (`docs/stickers/shots/ingest-contact-sheet.png`) so outline quality can be reviewed.

Upload needs a service-role key. It lives only in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY` (never `EXPO_PUBLIC_*`), and is read only by the script. **Add `.env` to `.gitignore`** while you're there; it currently only ignores `.env*.local`, and a `.env` was committed and deleted once already. If the key isn't present, the script runs dry only and logs that Oskar needs to run the upload himself.

The same pipeline should later be callable from an edge function for user-submitted stickers. Structure the core as a pure function (`buffer → {full, mask, thumb}`) so it can be lifted out, but don't build the edge function now.

### 3.2 Rendering a deco sticker

The render cost is: one image draw, plus, if foiled, the foil layers clipped to `mask.webp`. That's it. No runtime outline tracing, blurs, or per-frame filters. Use the same foil engine the card uses in production (see Phase 0; don't create a second foil implementation). The drop shadow, if any, should be one cheap shadow consistent with how cards sit on the velvet. Test that 20 foiled stickers on screen at once holds framerate on the drawer and card.

### 3.3 Emoji set

Emoji ship as PNG deco stickers from **one open-licensed emoji set**, never as live emoji text, because platform emoji fonts differ across iOS, Android, and web, which would break parity. Use **Noto Emoji** (Apache 2.0) 512px PNGs. Start with a curated set of ~40 that suit con culture (hearts, stars, sparkles, food, animals, faces) through the same ingest pipeline. Add the license notice to the repo and to wherever the app lists credits.

### 3.4 Placeholder art

Oskar will provide placeholder PNGs. Look for them in `sticker-src/` at the repo root. If the folder is empty, proceed with the emoji set alone and log it in PROGRESS.md.

### 3.5 Fandom stickers

Fandom stickers stay generative (no PNG), rendered by the existing renderer. They must accept every foil rung. Use the renderer's own shape (the text/badge geometry it already produces) as the foil mask, and give them the same die-cut outline language as deco stickers so the two kinds sit together naturally.

---

## 4. Data and backend

The schema is owned by the **`concard` web repo**. Write migrations there, as a proposal to be applied, following the existing convention in CLAUDE.md. Regenerate or hand-update `src/lib/database.types.ts` to match.

What already exists (verify against the live types before changing anything): `stickers` (`glyph`, `image_url`, `rarity`, `source`, `price_cents`, `sort_order`, `is_active`), `sticker_inventory` (per owner/sticker/foil quantity), `sticker_placements` (per card: x, y, rotation, scale, z_index, foil), `sticker_available_count()`, `combine_stickers()`, `grant_starter_stickers()`, `fandoms` (fixed list, `is_active`, `sort_order`), `cards.affiliation*` columns, and `collections.bonus_sticker_id` / `bonus_foil`.

Needed changes (design the exact shape yourself; justify it in the migration's header comment):

- `stickers`: add `kind` (deco | fandom), asset path columns for full/mask/thumb, and `fandom_id` for fandom stickers. Keep `glyph` nullable for backward compatibility until the prototype catalog is gone.
- `sticker_foil` enum: add `cosmic`, `mosaic` in ladder order. Update `combine_stickers()`.
- Fandom submissions: add a status (pending | approved | rejected) and `submitted_by` to `fandoms`, or add a separate submissions table; pick one and explain why. Enforce the 3-pending cap and length cap in the DB. On approval, create the matching `stickers` row (trigger). RLS: users see approved fandoms plus their own pending ones.
- Affiliation → placement: migrate `cards.affiliation` / `affiliation_x` / `affiliation_y` into a `sticker_placements` row flagged as the card's free affiliation (so it doesn't consume inventory). Keep the old columns until both clients stop reading them, then propose dropping them in a later migration.
- `collect_card()`: replace the single bonus with the two-sticker grant from §1.1 (random pick per kind from the snapshot's placements, foil roll server-side, increment `sticker_inventory`). Record what was granted in a way the client can show (a `collection_sticker_grants` table, or two nullable id/foil pairs on `collections`). Return the grants in the RPC's response.
- `sticker_placements`: enforce `MAX_STICKERS_PER_CARD`, the 0.5–2 scale clamp, and 0..1 position bounds in the DB, not only the UI.
- Storage: a public-read `stickers` bucket; writes only via service role.
- Run the repo's `vibe-security` skill against every new function and policy before marking the backend phase done.

---

## 5. Phases

Each phase has a goal and exit criteria. Tasks within a phase go into PROGRESS.md as a checklist when the phase starts; break them down yourself.

**Phase 0 — Orientation and ground truth.**
Confirm the web repo (`concard`) is cloned next to `concard-app`; if not, log it as a hard stop for web work and continue app-only phases. Identify the web app's actual framework (it's Svelte per `Card.svelte` references; confirm SvelteKit or otherwise). Settle the Skia question: CLAUDE.md says "no Skia, Expo Go only," but `package.json` has Skia and a dev client (PR #24). Determine which foil path is production and whether it runs in **Expo Go on iOS**, which is a hard constraint (§7). Update CLAUDE.md to reflect the truth. Copy the design bible into `docs/design-bible.md`, fix the web stack (Next.js → actual), note per-person cooldown and other CLAUDE.md divergences, and add a Stickers section summarizing §1 of this doc. Set up the verification harness (§6.2). Fix `.gitignore`.
*Exit:* PROGRESS.md exists, the harness produces a screenshot of an existing screen, and CLAUDE.md and the bible are accurate.

**Phase 1 — Ingest pipeline.**
Build §3.1 with a dry run over the emoji set and any placeholder PNGs.
*Exit:* a contact sheet committed; outlines look consistent; idempotency verified by re-running.

**Phase 2 — Schema (web repo).**
Write the §4 migrations and update types.
*Exit:* migrations written and security-reviewed. **This ends in a checkpoint:** applying migrations to the live project is Oskar's job (§7). Log it in "Needs Oskar," then move on to work that doesn't depend on it (Phase 3 and parts of 4 can run against local fixtures).

**Phase 3 — Renderer.**
Build the deco sticker renderer (image + masked foil), fandom stickers with foil, all five rungs, and the shared shimmer clock. Rewrite `/dev/stickers` to show every sticker at every foil, on a card and loose, with no Supabase needed (use local fixture assets from the dry run).
*Exit:* screenshots of `/dev/stickers` at every rung; glitter on a sticker is visually checked against glitter on a card side by side.

**Phase 4 — Editor: button, drawer, placement.**
Build §2.1, §2.2, and §1.4, with autosave to `sticker_placements`.
*Exit:* screenshots of the button at rest and pressed, the drawer on both kinds, and a card with stickers moved, scaled at both clamps, rotated, and one removed back into the drawer.

**Phase 5 — Inventory and combining.**
Build §2.3, remove the prototype catalog, and build §2.4 fandom submission.
*Exit:* screenshots of the inventory, detail, a combine before and after, and a pending submission.

**Phase 6 — Collect integration.**
Wire the two-sticker grant into sync and the binder, build §2.5, and extend snapshots per §1.5. Binder cards render stickers correctly at mini size.
*Exit:* a collect (against the live project once migrations are applied, or a faithful fixture if not yet) shows the grant, and the binder card matches the owner's card as it was.

**Phase 7 — Web parity (web repo).**
Render deco and fandom stickers with foil on the web card and `/username`, matching the app pixel-for-pixel per CLAUDE.md's parity rule.
*Exit:* side-by-side screenshots of the same card in the app (web target) and the web app.

**Phase 8 — Hardening.**
Performance pass (20 foiled stickers on a card and a full drawer), security review, dead-code removal, and final docs updates (CLAUDE.md, bible, this file's §9 marked with what was actually decided).
*Exit:* the "done" definition below.

**Done means:** Oskar can open the editor, see his stickers in the drawer, place, move, scale, rotate, and remove them; combine duplicates in the Stickers tab; submit a fandom; collect a card and receive its stickers; and see all of it identically on the web. Everything runs in Expo Go on his iPhone.

---

## 6. The loop

### 6.1 Protocol (every iteration)

1. Read PROGRESS.md. Pick the first unchecked task in the current phase that isn't blocked.
2. Implement it, keeping the change focused.
3. Run `npm run typecheck` and `npm run lint`. Fix until green. (The web repo has its own equivalents; find them in Phase 0.)
4. If the task is visual, run the screenshot harness and **look at the screenshots yourself** against this spec and the style guide. Fix what's wrong before moving on. Say in PROGRESS.md what you checked.
5. Commit with a short imperative subject (repo convention).
6. Update PROGRESS.md: check the task, add a one-line log entry, link screenshots, record any new question or default taken.
7. At a phase's end, write a short phase summary at the top of PROGRESS.md: what shipped, what to check on a device (§6.3), and anything Oskar needs to do.

Work on one branch per repo, `feat/stickers`, and open a **draft PR early** in each so Oskar can watch progress. Don't merge to `main`.

### 6.2 Verification harness

There's no Mac, so there's no iOS simulator. Autonomous screenshots come from Expo's **web target** in headless Chromium via Playwright:

- Add `npm run shots -- <route> [<route>…]`, which starts the web target if needed, visits each route at 390×844, and writes PNGs to `docs/stickers/shots/phase-N/`.
- If the web target doesn't currently render the app, making it render is a Phase 0 task.
- Prefer `/dev/*` routes (no Supabase) for renderer work. For flows that need data, use fixtures, not the live project.

Known limitation, which you should record rather than work around: react-native-web isn't native. Blend modes, Skia, and gestures can look or behave differently. Web screenshots prove layout and logic, not how foil *feels*. That's what device checks are for. An Android emulator on the Windows PC is an optional second harness if Oskar sets one up; don't install one yourself.

### 6.3 Device checks (Oskar, at phase ends)

Oskar runs the app in **Expo Go on his iPhone** at phase boundaries. Each phase summary lists specific checks, for example: "tilt a card with a glitter sticker next to a glitter card — do they match?" or "pinch a sticker to both clamps — does it stop cleanly?" Keep each list to five items or fewer. His feedback arrives in PROGRESS.md's Feedback section or in chat; treat it as top priority on resume.

---

## 7. Hard rules and stops

**Never:**
- Apply migrations or run write SQL against the live Supabase project.
- Put a service-role key or any secret in client code, `EXPO_PUBLIC_*`, or a commit.
- Delete sticker rows, storage objects, or collection snapshots.
- Add a dependency that breaks Expo Go on iOS. Oskar has no Apple Developer license yet, so a dev client can't be installed on his phone. If Phase 0 finds the production foil path already requires a dev build, stop that thread and log it as a decision for Oskar.
- Create a second foil engine. Stickers extend the card's.
- Change a decision in this document on your own. Log a proposal instead.

**Stop the loop entirely and wait if:**
- Typecheck or lint can't be made green after three honest attempts on the same task.
- A task needs credentials, a device, or access you don't have, *and* no other unblocked task remains.
- You're about to do anything destructive to data or history.

Otherwise, log and continue.

---

## 8. PROGRESS.md template

```markdown
# Stickers — Progress

## Current phase
Phase N — <name>. Status: in progress | waiting on Oskar | done

## Phase summaries
### Phase N — <name> (done YYYY-MM-DD)
Shipped: …
Check on device: 1. … (≤5)
Needs Oskar: …

## Needs Oskar
- [ ] <action> — blocking: <what>

## Questions (defaults taken)
- Q: … → took default: … (§9 ref)

## Feedback from Oskar
- …

## Tasks — Phase N
- [x] … — commit abc123 — shots: docs/stickers/shots/phase-N/…
- [ ] …

## Log
- YYYY-MM-DD HH:MM — …
```

---

## 9. Defaults and open decisions

These are the working defaults. Use them, and flag any that turn out wrong in practice.

| Decision | Default | Notes | Decided (build, 2026-09-23) |
|---|---|---|---|
| Chance a copied sticker keeps its foil | 10% | Server-side constant | As default: `sticker_copy_foil_chance()` = 0.10, rolled in `collect_card()` |
| Base sticker size | 24% of card width | Tune by eye | As default, measured on a deco sticker's **long edge** (its whole baked canvas) and a fandom sticker's width; older placements keep 15.33%, the affiliation 64/250 |
| Scale clamp | 0.5×–2× | From Oskar | As default, in the UI and a DB check |
| Max stickers per card | 20 | Soft cap, DB-enforced | As default, but the free affiliation doesn't count (20 + at most one affiliation) — reversed on review, 2026-09-24 |
| Sticker foil ladder | none → glitter → holo → cosmic → mosaic | Holo sits between glitter and cosmic; confirm it reads as an upgrade | As default; "reads as an upgrade" is on the Phase 3 device checklist |
| Pending fandom usable by submitter? | No | Shown as "In review" only | As default; a rejected name may be resubmitted |
| Pending submissions per user | 3 | | As default (trigger + RPC lock) |
| Own affiliation consumes inventory? | No, it's free | Extra fandom stickers do consume inventory | As default: an `is_affiliation` placement, foil none, skipped by `sticker_available_count()` |
| Drawer layout | Deco/Fandom switch, 4 rows visible, scroll | Column count: agent picks, logs it | **5 columns** (≈65 pt tiles); 4 made the sheet cover most of the card |
| Remove a sticker | Drag back onto drawer | Returns to inventory | As default |
| Emoji source | Noto Emoji PNG, Apache 2.0 | ~40 to start | 45, the 12 live ids kept; Noto's root LICENSE file is OFL at that tag, so both notices are vendored |
| Asset format | WebP with alpha, content-hashed | Immutable | As default; one hash per bake (source + recipe) names all three files, stored as bucket paths |
| Fandom name cap | — | §1.2: "whatever fandom-layout.ts can fit" | 24 characters (type holds its size to 20, ~85% at 24, halves by 36) |
| Web foil engine | — | Not covered | Open — logged for Oskar in PROGRESS.md |
