/**
 * The SkSL behind `SkiaFoil.tsx`: one shader core, four recipes.
 *
 * This module has no React Native imports on purpose. It is plain TypeScript
 * that turns the instrument panel below into shader source, so it can be run
 * from Node as well as from the app: `node scripts/foil-sksl.js mosaic` prints
 * exactly the source the phone compiles, which is how the recipes get checked
 * in the Skia Labs editor before they reach a device.
 *
 * ── THE RECIPE ───────────────────────────────────────────────────────────────
 * This is the TiltHologramCard stack (github.com/DongGukMon/TiltHologramCard)
 * as maths. That component draws a rainbow gradient over a pattern image,
 * clips both with a luminance mask that is a second gradient of two soft light
 * bands, and has every gradient read the same tilt-driven axis so colour and
 * bands travel together. Here that is: one `axis` number per pixel, a ramp
 * lookup on it, a band envelope on it, and a *material* that says how much of
 * the pixel is foil and how far that material shifts the axis.
 *
 * The four recipes differ only in the material:
 *
 *   sprayed  a photograph of sprayed paint. White = fleck, black = nothing.
 *   stars    four-point stars over fine dust. Same rule.
 *   linear   no texture: fine diagonal stripes computed in the shader, with
 *            the rainbow repeating across the face the way a linear holo does.
 *   mosaic   a baked facet map (scripts/make-foil-textures.py): every triangle
 *            carries its own phase, so each one lights at a different tilt,
 *            with bright seams between them.
 *
 * ── THE ONE RULE ─────────────────────────────────────────────────────────────
 * A material is sampled at `fragCoord` and never at a tilt offset. The
 * pattern is pinned to the card; only the light moves over it. A fleck that
 * crawls as you tilt is a sticker, not a finish.
 *
 * ── LIGHT DIRECTION ──────────────────────────────────────────────────────────
 * `u_tilt` is the finger in screen space (+x right, +y down). Every light term
 * multiplies it by LIGHT_DIRECTION, which is [-1, -1]: bands, rainbow and
 * glare all slide *away* from the finger, the way a fixed light reflects off
 * a card you tilt toward it. Same convention as the rest of the app.
 *
 * ── TUNING ───────────────────────────────────────────────────────────────────
 * Every look value below is baked into the SkSL as a `const`. Change one,
 * save, and Fast Refresh recompiles the shader on the phone. Uniforms are only
 * for what the shader cannot know at compile time: canvas, clock, finger, and
 * the texture.
 */

import { HOLO_STOPS } from '../../theme/palette';

/* ══════════════════════════════════════════════════════════════════════════
   INSTRUMENT PANEL — shared by every recipe.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Colour ──────────────────────────────────────────────────────────────── */

/**
 * Which ramp the foil cycles through.
 *  - `rainbow` is the full hue wheel, what the Skia Labs prototype drew.
 *  - `brand` is the style-guide ramp (pink -> holo -> teal -> warm).
 *  - `foil` is the saturated trading-card rainbow the blend-mode foil uses.
 */
const RAMP: 'rainbow' | 'brand' | 'foil' = 'rainbow';

const RAMP_BRAND = HOLO_STOPS.slice(0, 4);

/** The saturated trading-card rainbow the old blend-mode foil used. */
const RAMP_FOIL = [
	'rgb(255,119,115)',
	'rgb(255,237,95)',
	'rgb(168,255,95)',
	'rgb(131,255,247)',
	'rgb(120,148,255)',
	'rgb(216,117,255)'
] as const;

/** Colour purity. 0 = silver sheen, 1 = ramp as authored, 2 = candy. 0 - 2. */
const SATURATION = 0.85;

/** Which colour leads, as a position in the ramp. 0 - 1. */
const HUE_PHASE = 0.02;

/** Size of the per-fleck hue-scatter cells, in dp. Roughly one fleck. 3 - 12. */
const HUE_JITTER_CELL_DP = 6;

/* ── The light bands (the luminance mask) ────────────────────────────────── */

/* The reference mask is a five-stop gradient along the diagonal:
   transparent, white 0.8, transparent, white 0.7, transparent at
   0 / .35 / .5 / .65 / 1. Two soft streaks. These are those numbers. */

