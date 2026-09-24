# Concard Design Bible (copy)

> **What this file is.** A copy of the only design bible on this machine: the web repo's
> `DESIGN.md`, "Design & Brand Bible v0.1 — Creative Direction" (copied 2026-09-23 from
> `concard` `main` @ `cb2040b`). It is the brand and creative direction, reproduced verbatim below
> the line.
>
> The **product** Design Bible that `CLAUDE.md` cites by section (§6 card fields, §7 tiers and
> cooldown, §10 signup, §11 tabs, §12 chrome physicality) is a different document and is not on
> this machine; its section numbers do not match this one. It is logged in
> `docs/stickers/PROGRESS.md` under "Needs Oskar". When it arrives, it belongs in this file too.

## Corrections and divergences (read these first)

These are where the code and the live project differ from what a bible reader would assume. Each
is explained in `CLAUDE.md` → "Decisions that diverge from the design bible or the web app".

- **Web stack.** The web app is **SvelteKit 2 + Svelte 5** (TypeScript, Tailwind v4, Netlify
  adapter, pnpm), not Next.js. Repo: `oskargot/concard`, checked out at `../concard-web/concard`.
- **Collect cooldown** is **per person** (collector × owner), not per card, and it is **72 hours**
  (`collect_cooldown()`), not 24.
- **Glitter is earned in the app**; the web card's base face always glitters.
- **Card fields are a union** of the bible's list and what the web app already shipped.
- **Collected cards keep the `record` back** (no QR), so they can't be re-scanned remotely.
- **Bio cap** is 200 in the DB; the app's editor enforces 140.

## Stickers (summary of `docs/stickers/HANDOFF.md` §1)

The full spec, and the decisions table, are in `docs/stickers/HANDOFF.md`; where it and this file
disagree about stickers, the handoff wins.

- **Two kinds.** _Deco_ stickers are art, each generated from one transparent PNG with a baked
  die-cut outline; emoji are one more deco set (Noto Emoji, Apache 2.0), never live emoji text.
  _Fandom_ stickers are generative text, drawn from a fandom name and a style category; anyone can
  submit a name, and it goes live only once Oskar approves it. The two kinds are kept apart in
  every piece of UI. Packs are a future shop idea only.
- **Getting them.** Collecting someone's card gives you up to one deco and one fandom sticker,
  each a random copy of one placed on their card; they keep theirs. The copy is plain unless a
  10% roll lets it keep the original's foil. Everyone starts with a few. Choosing your own fandom
  places its sticker for free.
- **Foil ladder:** `none → glitter → holo → cosmic → mosaic`. Two of the same sticker at the same
  foil combine into one at the next rung. A foil looks identical on a sticker and on a card.
- **Placing.** Anywhere on the card, even hanging off the edge, as long as its centre stays on the
  card. Drag, pinch (0.5×–2×), rotate; the last one touched comes to the top; drag it back to the
  drawer to take it off. Up to 20 per card, plus your fandom's (it doesn't count). No save button.
- **Snapshots** keep stickers exactly as placed when the card was collected, forever.
- **Motion.** The only animation is foil shimmer; plain stickers are completely still.

---

CONCARD

Design & Brand Bible

v0.1 — Creative Direction

⸻

01 — THE IDEA

Concard is a social trading card app for people you meet in real life.

Every person has a card. You can share it with a QR code, collect cards from people you meet, and decorate your own card with stickers. Stickers can be purchased in packs or discovered as duplicates when collecting another person’s card.

The important distinction:

Concard is not a social network disguised as a trading card game.

It is a collection of memories disguised as a trading card collection.

The card represents a person. Collecting a card means:

I met this person.

That should always be felt underneath the interface.

⸻

02 — THE EMOTIONAL GOAL

Concard should make people feel:

* Curious
* Excited
* A little nostalgic
* Proud of their card
* Delighted when they discover something new
* Like they found a weird, charming little corner of the internet
* Like collecting people is fun without making people feel like commodities

The ideal reaction to Concard is not:

“Oh, that’s a clever social networking product.”

It is:

“Wait, this is adorable. I want one.”

And then:

“Oh shit, I want their card too.”

⸻

