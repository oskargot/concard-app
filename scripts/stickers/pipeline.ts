/**
 * PNG → deco sticker assets (HANDOFF §3.1). The pure core of the ingest:
 * `makeSticker(png)` takes one transparent PNG and returns the three baked,
 * immutable WebPs a deco sticker is drawn from. No filesystem, no network, so
 * it can later be lifted into an edge function for user-submitted stickers.
 *
 * All the expensive work happens here, once, so drawing a sticker is one image
 * (plus, if foiled, the foil clipped to the mask):
 *
 *  1. Trim transparent borders and fit the art to ART_EDGE on its long edge.
 *  2. Pad by the outline (and the shadow's reach).
 *  3. Die-cut: blur the alpha by a Gaussian and threshold it low. That is a
 *     smooth, rounded dilation of the silhouette — bays fill, points round —
 *     which is what a knife cutting around a sticker does. The outline width
 *     is a fixed fraction of the art's long edge, so every sticker's rim reads
 *     the same at the same on-card size.
 *  4. Emit:
 *     - full:  soft lift shadow → white die-cut → art. What's drawn.
 *     - mask:  the die-cut silhouette's alpha (white, no shadow). The foil
 *              clips to this, so foil covers the rim too, like a real foil
 *              sticker. Same canvas as `full`, so the two register exactly.
 *     - thumb: `full` at drawer size × 3.
 *
 * Everything is composed on straight-alpha float buffers by hand rather than
 * with sharp's composite, so the maths (and therefore the bytes) is exactly
 * what's written here.
 */

import { createHash } from 'node:crypto';
import sharp from 'sharp';

/** Bump when anything below changes the output, so every sticker re-hashes
 *  (new object names) instead of silently differing from what's uploaded. */
export const PIPELINE_VERSION = 1;

/** Long edge of the art before padding. */
export const ART_EDGE = 512;
/** Die-cut outline width as a fraction of ART_EDGE (HANDOFF: "start around 3.5%"). */
export const OUTLINE_FRACTION = 0.035;
/** Where the blurred alpha is cut. Low, so thin strokes still dilate fully. */
const THRESHOLD = 0.05;
/** Φ⁻¹(1 − THRESHOLD): at a straight edge the cut lands this many σ out. */
const THRESHOLD_SIGMAS = 1.6449;
/** Width of the anti-aliased band on the cut edge, in px. */
const EDGE_AA_PX = 1.2;

/** The die-cut paper. Same white as the fandom stickers' rim (`DIE_CUT_FILL`). */
export const DIE_CUT_RGB = [255, 255, 255] as const;

/**
 * The lift shadow: one soft, nearly centred shadow, so it still reads right
 * when a sticker is rotated. Ink colour and alpha match the web's baked die
 * cuts (`rgb(23 22 27)`), so a sticker sits on a card the same way everywhere.
 */
const SHADOW = { rgb: [23, 22, 27] as const, alpha: 0.28, sigmaFraction: 0.012, dyFraction: 0.006 };

/** Thumbnail long edge: drawer tiles draw the art at ~64 pt, × 3 density. */
export const THUMB_EDGE = 192;

/** Alpha (0..255) below which a pixel counts as transparent when trimming. */
const TRIM_ALPHA = 8;

export interface BakedImage {
	data: Buffer;
	width: number;
	height: number;
}

export interface StickerAssets {
	/** Content hash of the input PNG + this recipe; names the uploaded objects. */
	hash: string;
	full: BakedImage;
	mask: BakedImage;
	thumb: BakedImage;
}

/** The recipe the hash covers, so a tuned constant produces new names. */
export function recipe() {
	return {
		PIPELINE_VERSION,
		ART_EDGE,
		OUTLINE_FRACTION,
		THRESHOLD,
		EDGE_AA_PX,
		DIE_CUT_RGB,
		SHADOW,
		THUMB_EDGE
	};
}

