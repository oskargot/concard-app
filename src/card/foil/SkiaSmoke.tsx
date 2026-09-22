/**
 * Stage C1: the holo finish, as one SkSL runtime shader.
 *
 * This is an *additive light overlay*. It draws no card — it emits only the
 * light a holographic laminate would throw back at you, and the caller screen-
 * blends it over the real card face (`mixBlendMode: 'screen'`, the same
 * mechanism every other engine in this folder uses). The shader therefore
 * cannot see what is underneath it, which is why there is no base colour and no
 * luma protection here: it adds light, it never darkens.
 *
 * ── TUNING ───────────────────────────────────────────────────────────────────
 * Everything that controls how this *looks* is a named constant in the block
 * below. Change a number, save, and Fast Refresh re-runs this module, rebuilds
 * the shader source and recompiles it — the change is on the phone immediately.
 * Nothing in the shader body needs reading to tune it.
 *
 * The rule that keeps it that way: **uniforms are only for what the shader
 * cannot know at compile time** — the canvas size, the clock, and the finger.
 * Every look value is baked into the source as a `const`, so a knob lives in
 * exactly one place and a typo is a compile error with a line number rather
 * than a crash on the render thread.
 *
 * If a compile does fail, the canvas is replaced by a red panel quoting the
 * error and the offending source line. It is never a silent white rectangle.
 *
 * ── THE RULE THIS SHADER IS BUILT AROUND ─────────────────────────────────────
 * A foil is light moving on a laminate that is *not* moving. The material —
 * the grain, the flakes, the UV they are sampled in — is pinned to the card,
 * and tilt may never touch it; tilt only changes the lighting terms (where the
 * glare sits, how far the hue has walked, which flakes are catching light).
 * A grain speck that crawls across the face as you tilt is the single thing
 * that makes this read as a sticker rather than a finish, so `u_tilt` must
 * never reach a grain coordinate. Every grain knob below is a *look* value;
 * none of them is a motion value.
 *
 * ── COST ─────────────────────────────────────────────────────────────────────
 * `u_time` is a uniform, so this canvas redraws at 60fps for as long as it is
 * mounted, even untouched. That is right for a hero card and wrong for a binder
 * grid of thirty. The fix there is to stop the frame callback when off-screen,
 * not to turn DRIFT_SPEED down — a frozen shader still redraws.
 */

import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import type { SkRuntimeEffect } from '@shopify/react-native-skia';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { palette, HOLO_STOPS } from '../../theme/palette';
import { space, type } from '../../theme/tokens';
import { TILT_RANGE } from '../FlipCard';
import { HOLO_SPECTRUM } from './gradients';

/* ══════════════════════════════════════════════════════════════════════════
   INSTRUMENT PANEL — every value that controls the look lives here.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Colour ──────────────────────────────────────────────────────────────── */

/** Which ramp the shine cycles through. Swap and save to compare the two. */
const RAMP: 'brand' | 'foil' = 'brand';

/** Style-guide ramp: pink -> holo -> teal -> warm. Pastel, on-brand, quieter.
 *  (HOLO_STOPS repeats its first colour at the end; the ramp already wraps.) */
const RAMP_BRAND = HOLO_STOPS.slice(0, 4);

/** The saturated trading-card rainbow the blend-mode foil uses. Louder. */
const RAMP_FOIL = HOLO_SPECTRUM;

/**
 * Colour purity. 0 = silver/grey sheen, 1 = ramp as authored, 2 = candy.
 *
 * Above 1 is worth reaching for with the brand ramp: those four stops are
 * pale, and a screen blend pushes pale colours toward white, so at 1.0 they
 * can all read as the same wash. RAMP 'foil' is the bigger lever if you want
 * obvious rainbow. 0 - 2.
 */
const SATURATION = 1.25;

/* ── Band pattern ────────────────────────────────────────────────────────── */

/**
 * How many rainbow bands cross the card. The loudest knob here.
 *
 * Below about 2 the card holds less than one full band, so there is a single
 * bright spot at its centre and the rest of the ramp only appears in the dim
 * surround. Raise this to put several peaks on the card at once.
 *
 * Kept low on purpose: tight candy stripes are what reads as a printed
 * pattern, and with the grain below carrying the fine detail the bands no
 * longer have to. 0.6 - 6.
 */
const BAND_FREQUENCY = 1.8;

/** Band edge definition. 0.5 = one broad wash, 1.5 = tight stripes. 0.5 - 1.5. */
const BAND_SHARPNESS = 0.85;