03 — THE BRAND PERSONALITY

Concard is:

Cute.
Not childish. Cute because it likes things.

Maximalist.
There is room for decoration, personality, stickers, patterns, shine, weird little details, and visual noise.

Playful.
Concard doesn’t take itself too seriously.

Social.
The product should feel like it was made to be shared between actual people.

Nostalgic.
It can borrow the emotional language of old personal websites, forums, collectible cards, sticker books, badges, and early social media.

Clean.
Nostalgia is an ingredient, not the aesthetic itself. The interface should still feel modern, readable, intentional, and easy to use.

A little weird.
Concard should have personality. Not everything needs to be optimized into a perfectly frictionless SaaS experience.

⸻

04 — THE CORE VISUAL CONCEPT

“The internet got a sticker collection.”

Concard should feel like:

* A trading card
* A sticker sheet
* A convention badge
* A personal webpage
* A collectible toy
* A holographic foil card
* A tiny digital object someone customized because they cared

…all filtered through a modern mobile interface.

The visual system should combine:

DARK

Deep, rich backgrounds provide the stage.

HOLO

Iridescence, pearlescent surfaces, chromatic highlights, foil-like gradients, and subtle light effects give cards physicality.

CUTE

Characters, icons, stickers, charms, stars, creatures, objects, and little visual jokes.

MAXIMALISM

Layering, decoration, overlapping elements, patterns, frames, badges, and visual texture.

RESTRAINT

The interface itself should remain understandable.

The card can be ridiculous.

The navigation should not be.

⸻

05 — THE OLD-WEB RULE

Concard should be old-web adjacent, not retro-web themed.

Do:

* Dense little collections of information
* Decorative UI
* Tiny badges
* Glossy buttons
* Personalization
* Tiled patterns
* Weird little icons
* Stickers
* Frames
* Sparkles
* Guestbook-like social energy
* “Someone made this” energy

Don’t:

* Fake Windows 95 interfaces
* Gratuitous pixel fonts
* Fake CRT effects
* Excessive pixel art
* Pretend the app is from 1999
* Make usability worse for nostalgia
* Turn every element into a joke

The goal is not:

“Look! Old internet!”

The goal is:

“This feels like the internet used to feel.”

Personal. Strange. Handmade. Exciting.

⸻

06 — WHAT CONCARD SHOULD NEVER FEEL LIKE

Avoid the following at all costs:

Generic AI startup

No:

* “Your identity, reimagined.”
* “The future of social connection.”
* “Where connections become collectibles.”
* “You are the card.”
* “Express yourself like never before.”

This language is technically understandable and emotionally dead.

Concard should sound like a person made it.

Corporate gamification

Avoid turning every action into:

* XP
* Levels
* Engagement
* Streaks
* Leaderboards
* Achievement badges
* Arbitrary points

Concard can be game-like without pretending that friendship is a productivity metric.

Crypto/NFT energy

Cards are collectible, but Concard should never imply ownership of people.

The user collects a representation of a memory, not a person.

Casino energy

Sticker packs can be exciting, but the visual language should feel like opening a pack of stickers or trading cards—not gambling.

Sterile minimalism

Don’t remove every decorative element in pursuit of “clean design.”

Clean ≠ empty.

⸻

07 — COPY VOICE

Concard’s voice should be:

Short. Casual. Playful. Human.

Prefer:

Nice pull.

over:

Congratulations! You have successfully added a new card to your collection.

Prefer:

You got a sticker!

over:

You’ve unlocked a collectible sticker.

Prefer:

Someone collected you.

over:

Your profile has been added to another user’s collection.

Prefer:

Oh, you got my card.

over:

Share your profile with others.

⸻

Copy principles

Say the thing.

Don’t dress simple actions up in startup language.

Let the UI have a personality.

Not every piece of copy needs to be funny, but the product should occasionally wink at the user.

Be enthusiastic.

Concard likes collecting things.

Don’t be overly cute.

One charming sentence is better than five exclamation points.

Don’t explain the metaphor constantly.

Once the user understands that cards represent people, let the metaphor speak for itself.

⸻

08 — KEY PHRASES

These are examples of the voice, not necessarily final product copy.

Collecting

New card!