export function stickerHash(png: Buffer): string {
	return createHash('sha256')
		.update(JSON.stringify(recipe()))
		.update(png)
		.digest('hex')
		.slice(0, 16);
}

export async function makeSticker(png: Buffer): Promise<StickerAssets> {
	const art = await trimAndFit(png);
	const outline = Math.round(OUTLINE_FRACTION * ART_EDGE);
	const shadowSigma = SHADOW.sigmaFraction * ART_EDGE;
	const shadowDy = Math.round(SHADOW.dyFraction * ART_EDGE);
	const pad = Math.ceil(outline + 3 * shadowSigma + shadowDy);

	const width = art.width + pad * 2;
	const height = art.height + pad * 2;
	const n = width * height;

	// Art, straight alpha, in 0..1 floats on the padded canvas.
	const rgba = new Float32Array(n * 4);
	for (let y = 0; y < art.height; y++) {
		for (let x = 0; x < art.width; x++) {
			const src = (y * art.width + x) * 4;
			const dst = ((y + pad) * width + (x + pad)) * 4;
			for (let c = 0; c < 4; c++) rgba[dst + c] = art.data[src + c] / 255;
		}
	}
	const artAlpha = new Float32Array(n);
	for (let i = 0; i < n; i++) artAlpha[i] = rgba[i * 4 + 3];

	// Die cut: blur, then a hard (anti-aliased) cut at THRESHOLD.
	const sigma = outline / THRESHOLD_SIGMAS;
	const blurred = blurChannel(artAlpha, width, height, sigma);
	// Slope of a blurred straight edge where it crosses the threshold,
	// φ(THRESHOLD_SIGMAS) / σ, turns the AA band from px into alpha units.
	const slope = Math.exp(-(THRESHOLD_SIGMAS ** 2) / 2) / Math.sqrt(2 * Math.PI) / sigma;
	const band = slope * EDGE_AA_PX;
	const cut = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const s = clamp01((blurred[i] - THRESHOLD) / band + 0.5);
		// The art can never poke outside its own rim.
		cut[i] = Math.max(s, artAlpha[i]);
	}

	// Shadow: the cut, blurred and nudged down.
	const shadowBlur = blurChannel(cut, width, height, shadowSigma);
	const out = new Uint8Array(n * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			const sy = y - shadowDy;
			const shadowA = sy >= 0 ? shadowBlur[sy * width + x] * SHADOW.alpha : 0;

			// shadow, then paper over it, then art over that — straight "over".
			let [r, g, b, a] = [SHADOW.rgb[0] / 255, SHADOW.rgb[1] / 255, SHADOW.rgb[2] / 255, shadowA];
			[r, g, b, a] = over(
				[DIE_CUT_RGB[0] / 255, DIE_CUT_RGB[1] / 255, DIE_CUT_RGB[2] / 255, cut[i]],
				[r, g, b, a]
			);
			[r, g, b, a] = over(
				[rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3]],
				[r, g, b, a]
			);

			out[i * 4] = to8(r);
			out[i * 4 + 1] = to8(g);
			out[i * 4 + 2] = to8(b);
			out[i * 4 + 3] = to8(a);
		}
	}

	const maskRaw = new Uint8Array(n * 4);
	for (let i = 0; i < n; i++) {
		maskRaw[i * 4] = 255;
		maskRaw[i * 4 + 1] = 255;
		maskRaw[i * 4 + 2] = 255;
		maskRaw[i * 4 + 3] = to8(cut[i]);
	}

	const raw = { raw: { width, height, channels: 4 as const } };
	const full = await sharp(out, raw)
		.webp({ nearLossless: true, quality: 80, alphaQuality: 100, effort: 6 })
		.toBuffer();
	const mask = await sharp(maskRaw, raw).webp({ lossless: true, effort: 6 }).toBuffer();

	const scale = THUMB_EDGE / Math.max(width, height);
	const thumbWidth = Math.max(1, Math.round(width * scale));
	const thumbHeight = Math.max(1, Math.round(height * scale));
	const thumb = await sharp(out, raw)
		.resize(thumbWidth, thumbHeight, { kernel: 'lanczos3' })
		.webp({ nearLossless: true, quality: 80, alphaQuality: 100, effort: 6 })
		.toBuffer();

	return {
		hash: stickerHash(png),
		full: { data: full, width, height },
		mask: { data: mask, width, height },
		thumb: { data: thumb, width: thumbWidth, height: thumbHeight }
	};
}