/**
 * How lit the card stays between the bright bands, as a fraction of a peak.
 *
 * This is what decides how much of the ramp you actually see: at 0 only the
 * bands themselves are coloured and everything between them goes dark, so the
 * card reads as one hue. Raising it trades band contrast for rainbow.
 *
 * It also decides how much of the face the grain shows on, since the grain
 * modulates this term: where the envelope falls to nothing there is no shine
 * left to texture. 0 - 0.8.
 */
const BAND_FLOOR = 0.45;

/**
 * How much of the colour wheel one brightness band crosses.
 *
 * Keep this off whole numbers. Hue and brightness share one phase, so at
 * exactly 1.0 (or 2.0, or 3.0) every band peaks on the same ramp position and
 * the card reads as one colour, with the others showing only where it is
 * dimmest. Off-integer values walk the peak around the ramp instead. 0.4 - 2.5.
 */
const HUE_SPREAD = 1.65;

/** Direction the bands run across the card, in degrees. 0 - 180. */
const SWEEP_ANGLE_DEG = 45;

/** Which colour the bands lead with, as a position in the ramp. A cosmetic
 *  reroll: it rotates the ramp without changing anything else. 0 - 1. */
const PATTERN_PHASE = 0.0;

/* ── Microstructure (the part that does NOT move) ────────────────────────── */

/* Two pinned fields, both sampled in card UV and never in tilt: a fine grain
   that gives the shine micro-contrast, and a sparse field of flakes that catch
   the light. Together they are what stops a smooth gradient reading as plastic.
   Because they are sampled in *card* space rather than pixel space they scale
   with the card, the way a printed laminate does, so a binder thumbnail gets
   the same finish as the hero and not a finer one. */

/**
 * How fine the grain is, in cells across the card's height.
 *
 * Aspect-corrected, so cells are square rather than stretched by the card's
 * 5:7 shape. Too high and it turns into even sandpaper that reads as sensor
 * noise; too low and it looks like marbling. 20 - 220.
 */
const GRAIN_SCALE = 56;

/**
 * How deeply the grain cuts into the shine. 0 is the smooth C1 gradient, 1
 * swings each speck between black and double brightness.
 *
 * It is centred on 1, so raising this adds texture without making the finish
 * brighter or dimmer on average. 0 - 1.
 */
const GRAIN_STRENGTH = 0.36;

/**
 * How much of that grain the glare also picks up. 0 = a clean optical
 * reflection, 1 = the glare is scattered by the same specks as the shine.
 *
 * Some is worth having: a glare with no structure in it is the giveaway that
 * the light is being drawn rather than reflected. Too much and the bright spot
 * gets dirty and the text under it stops being legible. 0 - 1.
 */
const GRAIN_GLARE = 0.35;

/** How fine the flake field is, in cells across the card's height. Each cell
 *  holds at most one flake, so this is also the upper bound on how many there
 *  can be. 40 - 320. */
const SPARKLE_SCALE = 150;

/** What fraction of those cells actually hold a flake. Above about 0.3 it
 *  stops reading as glitter and starts reading as static. 0 - 0.5. */
const SPARKLE_DENSITY = 0.14;

/** Flake size as a fraction of its cell. 1 fills the cell; lower leaves dark
 *  laminate between them, which is what makes them read as specks. 0.1 - 1. */
const SPARKLE_SIZE = 0.55;

/**
 * How far through its flash cycle a flake is carried by a full-range drag.
 *
 * This is the one place tilt touches the flake field, and it changes only
 * *brightness*: every flake has its own fixed angle it catches the light at,
 * and tilting sweeps that angle past them in turn. The flakes themselves do
 * not move — if they appear to travel, this is not the knob, something has
 * leaked tilt into a coordinate. 0 - 8.
 */
const SPARKLE_FLICKER = 3.0;

/** How briefly each flake flashes. 1 = every flake glows softly all the time,
 *  10 = a hard blink as the angle passes. 1 - 12. */
const SPARKLE_SHARPNESS = 5.0;

/** How bright a flake gets at its peak. 0 turns the flakes off entirely and
 *  leaves the grain. 0 - 1. */
const SPARKLE_STRENGTH = 0.38;

/**
 * How much a flake needs the light to be on it before it fires, as a blend
 * between the two.
 *
 * At 1 flakes only exist inside the glare and bloom, which is physically right
 * and can leave the rest of the card flat; at 0 the whole face glitters at
 * once, which reads as an effect layer. 0 - 1.
 */
