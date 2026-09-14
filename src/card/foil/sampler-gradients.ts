/**
 * Gradient strings for the foil sampler (`/dev/foil-sampler`), which recreates
 * five swatches from the `Foil Sampler` design export 1:1 in RN's real blend
 * modes rather than the generic per-tier recipes in `gradients.ts`.
 *
 * Same rule as that file: `experimental_backgroundImage` parses `linear-` and
 * `radial-gradient()` but not the `repeating-` forms, so anything repeating goes
 * through `repeatingLinear`, which expands it into explicit stops. Built once
 * per style, never per frame — the light's motion is a transform on an oversized
 * layer, not a restyled gradient (see FoilSwatch's `MovingLayer`).
 */

import { repeatingLinear } from './gradients';

// ---- 01 · Linear holo ----------------------------------------------------

const HOLO_BAND_HUES = ['#c929f1', '#0dbde9', '#21e985', '#eedf10', '#f80e35'] as const;

export const linearHoloBands = () => repeatingLinear('110deg', HOLO_BAND_HUES, 9, 100);
export const linearHoloScanlines = () => repeatingLinear('92deg', ['#000000', '#5c5c5c'], 1.4, 100);
export const linearHoloBarcode = () =>
	repeatingLinear('92deg', ['#000000', '#b3b3b3', '#000000'], 3.5, 100);

// ---- 02 · Rainbow glitter -------------------------------------------------

const GLITTER_SATURATED = [
	'hsl(0,57%,45%)',
	'hsl(40,53%,47%)',
	'hsl(90,60%,43%)',
	'hsl(180,60%,43%)',
	'hsl(210,57%,47%)',
	'hsl(280,55%,39%)',
	'hsl(0,57%,45%)'
] as const;

const GLITTER_PASTELS = [
	'hsla(283,49%,72%,0.75)',
	'hsla(2,70%,70%,0.75)',
	'hsla(53,67%,65%,0.75)',
	'hsla(93,56%,64%,0.75)',
	'hsla(176,38%,62%,0.75)',
	'hsla(228,100%,80%,0.75)'
] as const;

/** The two counter-rotating base sheets — angle is the only thing that differs. */
export const rainbowGlitterSheet = (angle: string) =>
	`linear-gradient(${angle}, ${GLITTER_SATURATED.join(', ')})`;
export const rainbowGlitterPastelBand = () => repeatingLinear('133deg', GLITTER_PASTELS, 11, 100);

// ---- 03 · Radiant crosshatch -----------------------------------------------

const CROSSHATCH_RAMP = ['#0a0a0a', '#333333', '#595959', '#808080', '#595959', '#333333'] as const;

export const crosshatchBars = (angle: string) => repeatingLinear(angle, CROSSHATCH_RAMP, 4.2, 100);

// ---- 04 · Cosmos speckle ----------------------------------------------------

const COSMOS_SPECTRUM = [
	'hsl(53,65%,62%)',
	'hsl(93,56%,52%)',
	'hsl(176,54%,51%)',
	'hsl(228,59%,57%)',
	'hsl(283,60%,57%)',
	'hsl(326,59%,53%)',
	'hsl(283,60%,57%)',
	'hsl(228,59%,57%)',
	'hsl(176,54%,51%)',
	'hsl(93,56%,52%)'
] as const;

export const cosmosBand = () => repeatingLinear('82deg', COSMOS_SPECTRUM, 11, 100);

// ---- 13 · Ice crackle --------------------------------------------------------

const ICE_SPECTRUM = [
	'hsl(188,95%,80%)',
	'hsl(212,90%,76%)',
	'hsl(250,70%,78%)',
	'hsl(168,80%,78%)'
] as const;

export const iceCrackleSheet = () => repeatingLinear('28deg', ICE_SPECTRUM, 8, 100);

// ---- shared: coloured hotspots ----------------------------------------------

/**
 * A colour-tinted specular hotspot, centred at the layer's own middle — the
 * layer itself is oversized and translated to move the hotspot, exactly like
 * `radialGlare` in `gradients.ts`, just with a tintable core/edge instead of
 * the fixed white/black pair that one bakes in.
 */
export function radialHotspot(core: string, edge: string, coreStop = 8, edgeStop = 100): string {
	return `radial-gradient(circle farthest-corner at 50% 50%, ${core} ${coreStop}%, ${edge} ${edgeStop}%)`;
}