Nice pull.

Added to your collection.

You met someone new.

Another one for the binder.

Sharing

Here’s my card.

Scan me.

Collect my card.

You found me!

Oh, you got my card.

Stickers

Sticker found!

You got a duplicate.

Free sticker!

Put it somewhere nice.

Your card needs more stickers.

Collection

Your collection

People you’ve met.

Look at all these guys.

Your cards

The people you’ve collected

Profile

My card

Make it yours.

Decorate your card.

That’s pretty good.

Needs more stickers.

⸻

09 — THE CARD IS THE STAR

The trading card should be the strongest visual object in Concard.

When a user opens a person’s profile, they should feel like they are looking at an actual collectible object—not a conventional social profile wearing a card-shaped border.

Cards should have:

* A strong frame
* A defined visual hierarchy
* Personality
* Texture
* Depth
* Decorative details
* Room for stickers
* A clear identity
* Optional rarity/foil-like visual treatments
* A sense of physicality

The card should look good enough that users want to screenshot it.

⸻

10 — STICKERS ARE NOT JUST DECORATION

Stickers are one of Concard’s primary pieces of identity.

They should feel like physical stickers someone would actually want.

Possible sticker categories:

* Animals
* Food
* Creatures
* Stars
* Charms
* Objects
* Tiny characters
* Convention references
* Seasonal stickers
* Event-exclusive stickers
* Holographic stickers
* Silly objects
* Strange little mascots

Stickers should be visually diverse.

A collection should eventually look like a messy sticker book assembled by one person over time.

That is desirable.

⸻

11 — THE DUPLICATE PRINCIPLE

When collecting another person’s card produces one of their stickers, the original sticker remains with them.

This is important.

The mechanic communicates:

Meeting someone gives you something.

Not:

Taking something from someone gives you something.

Duplicates should therefore be presented as gifts, discoveries, or echoes.

This is also an opportunity for delightful copy and animation.

For example:

Sticker found!

You found one of their stickers.

Then the sticker can appear as a new copy in the collector’s inventory.

⸻

12 — COLOR

The foundation should be dark.

Think:

* Near-black
* Deep charcoal
* Midnight tones
* Very dark purples/blues

Against that, introduce bright accents.

The accent palette should be allowed to become colorful:

* Electric purples
* Cyan
* Pink
* Acidic green
* Blue
* Yellow
* White
* Iridescent/chromatic gradients

However:

Do not make every element colorful simultaneously.

Dark space gives the colorful objects somewhere to shine.

⸻

13 — HOLOGRAPHIC EFFECTS

Holographic effects should communicate:

collectible object

not:

AI-generated sci-fi interface.

Good holo:

* Subtle chromatic shifts
* Pearlescent surfaces
* Rainbow reflections
* Iridescent borders
* Foil textures
* Light that moves across a card
* Occasional spectral gradients

Bad holo:

* Rainbow gradient slapped onto everything
* Excessive glassmorphism
* Glowing cyan/purple sci-fi dashboards
* Every button looking like a spaceship control panel

Holo should feel like foil.

Not “the future.”

⸻

14 — TYPOGRAPHY

Typography should balance personality with readability.

The primary interface font should be clean and contemporary.

Personality should come from:

* Display typography
* Labels
* Sticker text
* Badges
* Numbers
* Occasional decorative type

Avoid making the entire interface use a novelty font.

A cute display font is an accent.

It should not make the app difficult to read.

⸻

15 — ICONOGRAPHY

Icons should feel like they belong to the Concard universe.

Prefer:

* Rounded forms
* Chunky silhouettes
* Simple shapes
* Slightly exaggerated proportions
* Occasional hand-drawn imperfections

Avoid:

* Generic enterprise icon sets
* Extremely thin line icons
* Excessively serious geometric symbols

When possible, icons can have a little personality.

A heart doesn’t have to be merely a heart.

A collection icon doesn’t have to look exactly like every other collection icon on the internet.

⸻

16 — MOTION

Motion should make Concard feel physical.

Cards should feel like objects.

Good interactions include:

* Cards flipping
* Foil shifting when tilted
* Stickers popping into place
* Pack-opening animations
* Cards sliding into a collection
* Small celebratory sparkles
* Subtle bounce
* Sticker peeling
* Card stacking