const SPARKLE_LIGHT_GATE = 0.8;

/* ── Tilt response ───────────────────────────────────────────────────────── */

/**
 * How far the bands *slide* for a full-range drag, in band widths.
 *
 * This is the "pattern moves across the card" half of the response, and it is
 * deliberately the *quieter* half. On its own it reads as a printed pattern
 * being dragged around: a real laminate's microstructure does not travel, only
 * the light on it does. Above about 1.5 the bands start visibly crawling.
 * Keep it well under TILT_HUE_SHIFT. 0.4 - 6.
 */
const TILT_SENSITIVITY = 0.8;

/**
 * How far the *colour* shifts for a full-range drag, in ramp cycles, without
 * moving the bands.
 *
 * This is the half that reads as light rather than paint: a fixed point on the
 * card recolours as you tilt, instead of a pattern sliding past it. If the foil
 * looks painted on, raise this before TILT_SENSITIVITY — this is the knob that
 * carries the motion now, and it belongs well above it. 0 - 4.
 */
const TILT_HUE_SHIFT = 2.2;

/** Horizontal vs vertical drag weighting, [x, y]. A negative value reverses
 *  that axis' band sweep. Each -1.5 - 1.5. */
const TILT_AXIS_WEIGHT: [number, number] = [0.9, 0.6];

/**
 * Which way the light slides against your finger, per axis [x, y].
 * -1 = opposite, the way a real reflection moves. +1 = follows your finger.
 *
 * If a highlight ever tracks the wrong way, this is the knob -- not a sign
 * buried in the shader. Both the bloom and the glare read it.
 */
const LIGHT_DIRECTION: [number, number] = [-1, -1];

/* ── Highlight (the specular bloom) ──────────────────────────────────────── */

/** Size of the bright spot, in card heights. 0.2 - 1.2. */
const HIGHLIGHT_RADIUS = 0.25;

/** Edge of the spot. 0 = hard disc, 1 = pure falloff. 0 - 1. */
const HIGHLIGHT_SOFTNESS = 0.85;

/** How bright the spot gets. 0 - 1.5. */
const HIGHLIGHT_STRENGTH = 0.45;

/** How far it slides at full tilt. Direction is LIGHT_DIRECTION. 0 - 0.8. */
const HIGHLIGHT_TRAVEL = 0.35;

/* ── Circular glare (the light source) ─────────────────────── */

/* One light source fading out into a circle: brightest at its centre, gone by
   GLARE_RADIUS. It reads as a reflection sitting *on* the laminate, against
   the wide bloom above which reads as light coming through it. */

/**
 * How far the light reaches from its centre, in card heights.
 *
 * Aspect-corrected, so this is a true circle on screen rather than one
 * stretched by the card's 5:7 shape. Widening costs nothing in brightness --
 * the centre always peaks at GLARE_STRENGTH whatever the radius -- it only
 * spreads the falloff out further. 0.1 - 1.2.
 */
const GLARE_RADIUS = 0.42;

/** How quickly it fades. 1 = straight linear ramp to the rim, higher = a
 *  tighter hot centre with a longer faint tail. 0.5 - 5. */
const GLARE_FALLOFF = 2.2;

/** How bright the centre gets. 0 turns the glare off. 0 - 1.5. */
const GLARE_STRENGTH = 0.45;

/**
 * Where the light rests with the card held flat, in face coordinates: [0, 0]
 * is the face's top-left corner, [1, 1] its bottom-right.
 *
 * The default sits it high, over the top of the photo. On the card face the
 * name lands around y 0.08, the photo spans roughly 0.14 - 0.42, the bio
 * centres near 0.60 and the links near 0.88. Below about 0.1 the light starts
 * washing the name; below about 0.35 it starts reaching the bio.
 */
const GLARE_REST: [number, number] = [0.5, 0.16];

/**
 * How far it slides at full tilt, per axis [x, y]. Direction is
 * LIGHT_DIRECTION.
 *
 * Vertical is damped on purpose: at these values the centre stays inside
 * 0.04 - 0.28, so a hard drag cannot swing the light down onto the bio. Raise
 * y only as far as the text can take it. Each 0 - 0.8.
 */
const GLARE_TRAVEL: [number, number] = [0.3, 0.12];

/** 0 = white light, 1 = fully tinted by the holo band under it. 0 - 1. */
const GLARE_TINT = 0.25;

/* ── Idle drift ──────────────────────────────────────────────────────────── */

