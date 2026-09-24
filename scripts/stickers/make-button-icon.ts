/**
 * The editor's sticker button icon (HANDOFF §2.1), drawn *as a sticker*: a
 * four-point sparkle in the holo gradient, run through the same die-cut
 * pipeline as every deco sticker, so its white outline is literally the
 * stickers' outline.
 *
 *   node scripts/stickers/make-button-icon.ts
 *
 * Writes `assets/stickers/button-icon.webp` (the pipeline's `full`, with its
 * baked lift shadow). Colours are the palette's holo gradient stops
 * (`pink` → `holo` → `teal` in src/theme/palette.ts).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { makeSticker } from './pipeline.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">
	<defs>
		<linearGradient id="holo" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#ffb3e0"/>
			<stop offset="0.5" stop-color="#b9c9ff"/>
			<stop offset="1" stop-color="#9ff0dc"/>
		</linearGradient>
	</defs>
	<path d="M50 2 C57 32 68 43 98 50 C68 57 57 68 50 98 C43 68 32 57 2 50 C32 43 43 32 50 2 Z" fill="url(#holo)"/>
	<path d="M50 13 C54 36 60 43 72 47 C60 46 53 42 50 13 Z" fill="#ffffff" fill-opacity="0.55"/>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
const sticker = await makeSticker(png);
const out = path.join(ROOT, 'assets/stickers/button-icon.webp');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, sticker.full.data);
console.log(
	`button icon ${sticker.full.width}x${sticker.full.height} -> assets/stickers/button-icon.webp`
);
