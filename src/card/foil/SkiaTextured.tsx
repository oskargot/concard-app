/**
 * Stage C1.1b: the same holo finish, with the pattern loaded instead of computed.
 *
 * This is the other half of an A/B. `SkiaSmoke.tsx` generates everything from
 * maths — the bands from a cosine, the grain from a hash, the flakes from a
 * second hash. This file draws the same five terms, but takes its two *pinned*
 * fields from image textures instead:
 *
 *   illusion.png  the contour pattern that gives the shine its structure
 *   glitter.png   a photograph of real glitter: grain and flakes in one sample
 *
 * That is the technique every CSS trading-card foil uses, and it is why they
 * are short. A photographed glitter field has correlated speck sizes, flare
 * shapes and clumping that value noise does not, and none of it costs a line
 * of shader. What it costs instead is ~170KB of bundle, a loading state, and
 * the ability to tune the pattern with a number.
 *
 * Everything else — the ramp, the tilt response, the glare, the rim, the
 * premultiplied output — is deliberately identical to SkiaSmoke, so what the
 * lab is comparing is the pattern source and nothing else.
 *
 * ── THE RULE IS UNCHANGED ────────────────────────────────────────────────────
 * Both textures are sampled at `fragCoord`, which does not contain tilt. The
 * material stays pinned to the card; only the lighting terms move. Sampling at
 * a tilt-offset coordinate would be the sliding-wallpaper bug with a texture
 * instead of a cosine, which is not an improvement.
 *
 * ── LICENSING ────────────────────────────────────────────────────────────────
 * Both textures are Simon Goellner's, GPL-3.0, per
 * `assets/foil/pokemon-cards-css/NOTICE.md`. The blend-mode engine already
 * ships them, but making them the production holo is a bigger commitment than
 * using them in a lab. Worth settling before this engine ships, not after.
 */

import {
	Canvas,
	Fill,
	ImageShader,
	Shader,
	Skia,
	useClock,
	useImage
} from '@shopify/react-native-skia';
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

/** Which ramp the shine cycles through. Matches SkiaSmoke's knob. */
const RAMP: 'brand' | 'foil' = 'brand';

/** Style-guide ramp: pink -> holo -> teal -> warm. */
const RAMP_BRAND = HOLO_STOPS.slice(0, 4);

/** The saturated trading-card rainbow the blend-mode foil uses. */
const RAMP_FOIL = HOLO_SPECTRUM;

/** Colour purity. 0 = silver sheen, 1 = ramp as authored, 2 = candy. 0 - 2. */
const SATURATION = 1.25;

/**
 * How much of the colour wheel the card spans at rest, in ramp cycles.
 *
 * This replaces BAND_FREQUENCY and HUE_SPREAD together. There are no bands to
 * count any more: the colour is one smooth sweep across the face and the
 * texture supplies all the structure, so this is simply how much rainbow is on
 * the card at once. 0.3 - 3.
 */
const HUE_SPAN = 1.4;

/** Direction the colour sweeps across the card, in degrees. 0 - 180. */
const SWEEP_ANGLE_DEG = 45;

/** Which colour the sweep leads with, as a position in the ramp. 0 - 1. */
const PATTERN_PHASE = 0.0;

/* ── The pinned textures ─────────────────────────────────────────────────── */

/* Both are sampled in card space and never in tilt. Between them they replace
   hash21, valueNoise, grainAt, sparkleAt and the whole band envelope — about
   95 lines of SkSL in the procedural engine. */

/**
 * How many copies of the contour pattern cover the card.
 *
 * 1 fits one copy to the face, which gives big slow swirls; higher tiles it
 * into finer interference. The source is square and the card is not, so a tile
 * is stretched slightly — that is fine for an abstract contour and would not be
 * for anything with a recognisable shape. 0.6 - 4.
 */
const PATTERN_TILES = 1.3;

/**
 * How deeply the contours cut into the shine. 0 ignores the texture entirely
 * and leaves a smooth gradient; 1 lets the dark contours extinguish it.
 *
 * This is the single knob that decides whether the finish reads as a laminate
 * or as a wash, and it is the first one to move. 0 - 1.
 */