/** Peak brightness of the first and second streak. 0 - 1 each. */
const BAND_PEAKS: [number, number] = [0.8, 0.7];

/** How far the bands slide for a full-range drag, as a fraction of the
 *  reference travel (which is half a card). 0 - 2. */
const BAND_TRAVEL = 1.0;

/** The plain white sheen drawn in the bands over the whole face, on top of
 *  the material. The reference draws this at 0.3 / 0.2. 0 - 0.5. */
const SHEEN_STRENGTH = 0.16;

/* ── Material response ───────────────────────────────────────────────────── */

/** Extra bloom on lit foil, as a fraction of its colour. 0 - 1. */
const FLECK_BLOOM = 0.35;

/** How much foil still shows when no light is on it: the grey metallic glint
 *  of an unlit laminate. 0 - 0.4. */
const FLECK_REST = 0.08;

/* ── Spotlight glare ─────────────────────────────────────────────────────── */

/* One radial light source with a wide halo and a brighter core. It is drawn in
   two places, from these same numbers:
    - the shader uses it to light the material (flecks flare rainbow under it,
      same as inside the bands), and
    - `Foil.tsx` draws its warm white wash as the *gloss* layer, above the
      photo and text, via `glossGradient()` below. The shader sits under the
      card's content so the pattern never covers it; the gloss is the laminate
      on top, so the light still sweeps over the photo and the words.
   It follows the real tilt only, not the idle drift: a lamp does not wander,
   and the gloss layer has no clock to follow one with. */

/** Where the light rests with the card flat, in face coordinates. Slightly
 *  above centre so the core sits high on the photo rather than the bio. */
export const GLARE_REST: [number, number] = [0.5, 0.36];

/** How far it slides at full tilt, per axis, in face fractions. 0 - 0.8. */
export const GLARE_TRAVEL: [number, number] = [0.45, 0.45];

/** Radius of the soft halo, in card heights. 0.3 - 1.5. */
const GLARE_HALO_RADIUS = 1.2;

/** Radius of the brighter core, in card heights. 0.1 - 0.8. */
const GLARE_CORE_RADIUS = 0.44;

/** How much the glare lights the material under it. 0 - 1.5. */
const GLARE_LIGHTS_FOIL = 0.9;

/** The white wash the halo lays over the face. 0 - 0.5. */
const GLARE_WASH = 0.2;

/**
 * The extra brightness at the core's centre. 0 - 0.8.
 *
 * This has to be high to read at all: white at alpha `a` over a face adds
 * `a * (1 - face)`, so on a pale face most of it is lost. 0.12 was invisible
 * on every light background.
 */
const GLARE_CORE = 0.25;

/** Colour of the glare. Slightly warm reads as a lamp, pure white as a flash. */
const GLARE_TINT = '#fff7eb';

/** Squash of the glare on the vertical axis. 1 = round. 0.6 - 1. */
const GLARE_SQUASH = 0.85;

/* ── Viewing angle ───────────────────────────────────────────────────────── */

/* A real holo laminate barely shows face-on: the rainbow is diffraction, and
   it only turns toward you once the card leans. These fade the holo (the
   lit colour, the bands, the sheen) by how far the card is tilted. The gloss
   does not fade, since a lamp's reflection is there face-on too. */

/** How much of the holo shows looking straight at the card. 0 - 1. */
const VIEW_REST = 0.12;

/** Tilt below which the holo stays at VIEW_REST, as a fraction of full
 *  tilt. Keeps the idle drift from waking it up. 0 - 0.5. */
const VIEW_DEADZONE = 0.1;

/** Tilt at which the holo is fully out, as a fraction of full tilt. 0.2 - 1.4. */
const VIEW_FULL = 0.6;

/* ── Direction ───────────────────────────────────────────────────────────── */

/** Which way the light moves against the finger, per axis. -1 = opposite,
 *  the way a real reflection moves and the way the rest of the app does it. */
export const LIGHT_DIRECTION: [number, number] = [-1, -1];

/* ── Idle drift ──────────────────────────────────────────────────────────── */

/** Speed of the slow wander when nobody is touching the card, in rad/sec. */
const DRIFT_SPEED = 0.35;

/** How much virtual tilt the wander fakes. 0 freezes the resting card. */
const DRIFT_AMOUNT = 0.18;

