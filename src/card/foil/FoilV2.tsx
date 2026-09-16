/**
 * Production foil engine — moving reflection recipes on a real Concard face.
 *
 * Converts FlipCard's `rx`/`ry` tilt into the same 0..100% light coordinates
 * the sampler uses, then draws a recipe from `recipes.ts`. Production still
 * uses this engine by default; foil-lab keeps the legacy stack only for A/B
 * comparison while tuning on hardware.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
	useDerivedValue,
	useFrameCallback,
	useSharedValue,
	type SharedValue
} from 'react-native-reanimated';

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
	const idleTime = useSharedValue(0);
	const phase = (numericSeed % 628) / 100;

	// A real foil never looks self-illuminated. At rest, only the reflection moves:
	// a slow, narrow sweep around centre. Touch tilt takes over progressively and
	// the idle sweep fades back in as the card settles.
	useFrameCallback((frame) => {
		idleTime.value += (frame.timeSincePreviousFrame ?? 16) / 1000;
	});

	// Reflect opposite the drag. FlipCard already negates vertical input for rx,
	// so Y uses +rx while X uses -ry.
	const x = useDerivedValue(() => {
		const idle = 50 + 13 * Math.sin(idleTime.value * 0.34 + phase);
		const manual = 50 + (-ry.value / TILT_RANGE) * 50;
		const weight = Math.min(1, Math.hypot(rx.value, ry.value) / 1.5);
		return idle + (manual - idle) * weight;
	});
	const y = useDerivedValue(() => {
		const idle = 50 + 9 * Math.sin(idleTime.value * 0.23 + phase * 1.7 + 1.1);
		const manual = 50 + (rx.value / TILT_RANGE) * 50;
		const weight = Math.min(1, Math.hypot(rx.value, ry.value) / 1.5);
		return idle + (manual - idle) * weight;
	});

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
		overflow: 'hidden'
	}
});
