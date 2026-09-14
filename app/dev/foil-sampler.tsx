/**
 * Foil sampler.
 *
 * A direct port of five swatches from the `Foil Sampler` design export —
 * linear holo, rainbow glitter, radiant crosshatch, cosmos speckle, and ice
 * crackle. The other eight lean on `conic-gradient`, which RN's
 * `experimental_backgroundImage` doesn't parse, so they're out of scope here.
 *
 * This is a design reference, not a foil kind: none of these five are wired
 * into `tiers.ts`. It exists to check the export's specific techniques against
 * RN's real blend modes, the same way `/dev/foil-lab` checks the production
 * recipes — before anyone decides which, if any, become an actual card tier.
 *
 * One shared clock drives every swatch's idle sweep (`FoilSwatch` phase-offsets
 * each one off it), so pausing or speeding up "Motion" affects the whole grid
 * at once, matching the export's single animation loop.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { FoilSwatch, SAMPLER_SWATCHES } from '@/card/foil/FoilSwatch';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

export default function FoilSamplerScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const swatchWidth = Math.min((width - space.xl * 2 - space.lg) / 2, 210);

	const [animate, setAnimate] = useState(true);
	const [speed, setSpeed] = useState(1);
	const animateSV = useSharedValue(true);
	const speedSV = useSharedValue(1);
	const now = useSharedValue(0);

	useFrameCallback((frame) => {
		if (!animateSV.value) return;
		const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
		now.value += dt * speedSV.value;
	});

	const toggleAnimate = () =>
		setAnimate((v) => {
			animateSV.value = !v;
			return !v;
		});

	const bumpSpeed = (delta: number) =>
		setSpeed((v) => {
			const next = Math.max(0.1, Math.min(3, Math.round((v + delta) * 10) / 10));
			speedSV.value = next;
			return next;
		});

	return (
		<ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}>
			<Text style={styles.hint}>
				Drag a swatch to take over its light — release to hand it back to the sweep.
			</Text>

			<View style={styles.controls}>
				<Text style={styles.controlsLabel}>Motion</Text>
				<Pressable onPress={toggleAnimate} style={[styles.chip, animate && styles.chipOn]}>
					<Text style={[styles.chipText, animate && styles.chipTextOn]}>
						{animate ? 'sweeping' : 'paused'}
					</Text>
				</Pressable>
				<View style={styles.speedGroup}>
					<Stepper label="−" onPress={() => bumpSpeed(-0.1)} />
					<Text style={styles.speedText}>{speed.toFixed(1)}×</Text>
					<Stepper label="+" onPress={() => bumpSpeed(0.1)} />
				</View>
			</View>

			<View style={styles.grid}>
				{SAMPLER_SWATCHES.map((def) => (
					<FoilSwatch key={def.id} def={def} width={swatchWidth} now={now} />
				))}
			</View>
		</ScrollView>
	);
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable onPress={onPress} style={styles.stepper}>
			<Text style={styles.stepperText}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.lg },
	hint: { ...type.meta, color: palette.creamFaint, textAlign: 'center' },
	controls: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		padding: space.md
	},
	controlsLabel: { ...type.meta, color: palette.teal, marginRight: space.xs },
	chip: {
		paddingVertical: space.xs + 2,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	chipOn: { backgroundColor: palette.rose, borderColor: palette.rose },
	chipText: { ...type.small, color: palette.creamMute },
	chipTextOn: { color: palette.void, fontFamily: 'SpaceGrotesk-Bold' },
	speedGroup: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginLeft: 'auto' },
	speedText: { ...type.small, color: palette.cream, width: 42, textAlign: 'center' },
	stepper: {
		minWidth: 32,
		alignItems: 'center',
		paddingVertical: space.xs,
		borderRadius: radius.sm,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	stepperText: { ...type.small, color: palette.cream },
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: space.lg,
		justifyContent: 'center'
	}
});
