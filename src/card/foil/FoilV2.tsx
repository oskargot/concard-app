/**
 * Foil engine v2 — shine + glare recipes on a real Concard face.
 *
 * Converts FlipCard's `rx`/`ry` tilt into the same 0..100% light coordinates
 * the sampler uses, then draws a recipe from `recipes.ts`. Production still
 * defaults to the legacy layer stack in `Foil.tsx`; this exists so foil-lab
 * can A/B the candidate recipes on hardware before any tier swap.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { FoilKind } from '../tiers';
import { EdgeLip } from './layers';
import { FOIL_RECIPES, V2_KIND_RECIPES, type FoilRecipeId } from './recipes';
import { hashSeed } from './speckle';

/** Matches FlipCard's clamp — light maps across the same range. */
const TILT_RANGE = 16;

export interface FoilV2Props {
	kind: FoilKind;
	width: number;
	height: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	seed: string;
	radius?: number;
	intensity?: number;
	/** Override the kind→recipe map — foil-lab uses this to try ice-crackle etc. */
	recipe?: FoilRecipeId;
}

export function FoilV2({
	kind,
	width,
	height,
	rx,
	ry,
	seed,
	radius = 0,
	intensity = 1,
	recipe
}: FoilV2Props) {
	const recipeId = recipe ?? V2_KIND_RECIPES[kind];
	const def = FOIL_RECIPES[recipeId];
	const numericSeed = useMemo(() => hashSeed(seed), [seed]);

	// Light sits opposite the tilt, matching legacy Foil and the web card.
	const x = useDerivedValue(() => 50 + (-ry.value / TILT_RANGE) * 50);
	const y = useDerivedValue(() => 50 + (-rx.value / TILT_RANGE) * 50);

	if (intensity <= 0) return null;

	return (
		<View
			style={[StyleSheet.absoluteFill, styles.stack, { borderRadius: radius, opacity: intensity }]}
			pointerEvents="none"
		>
			{def.render({ x, y, width, height, seed: numericSeed })}
			<EdgeLip width={width} radius={radius} />
		</View>
	);
}

const styles = StyleSheet.create({
	stack: {
		isolation: 'isolate',
		overflow: 'hidden'
	}
});