/** How readily the drift yields to a real finger. 0.05 - 1. */
const DRIFT_FADE = 0.25;

/* ── Global / shape ──────────────────────────────────────────────────────── */

/** Master loudness of the holo. The glare and rim have their own strengths
 *  and are not scaled by this. 0 - 2. */
const FOIL_INTENSITY = 0.5;

/** Thickness of the lit lip around the card edge, in card heights. 0 - 0.05. */
const RIM_WIDTH = 0.012;

/** Brightness of that lip. 0 turns it off. 0 - 1. */
const RIM_STRENGTH = 0.3;

/** Anti-alias width at the card outline, in dp. 0.5 - 3. */
const EDGE_FEATHER_DP = 1.5;

/* ══════════════════════════════════════════════════════════════════════════
   RECIPES — what differs between the four finishes.
   ══════════════════════════════════════════════════════════════════════════ */

export const SKIA_RECIPE_NAMES = ['sprayed', 'stars', 'linear', 'mosaic'] as const;
export type SkiaRecipeName = (typeof SKIA_RECIPE_NAMES)[number];

/** The textures a recipe can sample. The `require()`s live in SkiaFoil.tsx,
 *  since this module also runs in plain Node. */
export const SKIA_TEXTURE_NAMES = ['spray', 'stars', 'mosaic'] as const;
export type SkiaTextureName = (typeof SKIA_TEXTURE_NAMES)[number];

export interface SkiaTextureLayout {
	/** `tile`: repeat copies of the source across the face, keeping its
	 *  aspect. `face`: stretch one copy over the whole face, no repeat. */
	fit: 'tile' | 'face';
	/** Source aspect, width / height. Keeps a tiled pattern undistorted. */
	aspect: number;
	/** How many copies span the card's width when tiled. */
	tiles: number;
}

export const SKIA_TEXTURE_LAYOUT: Record<SkiaTextureName, SkiaTextureLayout> = {
	/** A photograph of sprayed paint, 1200x800. Landscape, so it repeats
	 *  vertically on a portrait face. */
	spray: { fit: 'tile', aspect: 1200 / 800, tiles: 1.0 },
	/** Four-point stars over fine dust, rotated to portrait at asset time. */
	stars: { fit: 'tile', aspect: 352 / 626, tiles: 1.0 },
	/** The baked facet map, 5:7, drawn once over the face. */
	mosaic: { fit: 'face', aspect: 5 / 7, tiles: 1.0 }
};

export interface SkiaRecipe {
	/** Which material function the shader is built with. */
	material: 'flecks' | 'linear' | 'mosaic';
	/** Texture the material samples. `linear` needs none. */
	texture?: SkiaTextureName;

	/** How many ramp cycles fit across the card's diagonal. 0.5 - 3. */
	hueSpan: number;
	/** Light floor: how lit the material is even outside the bands and glare.
	 *  0 hides a finish entirely between streaks, which is right for flecks
	 *  and wrong for a full-coverage foil. 0 - 0.6. */
	restLight: number;

	/* flecks */
	/** Per-fleck hue scatter, in ramp cycles. Each fleck in a real foil sits
	 *  at its own angle and refracts a slightly different colour. 0 - 0.2. */
	hueJitter: number;

	/* linear */
	/** Stripes per card height. 20 - 160. */
	stripeFreq: number;
	/** How dark the gaps between stripes go. 0 = no stripes. 0 - 1. */
	stripeDepth: number;
	/** Stripe direction, degrees. 0 = vertical stripes. */
	stripeAngleDeg: number;
	/** Stripe profile. 1 = soft cosine, higher = thinner, sharper lines. */
	stripeSharp: number;

	/* mosaic */
	/** How far a facet's phase shifts its hue, in ramp cycles. 0 - 1. */
	facetHue: number;
	/** How far a facet's phase shifts the light bands, in axis units. The
	 *  bands are 0.3 apart, so 0.3 lets a facet be fully lit while its
	 *  neighbour is fully dark. 0 - 0.5. */
	facetBand: number;
	/** Brightness of the seams between facets. 0 - 1. */
	seamStrength: number;
	/** The dimmest a facet can be, before its own brightness. 0 - 1. */
	facetFloor: number;
}

