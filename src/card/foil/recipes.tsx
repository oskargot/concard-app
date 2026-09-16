/** Fixed foil materials plus the existing surface reflection. Shared by cards and previews. */

import type { ReactNode } from 'react';

import type { FoilKind } from '../tiers';
import { ReflectiveGlitter } from './ReflectiveGlitter';
import { ReflectiveHolo, ReflectiveMaterial } from './ReflectiveMaterial';
import { GradientLayer, pfcOpacity, slide, type FoilLight } from './layers';
import { rainbowGlitterPastelBand } from './sampler-gradients';

export type FoilRecipeId =
	| 'plain-base'
	| 'linear-holo'
	| 'rainbow-glitter'
	| 'radiant-crosshatch'
	| 'cosmos-speckle'
	| 'ice-crackle';

export interface FoilRecipeDef {
	id: FoilRecipeId;
	title: string;
	description: string;
	/** Blank-swatch tint used by `/dev/foil-sampler`. */
	tint: string;
	/** Phase offset so a grid of swatches never sweeps in unison. */
	phase: number;
	render: (light: FoilLight & { seed: number }) => ReactNode;
}

/** Production foil-kind to material-recipe map. Tunable in the foil lab. */
export const V2_KIND_RECIPES: Record<FoilKind, FoilRecipeId> = {
	none: 'plain-base',
	glitter: 'rainbow-glitter',
	holo: 'linear-holo',
	cosmic: 'cosmos-speckle',
	// Backward-compatible rendering for cards saved before Mosaic left the tier ladder.
	mosaic: 'linear-holo'
};

// ---- gradients built once -------------------------------------------------

const GLITTER_PASTEL = rainbowGlitterPastelBand();

/** Broad reflected light with a soft tail: no hard ring or dark outer rim. */
const CIRCULAR_REFLECTION = `radial-gradient(circle farthest-corner at 50% 50%,
	rgba(255,255,255,0.48) 0%,
	rgba(255,255,255,0.43) 6%,
	rgba(255,255,255,0.31) 13%,
	rgba(255,255,255,0.18) 21%,
	rgba(255,255,255,0.08) 30%,
	rgba(255,255,255,0.025) 40%,
	rgba(255,255,255,0) 52%)`;

// ---- recipes --------------------------------------------------------------

// Material geometry stays in card coordinates. Only illumination changes with tilt.

function PlainBaseLayers({ x, y, width, height }: FoilLight) {
	return (
		<GradientLayer
			x={x}
			y={y}
			width={width}
			height={height}
			background={CIRCULAR_REFLECTION}
			blend="soft-light"
			opacity={0.48}
			motion={slide(width * 0.36, height * 0.36, false)}
		/>
	);
}

function LinearHoloLayers(light: FoilLight & { seed: number }) {
	const { x, y, width, height } = light;
	return (
		<>
			<ReflectiveHolo {...light} />
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={CIRCULAR_REFLECTION}
				blend="overlay"
				opacity={0.42}
				motion={slide(width * 0.32, height * 0.32, false)}
			/>
		</>
	);
}

function RainbowGlitterLayers({ x, y, width, height, seed }: FoilLight & { seed: number }) {
	return (
		<>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={GLITTER_PASTEL}
				blend="soft-light"
				motion={slide(width * 0.18, height * 0.3)}
				opacity={0.22}
			/>
			<ReflectiveGlitter x={x} y={y} width={width} height={height} seed={seed} />
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={CIRCULAR_REFLECTION}
				blend="soft-light"
				opacity={0.46}
				motion={slide(width * 0.3, height * 0.3, false)}
			/>
		</>
	);
}

function RadiantCrosshatchLayers(light: FoilLight & { seed: number }) {
	return (
		<>
			<ReflectiveMaterial {...light} kind="crosshatch" />
			<PlainBaseLayers {...light} />
		</>
	);
}

function CosmosSpeckleLayers(light: FoilLight & { seed: number }) {
	const { x, y, width, height } = light;
	return (
		<>
			<ReflectiveMaterial {...light} kind="cosmic" />
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={CIRCULAR_REFLECTION}
				blend="overlay"
				opacityFn={pfcOpacity(0.14, 0.28)}
				motion={slide(width * 0.3, height * 0.3, false)}
			/>
		</>
	);
}

function IceCrackleLayers(light: FoilLight & { seed: number }) {
	return (
		<>
			<ReflectiveMaterial {...light} kind="ice" />
			<PlainBaseLayers {...light} />
		</>
	);
}

export const FOIL_RECIPES: Record<FoilRecipeId, FoilRecipeDef> = {
	'plain-base': {
		id: 'plain-base',
		title: 'Plain base',
		description: 'Clear finish with the original soft reflection and no foil grain.',
		tint: '#161018',
		phase: 0.4,
		render: (l) => <PlainBaseLayers {...l} />
	},
	'linear-holo': {
		id: 'linear-holo',
		title: 'True holo',
		description: 'A broad spectral reflection reveals fine grooves fixed to the surface.',
		tint: '#101218',
		phase: 0,
		render: (l) => <LinearHoloLayers {...l} />
	},
	'rainbow-glitter': {
		id: 'rainbow-glitter',
		title: 'Reflective glitter',
		description:
			'Non-repeating microfacets catch small, bright reflections as the light crosses the surface.',
		tint: '#14101a',
		phase: 1.1,
		render: (l) => <RainbowGlitterLayers {...l} />
	},
	'radiant-crosshatch': {
		id: 'radiant-crosshatch',
		title: 'Radiant crosshatch',
		description: 'A fixed diamond etching catches the light along two opposing directions.',
		tint: '#0f1414',
		phase: 2.3,
		render: (l) => <RadiantCrosshatchLayers {...l} />
	},
	'cosmos-speckle': {
		id: 'cosmos-speckle',
		title: 'Cosmic',
		description: 'Scattered foil fragments and occasional starbursts reflect light locally.',
		tint: '#0d1018',
		phase: 3.4,
		render: (l) => <CosmosSpeckleLayers {...l} />
	},
	'ice-crackle': {
		id: 'ice-crackle',
		title: 'Ice crackle',
		description: 'Connected crystal facets reveal thin edges and subtle cool reflections.',
		tint: '#0d1216',
		phase: 5.6,
		render: (l) => <IceCrackleLayers {...l} />
	}
};

/** The five sampler swatches (everything except plain-base). */
export const SAMPLER_RECIPE_IDS: FoilRecipeId[] = [
	'linear-holo',
	'rainbow-glitter',
	'radiant-crosshatch',
	'cosmos-speckle',
	'ice-crackle'
];

export const FOIL_RECIPE_IDS = Object.keys(FOIL_RECIPES) as FoilRecipeId[];