/** Speed of the slow wander when nobody is touching the card, in rad/sec.
 *  0 stops the motion (but not the redraw — see COST above). 0 - 1.5. */
const DRIFT_SPEED = 0.35;

/** How much virtual tilt the wander fakes, in the same units as a real drag.
 *  0 freezes the resting card completely. 0 - 0.5. */
const DRIFT_AMOUNT = 0.18;

/** How readily the drift yields to a real finger, as a fraction of full tilt.
 *  Lower yields sooner. At 0.25 it is gone within 2.5 degrees. 0.05 - 1. */
const DRIFT_FADE = 0.25;

/* ── Global / shape ──────────────────────────────────────────────────────── */

/**
 * Master loudness of the whole finish: subtle sheen vs. full rainbow.
 * This is the dial to reach for first.
 *
 * Trimmed slightly when BAND_FLOOR went up: a higher floor lights the gaps
 * between the bands, and holding this where it was would have made the whole
 * overlay brighter rather than just better lit. Between them the finish adds
 * about as much light to the face as it did before the grain arrived, which is
 * what keeps the name and bio legible under it. 0 - 2.
 */
const FOIL_INTENSITY = 0.34;

/** Thickness of the lit lip around the card edge, in card heights. 0 - 0.05. */
const RIM_WIDTH = 0.012;

/** Brightness of that lip. 0 turns it off. 0 - 1. */
const RIM_STRENGTH = 0.35;

/** Anti-alias width at the card outline, in dp. 0.5 - 3. */
const EDGE_FEATHER_DP = 1.5;

/* ══════════════════════════════════════════════════════════════════════════
   END OF PANEL — below here is machinery.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * SkSL has no implicit int->float conversion: `const float X = 2;` will not
 * compile. Every number reaching the source goes through here so it always
 * carries a decimal point.
 */
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
 * Build the ramp lookup from a list of stops of *any* length, as an unrolled
 * if-chain over constants. Generating it is what lets the two ramps have
 * different stop counts (brand has four, the foil spectrum has six) without the
 * shader body knowing or caring. No array uniforms, no dynamic indexing.
 */
function rampFunction(stops: readonly string[]): string {
	const n = stops.length;
	const consts = stops.map((c, i) => `const float3 STOP_${i} = ${f3(c)};`).join('\n');
	// Each stop blends into the next; the last wraps back to the first, so the
	// ramp is cyclic and a band can sweep forever without a seam.
	const branches = stops
		.map((_, i) => {
			const next = (i + 1) % n;
			const test = i === n - 1 ? 'else' : `${i === 0 ? 'if' : 'else if'} (i < ${f(i + 0.5)})`;
			return `    ${test} { a = STOP_${i}; b = STOP_${next}; }`;
		})
		.join('\n');

	return `${consts}

float3 rampAt(float t) {
    t = fract(t) * ${f(n)};
    float i = floor(t);
    float k = smoothstep(0.0, 1.0, t - i);
    float3 a = STOP_0;
    float3 b = STOP_1;
${branches}
    float3 c = mix(a, b, k);
    // Pull toward luma for a silver sheen, or past the stops for candy.
    float grey = dot(c, float3(0.299, 0.587, 0.114));
    return clamp(mix(float3(grey), c, ${f(SATURATION)}), 0.0, 1.0);
}`;
}

const SWEEP_RAD = (SWEEP_ANGLE_DEG * Math.PI) / 180;

/**
 * The shader.
 *
 * Every declaration is `float`, never `half`. SkSL treats `half` as mediump and
 * will happily infer it, which is how coordinate maths quietly starts banding.
 * `half` appears only in `main`'s mandated signature and the final conversion.
 * For the same reason the `float2`/`float3` spellings are used throughout
 * rather than the `vec2`/`vec3` aliases — mixing the two is the usual way a
 * `half` sneaks into a chain.
 *
 * Note there is no preprocessor in SkSL: no #define, no #ifdef, no #include.
 * Keep the source ASCII-only, comments included -- a stray em-dash or smart
 * quote is a lexer error a long way from where it reads like one.
 */
