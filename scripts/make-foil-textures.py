"""
Bakes the foil textures that cannot be photographed.

    python scripts/make-foil-textures.py        # needs Pillow: pip install pillow

Writes assets/foil/mosaic.png, the facet map the `mosaic` recipe in
src/card/foil/SkiaFoil.tsx samples. It is not a picture of a mosaic; it is
three data channels the shader reads per pixel:

    R  facet phase      0..255 = which way this triangle faces. Every pixel of
                        one facet has the same value, so the whole facet lights
                        at the same tilt and neighbours light at different ones.
    G  seam mask        1 on the thin lines between facets, 0 inside them.
    B  facet brightness how strongly this facet reflects at all, so the field
                        is not uniformly loud.

The lattice is the same jittered triangle grid the blend-mode engine draws with
SVG (`facetField` in src/card/foil/speckle.ts): one shared set of jittered
vertices so adjacent triangles share edges exactly, with the split direction
alternating per cell so the facets do not read as stripes. It is deterministic
from SEED, so re-running the script reproduces the same file.

The image is 5:7 to match the card face and is drawn stretched to the face,
not tiled, so no seam of the texture itself is ever visible.
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw

SEED = 7
COLS, ROWS = 6, 8
WIDTH, HEIGHT = 1000, 1400
JITTER = 0.055  # of one cell, as facetField uses
SEAM_PX = 5  # at output resolution
SUPERSAMPLE = 3  # for the antialiased seam channel only

OUT = Path(__file__).resolve().parent.parent / "assets" / "foil" / "mosaic.png"


def lattice(rand: random.Random) -> list[list[tuple[float, float]]]:
    grid = []
    for r in range(ROWS + 1):
        row = []
        for c in range(COLS + 1):
            edge = r in (0, ROWS) or c in (0, COLS)
            jx = 0.0 if edge else (rand.random() - 0.5) * JITTER
            jy = 0.0 if edge else (rand.random() - 0.5) * JITTER
            row.append((c / COLS + jx, r / ROWS + jy))
        grid.append(row)
    return grid


def facets(rand: random.Random, grid) -> list[tuple[list[tuple[float, float]], int, int]]:
    out = []
    for r in range(ROWS):
        for c in range(COLS):
            tl, tr = grid[r][c], grid[r][c + 1]
            bl, br = grid[r + 1][c], grid[r + 1][c + 1]
            pair = [[tl, tr, br], [tl, br, bl]] if (r + c) % 2 == 0 else [[tl, tr, bl], [tr, br, bl]]
            for pts in pair:
                phase = rand.randrange(256)
                bright = int(255 * (0.45 + rand.random() * 0.55))
                out.append((pts, phase, bright))
    return out


def main() -> None:
    rand = random.Random(SEED)
    tris = facets(rand, lattice(rand))

    # R and B: flat fills, no antialiasing, so a facet's phase is one value
    # right up to its edge and never blends with the neighbour's.
    flat = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
    d = ImageDraw.Draw(flat)
    for pts, phase, bright in tris:
        d.polygon([(x * WIDTH, y * HEIGHT) for x, y in pts], fill=(phase, 0, bright))

    # G: seams, supersampled then downsampled so the lines are smooth.
    big = Image.new("L", (WIDTH * SUPERSAMPLE, HEIGHT * SUPERSAMPLE), 0)
    dbig = ImageDraw.Draw(big)
    for pts, _, _ in tris:
        poly = [(x * WIDTH * SUPERSAMPLE, y * HEIGHT * SUPERSAMPLE) for x, y in pts]
        dbig.line(poly + [poly[0]], fill=255, width=SEAM_PX * SUPERSAMPLE, joint="curve")
    seams = big.resize((WIDTH, HEIGHT), Image.LANCZOS)

    r, _, b = flat.split()
    Image.merge("RGB", (r, seams, b)).save(OUT, optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(tris)} facets)")


if __name__ == "__main__":
    main()
