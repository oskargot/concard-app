/**
 * Deterministic dot fields for the glitter and cosmic foils.
 *
 * Seeded, so a given card's glitter is the same every render and the same on
 * every device — a foil that reshuffles on each mount reads as noise rather than
 * a surface. Generated as data and drawn with react-native-svg.
 *
 * Perf note: the web app learned that many small live layers get expensive
 * (it replaced 14 CSS filters per sticker with baked artwork). These fields are
 * cheap at hero size but will need baking into a texture if binder thumbnails
 * drop frames — `count` is deliberately a parameter so thumbnails can ask for
 * fewer, and the call sites already scale it by card width.
 */

/** mulberry32 — small, fast, good enough for scattering dots. */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Stable 32-bit hash of a string, so a card id can seed its own foil. */
export function hashSeed(input: string): number {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

export interface Speck {
	/** 0..1 of the card's width and height. */
	x: number;
	y: number;
	/** 0..1 of the card's width. */
	r: number;
	opacity: number;
}

/**
 * Glitter: a dense field of very small flecks at mixed opacity. Drawn in white
 * and blended, so the colour comes from the holo layer underneath rather than
 * from the flecks themselves — which is what makes the light appear to move
 * *over* the glitter instead of the glitter moving.
 */
export function glitterField(seed: number, count = 220): Speck[] {
	const rand = rng(seed);
	const out: Speck[] = [];
	for (let i = 0; i < count; i++) {
		out.push({
			x: rand(),
			y: rand(),
			r: 0.0035 + rand() * 0.0075,
			opacity: 0.25 + rand() * 0.75
		});
	}
	return out;
}

/**
 * Cosmic: a starfield. Sparser than glitter, wider size range, and a handful of
 * deliberately bright stars so the eye has something to land on.
 */
export function starField(seed: number, count = 120): Speck[] {
	const rand = rng(seed);
	const out: Speck[] = [];
	for (let i = 0; i < count; i++) {
		const bright = rand() > 0.9;
		out.push({
			x: rand(),
			y: rand(),
			r: bright ? 0.006 + rand() * 0.008 : 0.002 + rand() * 0.004,
			opacity: bright ? 0.85 + rand() * 0.15 : 0.3 + rand() * 0.5
		});
	}
	return out;
}

export interface CrackleLine {
	/** Points in 0..1 of the card's width/height, left to right. */
	points: { x: number; y: number }[];
	opacity: number;
	/** Stroke width, as a fraction of the card's width. */
	strokeWidth: number;
}

/**
 * Ice crackle's fracture lines: a handful of near-diagonal jagged strokes,
 * standing in for the reference's `illusion.png` moiré texture. Exclusion-blended
 * over a colour sheet, a bright line inverts the sheet instead of tinting it —
 * these don't need to look like anything on their own, only to break the sheet
 * into sharp discontinuities where they cross it.
 */
export function crackleField(seed: number, lines = 10): CrackleLine[] {
	const rand = rng(seed);
	const out: CrackleLine[] = [];
	for (let i = 0; i < lines; i++) {
		const steps = 5 + Math.floor(rand() * 3);
		const points: { x: number; y: number }[] = [];
		let x = -0.15;
		let y = rand();
		points.push({ x, y });
		for (let s = 0; s < steps; s++) {
			x += 1.3 / steps;
			y += (rand() - 0.5) * 0.16;
			points.push({ x, y });
		}
		out.push({ points, opacity: 0.3 + rand() * 0.5, strokeWidth: 0.006 + rand() * 0.01 });
	}
	return out;
}

export interface Facet {
	/** Polygon points in 0..1 card space. */
	points: { x: number; y: number }[];
	/** Gradient rotation for this facet, degrees. */
	angle: number;
	opacity: number;
}

/**
 * Mosaic: a fragmented prismatic surface. The card is cut into a jittered grid
 * and each cell is split into two triangles that each sample the holo spectrum
 * at a different rotation — so neighbouring facets catch different colours and
 * the surface reads as faceted rather than as a flat rainbow.
 */
export function facetField(seed: number, cols = 5, rows = 7): Facet[] {
	const rand = rng(seed);
	const jitter = () => (rand() - 0.5) * 0.055;
	// one shared lattice of jittered vertices, so adjacent facets share edges
	// exactly and no seams show through to the card face
	const grid: { x: number; y: number }[][] = [];
	for (let r = 0; r <= rows; r++) {
		const row: { x: number; y: number }[] = [];
		for (let c = 0; c <= cols; c++) {
			const edge = r === 0 || r === rows || c === 0 || c === cols;
			row.push({
				x: c / cols + (edge ? 0 : jitter()),
				y: r / rows + (edge ? 0 : jitter())
			});
		}
		grid.push(row);
	}

	const out: Facet[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const tl = grid[r][c];
			const tr = grid[r][c + 1];
			const br = grid[r + 1][c + 1];
			const bl = grid[r + 1][c];
			// alternate the split direction so the facets don't read as stripes
			const flip = (r + c) % 2 === 0;
			const pair = flip
				? [
						[tl, tr, br],
						[tl, br, bl]
					]
				: [
						[tl, tr, bl],
						[tr, br, bl]
					];
			for (const points of pair) {
				out.push({
					points,
					angle: Math.floor(rand() * 360),
					opacity: 0.45 + rand() * 0.55
				});
			}
		}
	}
	return out;
}