const SOURCE = `
uniform float2 u_resolution;  // canvas size in dp
uniform float  u_radius;      // corner radius in dp
uniform float  u_time;        // seconds since mount
uniform float2 u_tilt;        // tilt in SCREEN space, -1..1, y down-positive

const float TAU = 6.2831853;

const float2 SWEEP_AXIS       = float2(${f(Math.cos(SWEEP_RAD))}, ${f(Math.sin(SWEEP_RAD))});
const float  BAND_FREQUENCY   = ${f(BAND_FREQUENCY)};
const float  BAND_SHARPNESS   = ${f(BAND_SHARPNESS)};
const float  BAND_FLOOR       = ${f(BAND_FLOOR)};
const float  HUE_SPREAD       = ${f(HUE_SPREAD)};
const float  GRAIN_SCALE      = ${f(GRAIN_SCALE)};
const float  GRAIN_STRENGTH   = ${f(GRAIN_STRENGTH)};
const float  GRAIN_GLARE      = ${f(GRAIN_GLARE)};
const float  SPARKLE_SCALE    = ${f(SPARKLE_SCALE)};
const float  SPARKLE_DENSITY  = ${f(SPARKLE_DENSITY)};
const float  SPARKLE_SIZE     = ${f(SPARKLE_SIZE)};
const float  SPARKLE_FLICKER  = ${f(SPARKLE_FLICKER)};
const float  SPARKLE_SHARP    = ${f(SPARKLE_SHARPNESS)};
const float  SPARKLE_STRENGTH = ${f(SPARKLE_STRENGTH)};
const float  SPARKLE_GATE     = ${f(SPARKLE_LIGHT_GATE)};
const float  PATTERN_PHASE    = ${f(PATTERN_PHASE)};
const float  TILT_SENSITIVITY = ${f(TILT_SENSITIVITY)};
const float  TILT_HUE_SHIFT   = ${f(TILT_HUE_SHIFT)};
const float2 TILT_AXIS_WEIGHT = float2(${f(TILT_AXIS_WEIGHT[0])}, ${f(TILT_AXIS_WEIGHT[1])});
const float  HIGHLIGHT_RADIUS = ${f(HIGHLIGHT_RADIUS)};
const float  HIGHLIGHT_SOFT   = ${f(HIGHLIGHT_SOFTNESS)};
const float  HIGHLIGHT_STR    = ${f(HIGHLIGHT_STRENGTH)};
const float  HIGHLIGHT_TRAVEL = ${f(HIGHLIGHT_TRAVEL)};
const float2 LIGHT_DIRECTION  = float2(${f(LIGHT_DIRECTION[0])}, ${f(LIGHT_DIRECTION[1])});
const float  GLARE_RADIUS     = ${f(GLARE_RADIUS)};
const float  GLARE_FALLOFF    = ${f(GLARE_FALLOFF)};
const float  GLARE_STRENGTH   = ${f(GLARE_STRENGTH)};
const float2 GLARE_REST       = float2(${f(GLARE_REST[0])}, ${f(GLARE_REST[1])});
const float2 GLARE_TRAVEL     = float2(${f(GLARE_TRAVEL[0])}, ${f(GLARE_TRAVEL[1])});
const float  GLARE_TINT       = ${f(GLARE_TINT)};
const float  DRIFT_SPEED      = ${f(DRIFT_SPEED)};
const float  DRIFT_AMOUNT     = ${f(DRIFT_AMOUNT)};
const float  DRIFT_FADE       = ${f(DRIFT_FADE)};
const float  FOIL_INTENSITY   = ${f(FOIL_INTENSITY)};
const float  RIM_WIDTH        = ${f(RIM_WIDTH)};
const float  RIM_STRENGTH     = ${f(RIM_STRENGTH)};
const float  EDGE_FEATHER_DP  = ${f(EDGE_FEATHER_DP)};

${rampFunction(RAMP === 'brand' ? RAMP_BRAND : RAMP_FOIL)}

/**
 * Live tilt, plus a slow idle wander.
 *
 * The real tilt enters at coefficient 1 and is never filtered, smoothed or
 * delayed -- that is the whole reason this cannot feel laggy. The drift is an
 * additive perturbation whose gain is a pure function of the *current* tilt, so
 * there is no timer or easing to wait out: move your finger and it is already
 * gone. It fades back in for free as FlipCard's release spring settles rx/ry
 * toward zero.
 */
float2 tiltNow() {
    float2 t = u_tilt;
    float2 drift = float2(sin(u_time * DRIFT_SPEED),
                          sin(u_time * DRIFT_SPEED * 1.5 + 1.2)) * DRIFT_AMOUNT;
    return t + drift * (1.0 - smoothstep(0.0, DRIFT_FADE, length(t)));
}

/**
 * smoothstep with a guaranteed non-zero width.
 *
 * Several knobs are allowed to collapse the two edges onto each other -- a
 * hard-edged disc is HIGHLIGHT_SOFTNESS 0, a hairline lip is RIM_WIDTH 0 --
 * and smoothstep(e, e, x) is undefined. This keeps the intended look (an edge
 * as hard as one pixel allows) instead of a driver-dependent artefact.
 */
float softStep(float e0, float e1, float x) {
    return smoothstep(e0, max(e1, e0 + 0.0005), x);
}

/**
 * A stable hash: same input, same output, forever and on every GPU.
 *
 * This is the whole reason the microstructure can be pinned. There is no
 * texture to sample and no seed to keep in sync -- a point on the card hashes
 * to the same speck every frame because nothing time-varying or tilt-varying
 * is ever allowed into p.
 *
 * Kept in float throughout: the fract() chain below is exactly the kind of
 * maths that turns into visible banding the moment a mediump half gets into
 * it, and a banded "grain" is just a moire pattern.
 */
float hash21(float2 p) {
    p = fract(p * float2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

/** Value noise: the hash above, smoothed between its lattice points. 0..1. */
float valueNoise(float2 p) {
    float2 i = floor(p);
    float2 g = fract(p);
    // Hermite, so the lattice does not show up as a visible grid.
    float2 k = g * g * (3.0 - 2.0 * g);
    float a = hash21(i);
    float b = hash21(i + float2(1.0, 0.0));
    float c = hash21(i + float2(0.0, 1.0));
    float d = hash21(i + float2(1.0, 1.0));
    return mix(mix(a, b, k.x), mix(c, d, k.x), k.y);
}

/**
 * The grain. Two octaves: a coarse one that clumps, and a finer one on top so
 * it does not read as one regular size of speck. Centred near 0.5.
 */
float grainAt(float2 g) {
    return valueNoise(g) * 0.62 + valueNoise(g * 2.17 + 19.73) * 0.38;
}

/**
 * The flake field: a sparse grid of specks, each one flashing at its own tilt
 * angle.
 *
 * g is in card space and must stay that way. lean enters the *phase* of
 * the flash and nothing else, so tilting changes which flakes are lit without
 * moving a single one of them -- the same distinction as hue-shift versus
 * band-slide, one level down.
 */
float sparkleAt(float2 g, float lean) {
    float2 cell = floor(g);
    // Distance from the cell's centre, so a flake is a round speck sitting in
    // its cell rather than the whole square lighting up.
    float2 sub = fract(g) - 0.5;
    float speck = 1.0 - softStep(SPARKLE_SIZE * 0.25, SPARKLE_SIZE * 0.5, length(sub));

    // Which cells hold a flake at all. Fixed per cell, so the pattern of
    // sparkle positions is a property of the card, not of the frame.
    float flake = step(1.0 - SPARKLE_DENSITY, hash21(cell + 3.71));

    // Each flake sits at its own angle in the laminate, so they do not all
    // catch the light at once. Tilt sweeps the viewing angle past them.
    float phase = hash21(cell + 11.37);
    float facing = 0.5 + 0.5 * cos((phase + lean * SPARKLE_FLICKER) * TAU);

    return flake * speck * pow(facing, SPARKLE_SHARP);
}

/** Rounded-rect SDF, in card-centred units. Negative inside. */
float sdRoundRect(float2 p, float2 b, float r) {
    float2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0))) - r;
}

half4 main(float2 fragCoord) {
    // main() receives PIXELS (dp on this canvas), not uv, origin top-left with
    // y running down. u_tilt is already converted to that same screen space on
    // the JS side, so every axis below can be treated identically.
    float2 uv = fragCoord / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    // Card-centred, aspect-corrected: y spans -0.5..0.5, x spans +/-0.5*aspect.
    float2 p = uv - 0.5;
    p.x *= aspect;

    float sd = sdRoundRect(p, float2(0.5 * aspect, 0.5), u_radius / u_resolution.y);
    float mask = 1.0 - softStep(0.0, EDGE_FEATHER_DP / u_resolution.y, sd);
    if (mask <= 0.0) { return half4(0.0); }

    float2 t = tiltNow();

    // Tilt enters twice, and the two halves look completely different.
    float lean = dot(t, TILT_AXIS_WEIGHT);

    // Once to slide the pattern across the card. One phase drives both the hue
    // and the band envelope, so colour and bright stripe travel together like
    // a real laminate. HUE_SPREAD is what stops them locking: at exactly 1
    // every band peaks on the same ramp position and the card reads as one
    // colour.
    float phase = dot(p, SWEEP_AXIS) * BAND_FREQUENCY + lean * TILT_SENSITIVITY;

    // Once more into the hue alone, which recolours a fixed point *in place*
    // rather than moving anything past it. Without this the foil reads as a
    // pattern printed on the card and dragged around with it, because the card
    // is physically rotating under your eye at the same time.
    float3 colour = rampAt(phase * HUE_SPREAD + PATTERN_PHASE + lean * TILT_HUE_SHIFT);

    // clamp() before pow() so an edit to the phase above can never produce
    // pow(negative, e).
    float band = clamp(0.5 + 0.5 * cos(phase * TAU), 0.0, 1.0);
    float envelope = pow(band, mix(1.0, 4.0, clamp(BAND_SHARPNESS - 0.5, 0.0, 1.0)));
    envelope = envelope * (1.0 - BAND_FLOOR) + BAND_FLOOR;

    // The microstructure. gp is built from uv alone -- no t, no u_time --
    // which is what pins it: a speck sits over the same pixel of the photo at
    // every tilt, and only the light crossing it changes. Aspect-corrected so
    // the cells are square, and scaled by the card rather than by the screen,
    // so the finish is the same one at any card size.
    float2 gp = float2(uv.x * aspect, uv.y);

    // Centred on 1: grain adds micro-contrast to the shine without changing
    // how bright the finish is on average. max() rather than clamp() because
    // the top end is a highlight on a speck and is allowed past 1.
    float micro = max(0.0, 1.0 + (grainAt(gp * GRAIN_SCALE) - 0.5) * 2.0 * GRAIN_STRENGTH);

    // The wide bloom: light coming *through* the laminate.
    float2 lightCentre = float2(0.5) + t * LIGHT_DIRECTION * HIGHLIGHT_TRAVEL;
    float2 d = uv - lightCentre;
    d.x *= aspect;
    float inner = HIGHLIGHT_RADIUS * (1.0 - HIGHLIGHT_SOFT);
    float bloom = (1.0 - softStep(inner, HIGHLIGHT_RADIUS, length(d))) * HIGHLIGHT_STR;

    // The glare: one light source fading out into a circle. It rests where
    // GLARE_REST puts it rather than at the card's centre, so it can sit high
    // and leave the bio below it legible.
    float2 glareCentre = GLARE_REST + t * LIGHT_DIRECTION * GLARE_TRAVEL;
    float2 gd = uv - glareCentre;
    gd.x *= aspect;
    // 1 at the centre, 0 at the rim. gd.x is aspect-corrected above, so one
    // radius gives a true circle; the peak stays at GLARE_STRENGTH however
    // wide it gets. Clamped, so pow() never sees a negative.
    float reach = 1.0 - clamp(length(gd) / max(GLARE_RADIUS, 0.0001), 0.0, 1.0);
    float glare = pow(reach, GLARE_FALLOFF) * GLARE_STRENGTH;
    float3 glareColour = mix(float3(1.0), colour, GLARE_TINT);

    // Flakes fire where there is light to catch. SPARKLE_GATE is how strictly:
    // at 1 they live entirely inside the glare and bloom, at 0 the whole face
    // glitters at once.
    float lit = clamp(glare + bloom, 0.0, 1.0);
    float sparkle = sparkleAt(gp * SPARKLE_SCALE, lean)
                  * mix(1.0, lit, SPARKLE_GATE) * SPARKLE_STRENGTH;

    float rim = (1.0 - softStep(RIM_WIDTH * 0.5, RIM_WIDTH, -sd)) * RIM_STRENGTH;

    // The grain multiplies the shine outright and the glare only as far as
    // GRAIN_GLARE asks, so the reflection keeps some structure without the
    // bright spot going dirty. The bloom is left smooth: it is light coming
    // through the laminate rather than off it, so it has no specks in it.
    float3 light = colour * (envelope * micro * FOIL_INTENSITY)
                 + colour * bloom
                 + glareColour * (glare * mix(1.0, micro, GRAIN_GLARE))
                 + glareColour * sparkle
                 + float3(rim);
    light = clamp(light, 0.0, 1.0);

    // Runtime effects return PREMULTIPLIED alpha. Returning straight alpha here
    // fringes the anti-aliased corners.
    return half4(half3(light * mask), half(mask));
}
`;

