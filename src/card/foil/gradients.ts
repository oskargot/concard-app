/**
 * Gradient string builders for `experimental_backgroundImage`.
 *
 * React Native 0.86 parses CSS `linear-gradient()` and `radial-gradient()`, but
 * not `repeating-linear-gradient()` — so the repeating holo bars that do most of
 * the work in a CSS foil have to be expanded into explicit stops here.
 *
 * Everything in this file is a pure string builder. It is called once per style,
 * never per frame: animated layers are *translated* with Reanimated rather than
 * having their gradient rebuilt, because a transform runs on the UI thread and a
 * restyle does not.
 */

/** The spectrum a holo sheet cycles through, warm → cool → warm so it loops seamlessly. */
export const HOLO_SPECTRUM = [
	'rgb(255,119,115)',
	'rgb(255,237,95)',
	'rgb(168,255,95)',
	'rgb(131,255,247)',
	'rgb(120,148,255)',
	'rgb(216,117,255)'
] as const;

/**
 * Expand a repeating linear gradient into a plain one.
 *
 * `periodPct` is the width of one colour band as a percentage of the layer, and
 * the pattern is repeated until it covers `coverPct`. The first colour is
 * appended again at the end of every cycle so bands blend into the next cycle
 * instead of hard-cutting back to the start.
 */
export function repeatingLinear(
	angle: string,
	colors: readonly string[],
	periodPct: number,
	coverPct = 100
): string {
	const stops: string[] = [];
	const cycle = colors.length;
	const total = Math.ceil(coverPct / (periodPct * cycle));
	for (let c = 0; c < total; c++) {
		for (let i = 0; i < cycle; i++) {
			const pos = (c * cycle + i) * periodPct;
			stops.push(`${colors[i]} ${round(pos)}%`);
		}
	}
	// close the loop so the last band runs back into the first colour
	stops.push(`${colors[0]} ${round(total * cycle * periodPct)}%`);
	return `linear-gradient(${angle}, ${stops.join(', ')})`;
}

/**
 * The pointer-tracking specular highlight. Drawn once at the centre and moved by
 * transform, so `x`/`y` here are the layer's *rest* position, not a live value.
 */
export function radialGlare(
	x = 50,
	y = 50,
	{ core = 0.75, mid = 0.5 }: { core?: number; mid?: number } = {}
): string {
	return (
		`radial-gradient(circle farthest-corner at ${round(x)}% ${round(y)}%, ` +
		`rgba(255,255,255,${core}) 8%, ` +
		`rgba(255,255,255,${mid}) 22%, ` +
		`rgba(180,180,190,0.28) 42%, ` +
		`rgba(0,0,0,0.55) 78%, ` +
		`rgba(0,0,0,0.72) 100%)`
	);
}

/** A soft directional sheen — volume, not colour. Used on the card back too. */
export function sheen(angle = '145deg'): string {
	return (
		`linear-gradient(${angle}, ` +
		`rgba(255,255,255,0.00) 0%, ` +
		`rgba(255,255,255,0.16) 34%, ` +
		`rgba(255,255,255,0.42) 48%, ` +
		`rgba(255,255,255,0.10) 62%, ` +
		`rgba(255,255,255,0.00) 100%)`
	);
}

/**
 * A wide, low-frequency colour wash. This is the "holo base" every Concard card
 * carries (design bible §7: tier 0 is "holo base, no extra effect").
 */
export function holoWash(angle = '118deg', alpha = 0.55): string {
	const stops = HOLO_SPECTRUM.map((c, i) => {
		const pos = (i / (HOLO_SPECTRUM.length - 1)) * 100;
		return `${withAlpha(c, alpha)} ${round(pos)}%`;
	});
	return `linear-gradient(${angle}, ${stops.join(', ')})`;
}

/** Two overlapping nebula blooms, for the cosmic tier's background. */
export function nebula(): string {
	return (
		`radial-gradient(ellipse farthest-corner at 28% 22%, ` +
		`rgba(169,123,255,0.85) 0%, rgba(169,123,255,0.25) 38%, rgba(0,0,0,0) 68%)`
	);
}

export function nebulaSecondary(): string {
	return (
		`radial-gradient(ellipse farthest-corner at 74% 76%, ` +
		`rgba(69,229,213,0.70) 0%, rgba(255,126,199,0.28) 42%, rgba(0,0,0,0) 74%)`
	);
}

/** `rgb(r,g,b)` → `rgba(r,g,b,a)`. Leaves anything already alpha'd alone. */
function withAlpha(rgb: string, alpha: number): string {
	const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
	return m ? `rgba(${m[1]},${m[2]},${m[3]},${alpha})` : rgb;
}

/** Keep generated strings short — they are compared by value on every restyle. */
function round(n: number): number {
	return Math.round(n * 100) / 100;
}