const NONE = {
	hueJitter: 0,
	stripeFreq: 0,
	stripeDepth: 0,
	stripeAngleDeg: 0,
	stripeSharp: 1,
	facetHue: 0,
	facetBand: 0,
	seamStrength: 0,
	facetFloor: 1
};

export const SKIA_RECIPES: Record<SkiaRecipeName, SkiaRecipe> = {
	sprayed: {
		...NONE,
		material: 'flecks',
		texture: 'spray',
		hueSpan: 1.4,
		restLight: 0,
		hueJitter: 0.1
	},
	stars: {
		...NONE,
		material: 'flecks',
		texture: 'stars',
		hueSpan: 1.4,
		restLight: 0,
		hueJitter: 0.1
	},
	linear: {
		...NONE,
		material: 'linear',
		hueSpan: 2.4,
		restLight: 0.22,
		stripeFreq: 70,
		stripeDepth: 0.45,
		stripeAngleDeg: 45,
		stripeSharp: 1.6
	},
	mosaic: {
		...NONE,
		material: 'mosaic',
		texture: 'mosaic',
		hueSpan: 1.0,
		restLight: 0.1,
		facetHue: 0.5,
		facetBand: 0.3,
		seamStrength: 0.45,
		facetFloor: 0.55
	}
};

/* ══════════════════════════════════════════════════════════════════════════
   END OF PANEL — below here is machinery.
   ══════════════════════════════════════════════════════════════════════════ */

/** SkSL has no implicit int->float, so every number carries a decimal point. */
function f(n: number): string {
	return n.toFixed(6);
}