const PATTERN_DEPTH = 0.75;

/** How many copies of the glitter field cover the card. Higher = finer specks.
 *  The source is a photograph, so past about 6 it stops resolving. 1 - 6. */
const FLAKE_TILES = 2.2;

/** How bright the flakes get. 0 turns them off and leaves the contours. 0 - 1.5. */
const FLAKE_STRENGTH = 0.9;

/**
 * How much a flake needs the light on it before it fires, as a blend.
 *
 * At 1 the glitter only exists inside the glare and bloom, at 0 the whole face
 * sparkles at once. The texture is dark everywhere except its specks, so this
 * can sit lower than SkiaSmoke's equivalent without the card turning to
 * static. 0 - 1.
 */
const FLAKE_GATE = 0.65;

/* ── Tilt response ───────────────────────────────────────────────────────── */

/**
 * How far the colour shifts for a full-range drag, in ramp cycles.
 *
 * There is no TILT_SENSITIVITY here at all. Sliding the pattern would mean
 * offsetting a texture lookup, which is exactly the sticker-drag this stage
 * exists to remove, so the knob is simply absent rather than set to zero. All
 * of the motion is recolouring. 0 - 4.
 */
const TILT_HUE_SHIFT = 2.2;

/** Horizontal vs vertical drag weighting, [x, y]. Each -1.5 - 1.5. */
const TILT_AXIS_WEIGHT: [number, number] = [0.9, 0.6];

/** Which way the light slides against your finger, per axis. -1 = opposite,
 *  the way a real reflection moves. */
const LIGHT_DIRECTION: [number, number] = [-1, -1];

/* ── Highlight (the specular bloom) ──────────────────────────────────────── */

/** Size of the bright spot, in card heights. 0.2 - 1.2. */
const HIGHLIGHT_RADIUS = 0.25;

/** Edge of the spot. 0 = hard disc, 1 = pure falloff. 0 - 1. */
const HIGHLIGHT_SOFTNESS = 0.85;

/** How bright the spot gets. 0 - 1.5. */
const HIGHLIGHT_STRENGTH = 0.45;

/** How far it slides at full tilt. 0 - 0.8. */
const HIGHLIGHT_TRAVEL = 0.35;

/* ── Circular glare (the light source) ───────────────────────────────────── */

/** How far the light reaches from its centre, in card heights. 0.1 - 1.2. */
const GLARE_RADIUS = 0.42;

/** How quickly it fades. 1 = linear, higher = tighter hot centre. 0.5 - 5. */
const GLARE_FALLOFF = 2.2;

/** How bright the centre gets. 0 turns the glare off. 0 - 1.5. */
const GLARE_STRENGTH = 0.45;

/** Where the light rests with the card flat, in face coordinates. */
const GLARE_REST: [number, number] = [0.5, 0.16];

/** How far it slides at full tilt, per axis. Each 0 - 0.8. */
const GLARE_TRAVEL: [number, number] = [0.3, 0.12];

/** 0 = white light, 1 = fully tinted by the holo under it. 0 - 1. */
const GLARE_TINT = 0.25;

/* ── Idle drift ──────────────────────────────────────────────────────────── */

/** Speed of the slow wander when nobody is touching the card, in rad/sec. */
const DRIFT_SPEED = 0.35;

/** How much virtual tilt the wander fakes. 0 freezes the resting card. */
const DRIFT_AMOUNT = 0.18;

/** How readily the drift yields to a real finger. 0.05 - 1. */
const DRIFT_FADE = 0.25;

/* ── Global / shape ──────────────────────────────────────────────────────── */

/** Master loudness of the whole finish. 0 - 2. */
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
 * The ramp lookup, as an unrolled if-chain over constants — SkSL has no arrays
 * you can index with a computed value. Identical to SkiaSmoke's.
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

