/**
 * Shine + glare foil recipes.
 *
 * Ported from the foil sampler / simeydotme technique: each recipe is a small
 * stack of Groups (shine) plus a hotspot (glare), with filter punch and
 * parallax that actually travels. These are the candidates for production  E
 * `/dev/foil-lab` can run them on a real Concard face via FoilV2 before any
 * tier wiring lands in `tiers.ts`.
 */

import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import type { FoilKind } from '../tiers';
import { holoWash } from './gradients';
import {
	CrackleLines,
	DotSpecks,
	GradientLayer,
	Group,
	pfcOpacity,
	slide,
	SvgLayer,
	type FoilLight
} from './layers';
import {
	cosmosBand,
	crosshatchBars,
	iceCrackleSheet,
	linearHoloBands,
	linearHoloBarcode,
	linearHoloScanlines,
	radialHotspot,
	rainbowGlitterPastelBand,
	rainbowGlitterSheet
} from './sampler-gradients';

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

/** Draft map from production foil kinds ↁEexperiment recipes. Tunable in lab. */
export const V2_KIND_RECIPES: Record<FoilKind, FoilRecipeId> = {
	none: 'plain-base',
	glitter: 'rainbow-glitter',
	holo: 'linear-holo',
	cosmic: 'cosmos-speckle',
	mosaic: 'radiant-crosshatch'
};

// ---- gradients built once -------------------------------------------------

const HOLO_SCANLINES = linearHoloScanlines();
const HOLO_BANDS = linearHoloBands();
const HOLO_BARCODE = linearHoloBarcode();
const HOTSPOT_ICE_WHITE = radialHotspot('hsl(180,100%,95%)', 'rgba(0,0,0,0.85)');

const GLITTER_SHEET_A = rainbowGlitterSheet('-30deg');
const GLITTER_SHEET_B = rainbowGlitterSheet('-60deg');
const GLITTER_PASTEL = rainbowGlitterPastelBand();
const HOTSPOT_WARM = radialHotspot('hsla(50,20%,90%,0.7)', 'rgba(0,0,0,0.85)');

const CROSSHATCH_A = crosshatchBars('-45deg');
const CROSSHATCH_B = crosshatchBars('45deg');
const HOTSPOT_CROSS_ELLIPSE = radialHotspot('hsl(0,0%,96%)', 'hsl(175,100%,88%)', 20, 130);
const HOTSPOT_CROSS_GLOW = radialHotspot('rgba(255,255,255,0.9)', 'rgba(0,0,0,0.4)', 5, 110);

const COSMOS_BAND = cosmosBand();
const HOTSPOT_COSMOS = radialHotspot('hsla(204,100%,95%,0.9)', 'hsl(250,15%,15%)', 5, 150);

const ICE_SHEET = iceCrackleSheet();
const HOTSPOT_ICE_A = radialHotspot('hsla(190,100%,96%,0.85)', 'hsl(210,30%,10%)', 5, 90);
const HOTSPOT_ICE_B = radialHotspot('hsla(195,100%,92%,0.5)', 'hsl(0,0%,10%)', 8, 70);

const PLAIN_WASH = holoWash('118deg', 0.45);
const PLAIN_GLARE = radialHotspot('rgba(255,255,255,0.55)', 'rgba(0,0,0,0.55)', 10, 100);

// ---- recipes --------------------------------------------------------------

function PlainBaseLayers({ x, y, width, height }: FoilLight) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="hard-light"
				opacity={0.35}
				filter={[{ brightness: 1.05 }, { contrast: 1.2 }, { saturate: 0.9 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={PLAIN_WASH}
					motion={slide(width * 0.18, height * 0.22)}
				/>
			</Group>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={PLAIN_GLARE}
				blend="overlay"
				filter={[{ brightness: 0.85 }, { contrast: 1.6 }]}
				motion={slide(width * 0.28, height * 0.28, false)}
				opacityFn={pfcOpacity(0.35, 0.45)}
			/>
		</>
	);
}

function LinearHoloLayers({ x, y, width, height }: FoilLight) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				filter={[{ brightness: 1.05 }, { contrast: 1.15 }, { saturate: 1.2 }]}
			>
				<GradientLayer x={x} y={y} width={width} height={height} background={HOLO_SCANLINES} />
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOLO_BANDS}
					blend="overlay"
					motion={slide(width * 0.5, height * 0.6)}
				/>
			</Group>
			<Group
				x={x}
				y={y}
				blend="hard-light"
				opacity={0.6}
				filter={[{ brightness: 1.1 }, { contrast: 1.1 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOLO_BARCODE}
					motion={slide(width * 0.22, height * 0.1)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOLO_BARCODE}
					blend="screen"
					motion={slide(width * 0.18, height * 0.16, false)}
				/>
			</Group>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={HOTSPOT_ICE_WHITE}
				blend="overlay"
				filter={[{ brightness: 0.75 }, { contrast: 2.2 }]}
				motion={slide(width * 0.32, height * 0.32, false)}
			/>
		</>
	);
}