/** Parse `#rgb`, `#rrggbb` or `rgb(r,g,b)` into 0..1 components. */
function parseColor(c: string): [number, number, number] {
	const rgb = c.match(/rgba?\(([^)]+)\)/);
	if (rgb) {
		const parts = rgb[1].split(',').map((p) => Number(p.trim()));
		return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
	}
	let hex = c.replace('#', '');
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((ch) => ch + ch)
			.join('');
	}
	const n = parseInt(hex, 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A colour as an SkSL `float3` literal. */
function f3(c: string): string {
	const [r, g, b] = parseColor(c);
	return `float3(${f(r)}, ${f(g)}, ${f(b)})`;
}

/**
 * The gloss layer's size, as the halo's radii in face heights: [x, y]. The
 * layer is an ellipse this big, centred on the glare, and the gradient from
 * `glossGradient()` fills it edge to edge.
 */
export const GLOSS_RADII: [number, number] = [GLARE_HALO_RADIUS, GLARE_HALO_RADIUS / GLARE_SQUASH];

/**
 * The glare's white wash as a CSS radial gradient, for the gloss layer.
 *
 * Sampled from the same halo + core falloff the shader lights the flecks
 * with, so the two can't disagree about where the lamp is or how it fades.
 * White at alpha `a` drawn normally is exactly a screen blend of `a`, so the
 * layer needs no blend mode to match what the shader's glare used to add.
 * Samples bunch toward the centre, where the core's falloff is steepest.
 */
export function glossGradient(): string {
	const [r, g, b] = parseColor(GLARE_TINT).map((c) => Math.round(c * 255));
	const smooth = (x: number) => {
		const k = Math.min(Math.max(x, 0), 1);
		return k * k * (3 - 2 * k);
	};
	const N = 16;
	const stops: string[] = [];
	for (let i = 0; i <= N; i++) {
		const frac = Math.pow(i / N, 1.6);
		const dist = frac * GLARE_HALO_RADIUS;
		const halo = (1 - smooth(dist / GLARE_HALO_RADIUS)) ** 2;
		const core = (1 - smooth(dist / GLARE_CORE_RADIUS)) ** 2;
		const a = Math.min(1, halo * GLARE_WASH + core * core * GLARE_CORE);
		stops.push(`rgba(${r},${g},${b},${a.toFixed(4)}) ${(frac * 100).toFixed(2)}%`);
	}
	return `radial-gradient(ellipse closest-side at 50% 50%, ${stops.join(', ')})`;
}

/** Saturation control shared by every ramp. */
const SATURATE = `
float3 saturate3(float3 c) {
    float grey = dot(c, float3(0.299, 0.587, 0.114));
    return clamp(mix(float3(grey), c, ${f(SATURATION)}), 0.0, 1.0);
}`;

/** The full hue wheel: what the Skia Labs prototype drew. */
const RAMP_RAINBOW = `${SATURATE}

float3 rampAt(float t) {
    float3 p = abs(fract(t + float3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return saturate3(clamp(p - 1.0, 0.0, 1.0));
}`;

/**
 * A stop ramp as an unrolled if-chain over constants: SkSL has no arrays you
 * can index with a computed value. Identical to SkiaSmoke's.
 */
function rampFunction(stops: readonly string[]): string {
	const n = stops.length;
	const consts = stops.map((c, i) => `const float3 STOP_${i} = ${f3(c)};`).join('\n');
	const branches = stops
		.map((_, i) => {
			const next = (i + 1) % n;
			const test = i === n - 1 ? 'else' : `${i === 0 ? 'if' : 'else if'} (i < ${f(i + 0.5)})`;
			return `    ${test} { a = STOP_${i}; b = STOP_${next}; }`;
		})
		.join('\n');

	return `${consts}
${SATURATE}

float3 rampAt(float t) {
    t = fract(t) * ${f(n)};
    float i = floor(t);
    float k = smoothstep(0.0, 1.0, t - i);
    float3 a = STOP_0;
    float3 b = STOP_1;
${branches}
    return saturate3(mix(a, b, k));
}`;
}

const RAMP_SOURCE =
	RAMP === 'rainbow' ? RAMP_RAINBOW : rampFunction(RAMP === 'brand' ? RAMP_BRAND : RAMP_FOIL);

/**
 * The material functions. Each returns, for one pixel:
 *   .x  coverage   how much of this pixel is foil (0 = bare card)
 *   .y  hueShift   added to the ramp position, in ramp cycles
 *   .z  bandShift  added to the light axis, so this pixel lights at a
 *                  different tilt than its neighbours
 *   .w  seam       extra white light, for facet edges
 * `fragCoord` is in dp; `p` is card-centred and aspect-corrected, y from
 * -0.5 to 0.5. Neither contains tilt.
 */
const MATERIALS = {
	flecks: `
uniform shader u_tex;

float4 material(float2 fragCoord, float2 p) {
    // The image is black and white, so one channel is the whole texture.
    float fleck = float(u_tex.eval(fragCoord).r);
    float jitter = (hash21(floor(fragCoord / HUE_JITTER_CELL_DP)) - 0.5) * HUE_JITTER;
    return float4(fleck, jitter, 0.0, 0.0);
}`,
	linear: `
float4 material(float2 fragCoord, float2 p) {
    // Fine stripes across the sweep: the grain of a linear holo laminate.
    float s = dot(p, STRIPE_DIR) * STRIPE_FREQ;
    float stripe = pow(0.5 + 0.5 * cos(s * TAU), STRIPE_SHARP);
    float cov = mix(1.0 - STRIPE_DEPTH, 1.0, stripe);
    return float4(cov, 0.0, 0.0, 0.0);
}`,
	mosaic: `
uniform shader u_tex;

float4 material(float2 fragCoord, float2 p) {
    // The facet map: r = facet phase, g = seam, b = facet brightness.
    float3 t = float3(u_tex.eval(fragCoord).rgb);
    float phase = t.r - 0.5;
    float cov = mix(FACET_FLOOR, 1.0, t.b);
    return float4(cov, phase * FACET_HUE, phase * FACET_BAND, t.g);
}`
} as const;

/**
 * The shader source for one recipe.
 *
 * Conventions: `float` everywhere (never `half`, which is mediump and bands),
 * and ASCII only, since SkSL has no preprocessor and a stray smart quote is a
 * lexer error a long way from where it reads like one.
 */
export function buildSource(name: SkiaRecipeName): string {
	const r = SKIA_RECIPES[name];
	const stripeRad = (r.stripeAngleDeg * Math.PI) / 180;

	return `
uniform float2 u_resolution;  // canvas size in dp
uniform float  u_radius;      // corner radius in dp
uniform float  u_time;        // seconds since mount
uniform float2 u_tilt;        // finger in SCREEN space, -1..1, y down-positive

const float  TAU                = 6.2831853;
const float  HUE_SPAN           = ${f(r.hueSpan)};
const float  HUE_PHASE          = ${f(HUE_PHASE)};
const float  HUE_JITTER         = ${f(r.hueJitter)};
const float  HUE_JITTER_CELL_DP = ${f(HUE_JITTER_CELL_DP)};
const float  REST_LIGHT         = ${f(r.restLight)};
const float2 STRIPE_DIR         = float2(${f(Math.cos(stripeRad))}, ${f(Math.sin(stripeRad))});
const float  STRIPE_FREQ        = ${f(r.stripeFreq)};
const float  STRIPE_DEPTH       = ${f(r.stripeDepth)};
const float  STRIPE_SHARP       = ${f(r.stripeSharp)};
const float  FACET_HUE          = ${f(r.facetHue)};
const float  FACET_BAND         = ${f(r.facetBand)};
const float  FACET_FLOOR        = ${f(r.facetFloor)};
const float  SEAM_STRENGTH      = ${f(r.seamStrength)};
const float2 BAND_PEAKS         = float2(${f(BAND_PEAKS[0])}, ${f(BAND_PEAKS[1])});
const float  BAND_TRAVEL        = ${f(BAND_TRAVEL)};
const float  SHEEN_STRENGTH     = ${f(SHEEN_STRENGTH)};
const float  FLECK_BLOOM        = ${f(FLECK_BLOOM)};
const float  FLECK_REST         = ${f(FLECK_REST)};
const float2 GLARE_REST         = float2(${f(GLARE_REST[0])}, ${f(GLARE_REST[1])});
const float2 GLARE_TRAVEL       = float2(${f(GLARE_TRAVEL[0])}, ${f(GLARE_TRAVEL[1])});
const float  GLARE_HALO_RADIUS  = ${f(GLARE_HALO_RADIUS)};
const float  GLARE_CORE_RADIUS  = ${f(GLARE_CORE_RADIUS)};
const float  GLARE_LIGHTS_FOIL  = ${f(GLARE_LIGHTS_FOIL)};
const float  GLARE_SQUASH      = ${f(GLARE_SQUASH)};
const float  VIEW_REST          = ${f(VIEW_REST)};
const float  VIEW_DEADZONE      = ${f(VIEW_DEADZONE)};
const float  VIEW_FULL          = ${f(VIEW_FULL)};
const float2 LIGHT_DIRECTION    = float2(${f(LIGHT_DIRECTION[0])}, ${f(LIGHT_DIRECTION[1])});
const float  DRIFT_SPEED        = ${f(DRIFT_SPEED)};
const float  DRIFT_AMOUNT       = ${f(DRIFT_AMOUNT)};
const float  DRIFT_FADE         = ${f(DRIFT_FADE)};
const float  FOIL_INTENSITY     = ${f(FOIL_INTENSITY)};
const float  RIM_WIDTH          = ${f(RIM_WIDTH)};
const float  RIM_STRENGTH       = ${f(RIM_STRENGTH)};
const float  EDGE_FEATHER_DP    = ${f(EDGE_FEATHER_DP)};

${RAMP_SOURCE}

/** Live tilt, plus a slow idle wander that yields instantly to a real finger. */
float2 tiltNow() {
    float2 t = u_tilt;
    float2 drift = float2(sin(u_time * DRIFT_SPEED),
                          sin(u_time * DRIFT_SPEED * 1.5 + 1.2)) * DRIFT_AMOUNT;
    return t + drift * (1.0 - smoothstep(0.0, DRIFT_FADE, length(t)));
}

/** smoothstep with a guaranteed non-zero width. */
float softStep(float e0, float e1, float x) {
    return smoothstep(e0, max(e1, e0 + 0.0005), x);
}

/** Rounded-rect SDF, in card-centred units. Negative inside. */
float sdRoundRect(float2 p, float2 b, float r) {
    float2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0))) - r;
}

float hash21(float2 p) {
    p = fract(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

/**
 * The luminance mask from the reference: two soft streaks along the diagonal,
 * peaking at t = .35 and t = .65 and fading to nothing between and beyond.
 * Squared-off with a smoothstep so the falloff matches a premultiplied luma
 * ramp rather than a straight line.
 */
float lightBands(float t) {
    float b1 = BAND_PEAKS.x * clamp(t / 0.35, 0.0, 1.0)
             * (1.0 - clamp((t - 0.35) / 0.15, 0.0, 1.0));
    float b2 = BAND_PEAKS.y * clamp((t - 0.5) / 0.15, 0.0, 1.0)
             * (1.0 - clamp((t - 0.65) / 0.35, 0.0, 1.0));
    float b = b1 + b2;
    return b * b * (3.0 - 2.0 * b);
}
${MATERIALS[r.material]}

half4 main(float2 fragCoord) {
    // main() receives PIXELS (dp on this canvas), origin top-left, y down.
    // u_tilt is already in that same screen space, so every axis below can be
    // treated identically.
    float2 uv = fragCoord / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    float2 p = uv - 0.5;
    p.x *= aspect;

    float sd = sdRoundRect(p, float2(0.5 * aspect, 0.5), u_radius / u_resolution.y);
    float mask = 1.0 - softStep(0.0, EDGE_FEATHER_DP / u_resolution.y, sd);
    if (mask <= 0.0) { return half4(0.0); }

    // The finger, and the finger as the light sees it (opposite by default).
    float2 t = tiltNow();
    float2 lt = t * LIGHT_DIRECTION;

    // THE PINNED SAMPLE. fragCoord and p, never tilt -- see the header.
    float4 m = material(fragCoord, p);

    // The shared axis. In the reference both gradients run from a start that
    // slides with tilt to an end two card-sizes away; normalised to the face
    // that is one number along the diagonal, offset by tilt. The rainbow and
    // the bands both read it, which is why they travel together.
    float axis = (uv.x + uv.y + 1.0 - 0.5 * (lt.x + lt.y) * BAND_TRAVEL) * 0.25;

    float3 colour = rampAt(axis * HUE_SPAN + HUE_PHASE + m.y);
    float bands = lightBands(axis + m.z);

    // The spotlight: a wide halo and a brighter core, sliding with the light.
    // Real tilt only, no drift, so it stays under Foil.tsx's gloss layer.
    float2 glareCentre = GLARE_REST + u_tilt * LIGHT_DIRECTION * GLARE_TRAVEL;
    float2 gd = uv - glareCentre;
    gd.x *= aspect;
    gd.y *= GLARE_SQUASH;
    float g = length(gd);
    float halo = 1.0 - softStep(0.0, GLARE_HALO_RADIUS, g);
    float core = 1.0 - softStep(0.0, GLARE_CORE_RADIUS, g);
    halo *= halo;
    core *= core;

    // Everything that lights the material: the bands, the glare under it,
    // and the recipe's light floor.
    float lit = clamp(bands + (halo * 0.55 + core * 0.75) * GLARE_LIGHTS_FOIL, 0.0, 1.0);
    lit = max(lit, REST_LIGHT);

    // The viewing angle: face-on, the holo all but vanishes. Everything the
    // light turns into colour goes through this; the glare wash below does not.
    float view = mix(VIEW_REST, 1.0, softStep(VIEW_DEADZONE, VIEW_FULL, length(t)));
    lit *= view;

    // Coverage -> rainbow where lit, faint grey where not.
    float3 foil = colour * (m.x * lit) * (1.0 + FLECK_BLOOM)
                + float3(0.6, 0.6, 0.66) * (m.x * (1.0 - lit) * FLECK_REST);

    // Seams glow a little always and more where the light is.
    float3 seams = float3(m.w * SEAM_STRENGTH * (0.35 + 0.65 * lit));

    // The sheen (the reference's second, weaker gradient). The glare's own
    // white wash is not drawn here: it is Foil.tsx's gloss layer, above the
    // photo and text.
    float3 sheen = float3(bands * SHEEN_STRENGTH * view);

    float rim = (1.0 - softStep(RIM_WIDTH * 0.5, RIM_WIDTH, -sd)) * RIM_STRENGTH;

    float3 light = (foil + seams + sheen) * FOIL_INTENSITY + float3(rim);
    light = clamp(light, 0.0, 1.0);

    // Runtime effects return PREMULTIPLIED alpha. Alpha is the brightest
    // channel, so unlit (black) pixels are fully transparent and the face
    // shows through even where the platform drops the screen blend. Where the
    // blend does apply nothing changes: premultiplied screen ignores alpha.
    float a = max(light.r, max(light.g, light.b)) * mask;
    return half4(half3(light * mask), half(a));
}
`;
}