float3 rampAt(float t) {
    t = fract(t) * ${f(n)};
    float i = floor(t);
    float k = smoothstep(0.0, 1.0, t - i);
    float3 a = STOP_0;
    float3 b = STOP_1;
${branches}
    float3 c = mix(a, b, k);
    float grey = dot(c, float3(0.299, 0.587, 0.114));
    return clamp(mix(float3(grey), c, ${f(SATURATION)}), 0.0, 1.0);
}`;
}

const SWEEP_RAD = (SWEEP_ANGLE_DEG * Math.PI) / 180;

/**
 * The shader.
 *
 * Two `uniform shader` children are bound in declaration order by the
 * `<ImageShader>` elements nested inside `<Shader>` below: first the contour
 * pattern, then the glitter. Both are evaluated at `fragCoord`, and the rect
 * each ImageShader is given is what maps the texture onto the card — so the
 * scaling lives in JS where it can read `width`, and the shader just samples.
 *
 * Same conventions as SkiaSmoke: `float` everywhere (never `half`, which is
 * mediump and bands), and ASCII only — SkSL has no preprocessor and a stray
 * smart quote is a lexer error a long way from where it reads like one.
 */
const SOURCE = `
uniform float2 u_resolution;  // canvas size in dp
uniform float  u_radius;      // corner radius in dp
uniform float  u_time;        // seconds since mount
uniform float2 u_tilt;        // tilt in SCREEN space, -1..1, y down-positive
uniform shader u_pattern;     // illusion.png, mapped to the card
uniform shader u_flakes;      // glitter.png, tiled over the card

const float2 SWEEP_AXIS       = float2(${f(Math.cos(SWEEP_RAD))}, ${f(Math.sin(SWEEP_RAD))});
const float  HUE_SPAN         = ${f(HUE_SPAN)};
const float  PATTERN_PHASE    = ${f(PATTERN_PHASE)};
const float  PATTERN_DEPTH    = ${f(PATTERN_DEPTH)};
const float  FLAKE_STRENGTH   = ${f(FLAKE_STRENGTH)};
const float  FLAKE_GATE       = ${f(FLAKE_GATE)};
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