let cachedEffect: SkRuntimeEffect | null | undefined;
let cachedSource: string | null = null;
let compileError: string | null = null;

/**
 * Compiled once per module instance. Fast Refresh re-runs this file on save,
 * which resets the cache — that is what makes a knob edit take effect.
 *
 * This is a function rather than a module-level `const` for one load-bearing
 * reason: `RuntimeEffect.Make` *throws* on native. At module scope that throw
 * would escape the lazy `require('@/card/foil/SkiaSmoke')` in the dev route,
 * which would catch it and report "Skia isn't linked in this app" — a flatly
 * wrong diagnosis for a missing semicolon. (On web it returns null instead, so
 * both are handled.)
 */
function shineEffect(): SkRuntimeEffect | null {
	// Keyed on the source, not just "have we compiled once". Re-running this
	// module resets the cache on its own, but this also catches the case where
	// the module object survives a hot update and only SOURCE changed -- which
	// is the difference between a knob edit appearing on the phone and not.
	if (cachedEffect === undefined || cachedSource !== SOURCE) {
		cachedSource = SOURCE;
		compileError = null;
		try {
			cachedEffect = Skia.RuntimeEffect.Make(SOURCE) ?? null;
			if (!cachedEffect) compileError = 'RuntimeEffect.Make returned null.';
		} catch (e) {
			cachedEffect = null;
			compileError = e instanceof Error ? e.message : String(e);
		}
		if (!cachedEffect) console.warn(`[SkiaSmoke] SkSL did not compile\n${compileError}`);
	}
	return cachedEffect;
}