/** Trims fully transparent borders, then fits the long edge to ART_EDGE. */
async function trimAndFit(png: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
	const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const { width, height } = decoded.info;
	const px = decoded.data;

	let left = width;
	let top = height;
	let right = -1;
	let bottom = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (px[(y * width + x) * 4 + 3] > TRIM_ALPHA) {
				if (x < left) left = x;
				if (x > right) right = x;
				if (y < top) top = y;
				if (y > bottom) bottom = y;
			}
		}
	}
	if (right < 0) throw new Error('the PNG is fully transparent');

	const box = { left, top, width: right - left + 1, height: bottom - top + 1 };
	const long = Math.max(box.width, box.height);
	const fitWidth = Math.max(1, Math.round((box.width / long) * ART_EDGE));
	const fitHeight = Math.max(1, Math.round((box.height / long) * ART_EDGE));

	const fitted = await sharp(png)
		.ensureAlpha()
		.extract(box)
		.resize(fitWidth, fitHeight, { kernel: 'lanczos3', fit: 'fill' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data: fitted.data, width: fitted.info.width, height: fitted.info.height };
}

/**
 * Separable Gaussian blur of one float channel, edges clamped to zero (the
 * canvas is padded, so nothing real sits at the border). Done here rather
 * than through sharp so it is exact float maths with no bit-depth round trip.
 */
function blurChannel(
	channel: Float32Array,
	width: number,
	height: number,
	sigma: number
): Float32Array {
	const radius = Math.ceil(sigma * 3);
	const kernel = new Float32Array(radius * 2 + 1);
	let sum = 0;
	for (let k = -radius; k <= radius; k++) {
		const w = Math.exp(-(k * k) / (2 * sigma * sigma));
		kernel[k + radius] = w;
		sum += w;
	}
	for (let k = 0; k < kernel.length; k++) kernel[k] /= sum;

	const tmp = new Float32Array(channel.length);
	for (let y = 0; y < height; y++) {
		const row = y * width;
		for (let x = 0; x < width; x++) {
			let acc = 0;
			const from = Math.max(-radius, -x);
			const to = Math.min(radius, width - 1 - x);
			for (let k = from; k <= to; k++) acc += channel[row + x + k] * kernel[k + radius];
			tmp[row + x] = acc;
		}
	}
	const out = new Float32Array(channel.length);
	for (let y = 0; y < height; y++) {
		const from = Math.max(-radius, -y);
		const to = Math.min(radius, height - 1 - y);
		for (let x = 0; x < width; x++) {
			let acc = 0;
			for (let k = from; k <= to; k++) acc += tmp[(y + k) * width + x] * kernel[k + radius];
			out[y * width + x] = acc;
		}
	}
	return out;
}

type Rgba = [number, number, number, number];

/** Straight-alpha Porter-Duff "over": `top` over `bottom`. */
function over(top: Rgba, bottom: Rgba): Rgba {
	const a = top[3] + bottom[3] * (1 - top[3]);
	if (a <= 0) return [0, 0, 0, 0];
	const mix = (t: number, b: number) => (t * top[3] + b * bottom[3] * (1 - top[3])) / a;
	return [mix(top[0], bottom[0]), mix(top[1], bottom[1]), mix(top[2], bottom[2]), a];
}

function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

function to8(v: number): number {
	return Math.round(clamp01(v) * 255);
}