Motion should generally be:

quick, tactile, satisfying.

Avoid:

* Long cinematic transitions
* Constant floating animations
* Excessive particle effects
* Motion for motion’s sake

The user should feel like they’re interacting with objects.

⸻

17 — PERSONALIZATION

Concard should actively encourage users to make their card their own.

A person’s card should communicate something about them before anyone reads the text.

Customization can include:

* Stickers
* Backgrounds
* Foils
* Frames
* Colors
* Badges
* Decorative elements
* Card variants

The product should reward taste and personality, not optimization.

There should be no “best” card.

The best card is the one that feels like its owner.

⸻

18 — SOCIAL DESIGN

Concard is fundamentally about real-world encounters.

The QR code is therefore not merely a technical feature.

It is a social gesture:

“Here, scan me.”

That moment should be extremely easy.

The path should feel almost physical:

Meet → Scan → Collect → Discover → Decorate

The app should make the first few seconds delightful enough that two people at a convention can use it together without needing an explanation.

⸻

19 — EVENTS

Conventions and events are an important part of Concard’s identity.

The product should eventually be able to make a collection feel like a record of where you’ve been.

Potential concepts:

* Event sets
* Event-exclusive stickers
* Convention badges
* Temporary card themes
* “Cards collected at [event]”
* Event collection pages
* Limited stickers
* Event-specific cosmetics

The philosophy:

Concard remembers who you met.

⸻

20 — DESIGNING FOR SCREENSHOTS

A Concard card should look good outside the app.

Users should want to:

* Screenshot their card
* Show it to friends
* Post it
* Put it in a Discord server
* Share it on social media
* Compare cards with friends

The card is simultaneously:

profile + collectible + social object + piece of personal art.

Design it accordingly.

⸻

21 — THE ANTI-AI RULE

Every part of Concard should pass this question:

Could this have been made by a person who genuinely loves weird little internet things?

If the answer is no, reconsider it.

Avoid the visual vocabulary that has become synonymous with generic AI product design:

* Purple-blue gradient backgrounds
* Floating glass cards
* Abstract glowing blobs
* Generic 3D objects
* Excessive neon
* Perfectly symmetrical futuristic UI
* “You are the future” copy
* Empty space pretending to be sophistication
* Generic sparkle effects
* Corporate illustrations

Concard should have specificity.

Specific things.

Specific stickers.

Specific jokes.

Specific textures.

Specific visual decisions.

A little imperfection is often better than another layer of polish.

⸻

22 — THE THREE-LAYER RULE

When designing a screen, think in three layers:

1. FUNCTION

What does the user need to do?

This must remain obvious.

2. OBJECT

What collectible/card/sticker/social object is the user interacting with?

This gets visual emphasis.

3. DELIGHT

What tiny thing makes this feel like Concard?

A sticker.
A sparkle.
A weird phrase.
A tiny animation.
A decorative badge.
A little character.

Do not sacrifice layer 1 for layer 3.

But do not build layer 1 and forget layers 2 and 3.

⸻

23 — BRAND IN ONE SENTENCE

If someone asks what Concard feels like:

A cute, maximalist digital trading-card collection for the people you meet.

If they ask for the vibe:

Old internet personality + collectible cards + stickers + holographic candy.

If they ask what it is really about:

Keeping a little piece of everyone you meet.

⸻

24 — THE NORTH STAR

Concard should make meeting someone feel collectible.

Not transactional.

Not algorithmic.

Not professional networking.

Not follower accumulation.

Collectible.

You meet someone at a convention.

You scan their card.

Their card appears in your collection.

You discover one of their stickers.

You put it on your own card.

Months later, you open Concard and see their card sitting next to everyone else you’ve met.

That is the product.

Everything else exists to make that experience better.

⸻

25 — FINAL DESIGN TEST

Before adding a feature, ask:

Does this make meeting, collecting, or personalizing more fun?

If yes, explore it.

If no, ask whether it strengthens the world of Concard.

If neither is true:

Don’t add it just because other social apps have it.

Concard doesn’t need to become Instagram with trading cards.

It needs to become Concard.