half4 main(float2 fragCoord) {
    float2 uv = fragCoord / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    float2 p = uv - 0.5;
    p.x *= aspect;

    float sd = sdRoundRect(p, float2(0.5 * aspect, 0.5), u_radius / u_resolution.y);
    float mask = 1.0 - softStep(0.0, EDGE_FEATHER_DP / u_resolution.y, sd);
    if (mask <= 0.0) { return half4(0.0); }

    float2 t = tiltNow();
    float lean = dot(t, TILT_AXIS_WEIGHT);

    // THE PINNED SAMPLES. fragCoord, never tilt -- see the header. Both source
    // images are greyscale, so one channel carries everything.
    float pattern = float(u_pattern.eval(fragCoord).r);
    float flakes  = float(u_flakes.eval(fragCoord).r);

    // Colour is one smooth sweep across the face, walked around the ramp by
    // tilt. No band frequency, no envelope: a fixed point recolours in place
    // and nothing travels across the card.
    float3 colour = rampAt(dot(p, SWEEP_AXIS) * HUE_SPAN + PATTERN_PHASE + lean * TILT_HUE_SHIFT);

    // The contour texture is the whole structure term. This one line is what
    // the cosine, the pow() envelope and the band floor did together.
    float structure = mix(1.0 - PATTERN_DEPTH, 1.0, pattern);

    // The wide bloom: light coming through the laminate.
    float2 lightCentre = float2(0.5) + t * LIGHT_DIRECTION * HIGHLIGHT_TRAVEL;
    float2 d = uv - lightCentre;
    d.x *= aspect;
    float inner = HIGHLIGHT_RADIUS * (1.0 - HIGHLIGHT_SOFT);
    float bloom = (1.0 - softStep(inner, HIGHLIGHT_RADIUS, length(d))) * HIGHLIGHT_STR;

    // The glare: one light source fading out into a circle, resting high so the
    // bio below it stays legible.
    float2 glareCentre = GLARE_REST + t * LIGHT_DIRECTION * GLARE_TRAVEL;
    float2 gd = uv - glareCentre;
    gd.x *= aspect;
    float reach = 1.0 - clamp(length(gd) / max(GLARE_RADIUS, 0.0001), 0.0, 1.0);
    float glare = pow(reach, GLARE_FALLOFF) * GLARE_STRENGTH;
    float3 glareColour = mix(float3(1.0), colour, GLARE_TINT);

    // Glitter fires where there is light to catch it. The texture is already
    // dark between its specks, so this only decides how far the field extends
    // past the bright spot.
    float lit = clamp(glare + bloom, 0.0, 1.0);
    float sparkle = flakes * mix(1.0, lit, FLAKE_GATE) * FLAKE_STRENGTH;

    float rim = (1.0 - softStep(RIM_WIDTH * 0.5, RIM_WIDTH, -sd)) * RIM_STRENGTH;

    float3 light = colour * (structure * FOIL_INTENSITY)
                 + colour * bloom
                 + glareColour * glare
                 + glareColour * sparkle
                 + float3(rim);
    light = clamp(light, 0.0, 1.0);

    // Runtime effects return PREMULTIPLIED alpha.
    return half4(half3(light * mask), half(mask));
}
`;

let cachedEffect: SkRuntimeEffect | null | undefined;
let cachedSource: string | null = null;
let compileError: string | null = null;

/** Compiled once per module instance; Fast Refresh resets the cache on save. */
function foilEffect(): SkRuntimeEffect | null {
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
		if (!cachedEffect) console.warn(`[SkiaTextured] SkSL did not compile\n${compileError}`);
	}
	return cachedEffect;
}

export interface SkiaTexturedProps {
	width: number;
	height: number;
	/** Card tilt, owned by FlipCard — the same signal the foil engines read. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	/** Corner radius of the face this sits over, so the shine follows its edge. */
	radius?: number;
}

export function SkiaTextured({ width, height, rx, ry, radius = width * 0.06 }: SkiaTexturedProps) {
	const clock = useClock();
	const effect = foilEffect();

	// `useImage` decodes asynchronously and returns null until it lands. Both
	// are bundled assets, so this is one or two frames on a cold mount rather
	// than a network wait -- but it is still a state this component has and
	// SkiaSmoke does not, which is part of what the comparison is measuring.
	const pattern = useImage(require('../../../assets/foil/pokemon-cards-css/illusion.png'));
	const flakes = useImage(require('../../../assets/foil/pokemon-cards-css/glitter.png'));

	const uniforms = useDerivedValue(() => ({
		u_resolution: [width, height],
		u_radius: radius,
		u_time: clock.value / 1000,
		u_tilt: [ry.value / TILT_RANGE, -rx.value / TILT_RANGE]
	}));

	if (!effect) return <ShaderError message={compileError} width={width} height={height} />;
	if (!pattern || !flakes) return <Canvas style={{ width, height }} />;

	// The rect each ImageShader draws into is what scales the texture onto the
	// card, and `repeat` tiles it from there. Doing it here rather than in the
	// shader keeps the sampling at plain `fragCoord`, which is what makes the
	// pinning obvious on inspection instead of something you have to trace.
	const patternRect = { x: 0, y: 0, width: width / PATTERN_TILES, height: height / PATTERN_TILES };
	const flakeRect = { x: 0, y: 0, width: width / FLAKE_TILES, height: height / FLAKE_TILES };

	return (
		<Canvas style={{ width, height }}>
			<Fill>
				<Shader source={effect} uniforms={uniforms}>
					<ImageShader image={pattern} rect={patternRect} fit="fill" tx="repeat" ty="repeat" />
					<ImageShader image={flakes} rect={flakeRect} fit="fill" tx="repeat" ty="repeat" />
				</Shader>
			</Fill>
		</Canvas>
	);
}

/** A compile failure is otherwise a white rectangle. */
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
	errorSource: { ...type.small, color: palette.textDim }
});