export interface SkiaSmokeProps {
	width: number;
	height: number;
	/** Card tilt, owned by FlipCard — the same signal the foil engines read. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	/** Corner radius of the face this sits over, so the shine follows its edge. */
	radius?: number;
}

export function SkiaSmoke({ width, height, rx, ry, radius = width * 0.06 }: SkiaSmokeProps) {
	const clock = useClock();
	const effect = shineEffect();

	const uniforms = useDerivedValue(() => ({
		u_resolution: [width, height],
		u_radius: radius,
		// useClock reports milliseconds since the first frame; the shader wants
		// seconds. It is monotonic and never wrapped — float32 keeps sub-ms
		// resolution for hours, and wrapping would pop the sin() phase.
		u_time: clock.value / 1000,
		// Degrees -> normalised -1..1, converted to SCREEN space here so the
		// shader never has to think about it. rx is up-positive (FlipCard
		// negates translationY) while the canvas' y runs down, so y is negated:
		// without it `0.5 - tilt` reverses horizontally but not vertically, and
		// the highlight tracks your finger on one axis only.
		u_tilt: [ry.value / TILT_RANGE, -rx.value / TILT_RANGE]
	}));

	if (!effect) return <ShaderError message={compileError} width={width} height={height} />;

	return (
		<Canvas style={{ width, height }}>
			<Fill>
				<Shader source={effect} uniforms={uniforms} />
			</Fill>
		</Canvas>
	);
}

