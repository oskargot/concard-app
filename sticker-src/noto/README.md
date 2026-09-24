# Vendored Noto Emoji artwork

Source: https://github.com/googlefonts/noto-emoji (`v2.047`), `png/512/`.
Copyright 2013 Google LLC. Upstream's README licenses its image resources under
the Apache License, Version 2.0 (notice in `LICENSE`, from upstream
`svg/LICENSE`) and its fonts under the SIL OFL 1.1. Upstream's root LICENSE
file at this tag is the OFL text; it is kept as `LICENSE-OFL` so nothing is
lost either way.

These are the PNGs `scripts/stickers/ingest.ts` bakes the emoji deco stickers
from; the app ships the baked WebPs, not these. The set itself is curated in
`scripts/stickers/emoji-set.ts`. Refresh with
`node scripts/stickers/fetch-noto.ts`.