function RainbowGlitterLayers({ x, y, width, height, seed }: FoilLight & { seed: number }) {
	return (
		<>
			<Group x={x} y={y} filter={[{ contrast: 3 }, { saturate: 1.8 }]}>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={GLITTER_SHEET_A}
					motion={slide(width * 0.4, height * 0.55)}
				/>
				<SvgLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="overlay"
					render={(w, h) => (
						<DotSpecks seed={seed} kind="glitter" width={w} height={h} count={90} />
					)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={GLITTER_PASTEL}
					blend="luminosity"
					motion={slide(0, height * 0.5)}
				/>
			</Group>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				filter={[{ contrast: 3 }]}
				opacityFn={pfcOpacity(1, -0.4)}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={GLITTER_SHEET_B}
					motion={slide(width * 0.4, height * 0.55, false)}
				/>
				<SvgLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="overlay"
					render={(w, h) => (
						<DotSpecks seed={seed + 1} kind="glitter" width={w} height={h} count={90} />
					)}
				/>
			</Group>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={HOTSPOT_WARM}
				blend="overlay"
				opacity={0.75}
				motion={slide(width * 0.3, height * 0.3, false)}
			/>
		</>
	);
}

function RadiantCrosshatchLayers({ x, y, width, height }: FoilLight) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				filter={[{ brightness: 0.9 }, { contrast: 2 }, { saturate: 1.6 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={CROSSHATCH_A}
					motion={slide(width * 0.35, height * 0.35)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={CROSSHATCH_B}
					blend="darken"
					motion={slide(width * 0.35, height * 0.35)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOTSPOT_CROSS_ELLIPSE}
					blend="exclusion"
					motion={slide(width * 0.14, height * 0.14, false)}
				/>
			</Group>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={HOTSPOT_CROSS_GLOW}
				blend="hard-light"
				filter={[{ brightness: 1 }, { contrast: 1.5 }]}
				motion={slide(width * 0.3, height * 0.3, false)}
			/>
		</>
	);
}

function CosmosSpeckleLayers({ x, y, width, height, seed }: FoilLight & { seed: number }) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				filter={[{ brightness: 1.1 }, { contrast: 1.1 }, { saturate: 0.9 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={COSMOS_BAND}
					motion={slide(width * 0.9, height * 0.5)}
				/>
				<SvgLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="color-burn"
					render={(w, h) => <DotSpecks seed={seed} kind="stars" width={w} height={h} count={140} />}
				/>
				<SvgLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="screen"
					opacity={0.7}
					render={(w, h) => (
						<DotSpecks seed={seed + 2} kind="glitter" width={w} height={h} count={60} />
					)}
				/>
			</Group>
			<GradientLayer
				x={x}
				y={y}
				width={width}
				height={height}
				background={HOTSPOT_COSMOS}
				blend="overlay"
				motion={slide(width * 0.3, height * 0.3, false)}
				opacityFn={pfcOpacity(0.25, 1)}
			/>
		</>
	);
}

function IceCrackleLayers({ x, y, width, height, seed }: FoilLight & { seed: number }) {
	return (
		<>
			<Group
				x={x}
				y={y}
				blend="color-dodge"
				opacity={0.85}
				filter={[{ brightness: 0.55 }, { contrast: 1.7 }, { saturate: 0.85 }]}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOTSPOT_ICE_A}
					motion={slide(width * 0.18, height * 0.18, false)}
				/>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={ICE_SHEET}
					blend="hard-light"
					motion={slide(width * 0.45, height * 0.45)}
				/>
				<SvgLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend={'exclusion' as ViewStyle['mixBlendMode']}
					render={(w, h) => <CrackleLines seed={seed} width={w} height={h} />}
				/>
			</Group>
			<Group
				x={x}
				y={y}
				blend="overlay"
				filter={[{ brightness: 0.9 }, { contrast: 1.6 }, { saturate: 0.6 }]}
				opacityFn={pfcOpacity(0.5, 0.5)}
			>
				<GradientLayer
					x={x}
					y={y}
					width={width}
					height={height}
					background={HOTSPOT_ICE_B}
					motion={slide(width * 0.16, height * 0.16, false)}
				/>
				<SvgLayer
					x={x}
					y={y}
					width={width}
					height={height}
					blend="color-dodge"
					render={(w, h) => (
						<DotSpecks seed={seed + 3} kind="glitter" width={w} height={h} count={70} />
					)}
				/>
			</Group>
		</>
	);
}

export const FOIL_RECIPES: Record<FoilRecipeId, FoilRecipeDef> = {
	'plain-base': {
		id: 'plain-base',
		title: 'Plain base',
		description: 'Tier 0: soft wash + glare only. The holo base every card carries.',
		tint: '#161018',
		phase: 0.4,
		render: (l) => <PlainBaseLayers {...l} />
	},
	'linear-holo': {
		id: 'linear-holo',
		title: 'Linear holo',
		description:
			'Rainbow bands over fine scanlines, color-dodged, sliding against a hard-lit barcode sparkle.',
		tint: '#101218',
		phase: 0,
		render: (l) => <LinearHoloLayers {...l} />
	},
	'rainbow-glitter': {
		id: 'rainbow-glitter',
		title: 'Rainbow glitter',
		description:
			'Two counter-sliding rainbow sheets with a glitter fleck field worked between them.',
		tint: '#14101a',
		phase: 1.1,
		render: (l) => <RainbowGlitterLayers {...l} />
	},
	'radiant-crosshatch': {
		id: 'radiant-crosshatch',
		title: 'Radiant crosshatch',
		description:
			'Two greyscale bar stacks at ±45°, darken-blended into a crosshatch, then lit by an ellipse of glow.',
		tint: '#0f1414',
		phase: 2.3,
		render: (l) => <RadiantCrosshatchLayers {...l} />
	},
	'cosmos-speckle': {
		id: 'cosmos-speckle',
		title: 'Cosmos speckle',
		description:
			'A star-speckled field color-burned against a drifting rainbow band, so galaxies glide as the light moves.',
		tint: '#0d1018',
		phase: 3.4,
		render: (l) => <CosmosSpeckleLayers {...l} />
	},
	'ice-crackle': {
		id: 'ice-crackle',
		title: 'Ice crackle',
		description:
			'Fracture lines exclusion-blended into a cool sheet  Efrost breaking the light instead of a rainbow.',
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