/**
 * A compile failure is otherwise a white rectangle. Skia reports
 * `error: <line>:<col>: <text>` where the line indexes into SOURCE, so quote
 * the surrounding lines — otherwise you are counting lines in a template
 * literal by hand.
 */
function ShaderError({
	message,
	width,
	height
}: {
	message: string | null;
	width: number;
	height: number;
}) {
	return (
		<ScrollView style={[styles.error, { width, height }]}>
			<Text style={styles.errorTitle}>SKSL DID NOT COMPILE</Text>
			<Text selectable style={styles.errorBody}>
				{message ?? 'No error text was reported.'}
			</Text>
			<Text style={styles.errorSource}>{quoteSource(message)}</Text>
		</ScrollView>
	);
}

/** The three source lines around the first line number in a Skia error. */
function quoteSource(message: string | null): string {
	const line = Number(message?.match(/error:\s*(\d+):/)?.[1]);
	if (!line) return '';
	const lines = SOURCE.split('\n');
	const from = Math.max(0, line - 3);
	return lines
		.slice(from, line + 2)
		.map((text, i) => `${from + i + 1 === line ? '>' : ' '} ${from + i + 1}  ${text}`)
		.join('\n');
}

const styles = StyleSheet.create({
	error: {
		padding: space.md,
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.danger
	},
	errorTitle: { ...type.meta, color: palette.danger, marginBottom: space.xs },
	errorBody: { ...type.body, color: palette.textPrimary, marginBottom: space.sm },
	// No card-face font here: the style guide keeps Space Grotesk on the card.
	errorSource: { ...type.small, color: palette.textDim }
});
