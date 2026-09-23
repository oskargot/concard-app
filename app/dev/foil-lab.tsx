/**
 * The foil lab: every foil kind on a real card, through the production path.
 *
 * There is nothing to toggle per layer any more — a foil is one shader recipe
 * (`src/card/foil/foil-sksl.ts`), and its look is tuned by editing the named
 * constants at the top of that file, which recompile on save. What this
 * screen is for is judging each recipe against real photo, name and frame on
 * a device, at rest and at full tilt, on both platforms.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/card/Card';
import { FlipCard } from '@/card/FlipCard';
import { DEMO_CARD } from '@/card/demo-card';
import { BGS, FRAME_KEYS, type BgKey, type FrameKey } from '@/card/card-style';
import { RECIPE_FOR_KIND } from '@/card/foil/Foil';
import { FOIL_KINDS, type FoilKind } from '@/card/tiers';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

const FACES: { value: BgKey; label: string }[] = [
	{ value: 'paper', label: 'Paper' },
	{ value: 'blush', label: 'Blush' },
	{ value: 'violet', label: 'Violet' },
	{ value: 'slate', label: 'Slate' }
];

const RECIPE_NOTES: Record<FoilKind, string> = {
	none: 'Tier 0. No shader — the sliding glare and the edge lip only.',
	glitter: 'Recipe “sprayed”: a photographed spray of paint flecks, each lit in the sliding bands.',
	holo: 'Recipe “linear”: stripes computed in the shader, rainbow repeating across the face.',
	cosmic: 'Recipe “stars”: four-point stars over fine dust.',
	mosaic: 'Recipe “mosaic”: a baked facet map, every triangle lit at its own tilt.'
};

export default function FoilLabScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const cardWidth = Math.min(width - space.xl * 2, 320);

	const [kind, setKind] = useState<FoilKind>('glitter');
	const [frame, setFrame] = useState<FrameKey>('silver');
	const [bg, setBg] = useState<BgKey>('blush');
	const [intensity, setIntensity] = useState(1);
	const [detail, setDetail] = useState<'full' | 'thumb'>('full');

	const view = { ...DEMO_CARD, style: { ...DEMO_CARD.style, frame, bg } };
	const recipe = kind === 'none' ? null : RECIPE_FOR_KIND[kind];

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: space.lg, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.intro}>
				<Text style={styles.eyebrow}>ON-DEVICE TEST BENCH</Text>
				<Text style={styles.title}>Foil lab</Text>
				<Text style={styles.body}>
					Drag the card. The light moves away from your finger and the pattern stays put. Judge each
					foil at rest and at full tilt, and check that the name and bio stay readable.
				</Text>
			</View>

			<View style={styles.stage}>
				<FlipCard
					width={cardWidth}
					flippable={false}
					renderFront={(rx, ry) => (
						<Card
							view={view}
							width={cardWidth}
							foil={kind}
							seed="foil-lab"
							rx={rx}
							ry={ry}
							intensity={intensity}
							detail={detail}
						/>
					)}
				/>
			</View>
			<Text style={styles.hint}>
				{recipe ? `SHADER RECIPE · ${recipe.toUpperCase()}` : 'NO SHADER · PLAIN CARD'}
			</Text>

			<Section title="Foil kind">
				<Chips options={FOIL_KINDS} value={kind} onChange={setKind} />
				<Text style={styles.note}>{RECIPE_NOTES[kind]}</Text>
			</Section>

			<Section title="Frame">
				<Chips options={FRAME_KEYS} value={frame} onChange={setFrame} />
				<Text style={styles.note}>The holo frame draws the “linear” recipe on a plain card.</Text>
			</Section>

			<Section title={`Intensity · ${intensity.toFixed(2)}`}>
				<View style={styles.stepRow}>
					<Stepper label="− 0.05" onPress={() => setIntensity((value) => clamp(value - 0.05))} />
					<Stepper label="+ 0.05" onPress={() => setIntensity((value) => clamp(value + 0.05))} />
					<Stepper label="Reset" onPress={() => setIntensity(1)} />
				</View>
			</Section>

			<Section title="Idle motion">
				<Chips options={['full', 'thumb'] as const} value={detail} onChange={setDetail} />
				<Text style={styles.note}>
					“full” drifts the light when untouched, as the hero card does. “thumb” holds still, as
					binder thumbnails do, so a grid never redraws every frame.
				</Text>
			</Section>

			<Section title="Card face">
				<View style={styles.faceRow}>
					{FACES.map((face) => (
						<Pressable
							key={face.value}
							onPress={() => setBg(face.value)}
							style={[styles.faceChoice, bg === face.value && styles.faceChoiceOn]}
						>
							<View style={[styles.faceSwatch, { backgroundColor: BGS[face.value] }]} />
							<Text style={styles.faceLabel}>{face.label}</Text>
						</Pressable>
					))}
				</View>
			</Section>

			<Section title="Tuning">
				<Text style={styles.note}>
					Every look value is a named constant in{' '}
					<Text style={styles.mono}>src/card/foil/foil-sksl.ts</Text>. Edit one, save, and the
					shader recompiles here. <Text style={styles.mono}>node scripts/foil-sksl.js</Text> prints
					the source for skialabs.dev.
				</Text>
			</Section>
		</ScrollView>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>{title}</Text>
			{children}
		</View>
	);
}

function Chips<T extends string>({
	options,
	value,
	onChange
}: {
	options: readonly T[];
	value: T;
	onChange: (next: T) => void;
}) {
	return (
		<View style={styles.chipWrap}>
			{options.map((opt) => {
				const on = opt === value;
				return (
					<Pressable
						key={opt}
						onPress={() => onChange(opt)}
						style={[styles.chip, on && styles.chipOn]}
					>
						<Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable onPress={onPress} style={styles.stepper}>
			<Text style={styles.stepperText}>{label}</Text>
		</Pressable>
	);
}

const clamp = (value: number) => Math.max(0, Math.min(1, Math.round(value * 100) / 100));

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	intro: { gap: space.xs },
	eyebrow: { ...type.meta, color: palette.teal },
	title: { ...type.hero, color: palette.cream },
	body: { ...type.body, color: palette.creamMute },
	stage: { alignItems: 'center', paddingVertical: space.sm },
	hint: { ...type.meta, color: palette.teal, textAlign: 'center', fontSize: 9 },
	section: {
		gap: space.md,
		padding: space.lg,
		borderRadius: radius.lg,
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	sectionTitle: { ...type.meta, color: palette.teal },
	note: { ...type.small, color: palette.creamFaint },
	mono: { color: palette.warm },
	chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
	chip: {
		paddingVertical: space.xs + 2,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	chipOn: {
		backgroundColor: palette.rose,
		borderColor: palette.rose
	},
	chipText: { ...type.small, color: palette.creamMute },
	chipTextOn: { color: palette.void, fontFamily: 'SpaceGrotesk-Bold' },
	stepRow: { flexDirection: 'row', gap: space.sm },
	stepper: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: space.sm,
		borderRadius: radius.md,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	stepperText: { ...type.small, color: palette.butter },
	faceRow: { flexDirection: 'row', gap: space.sm },
	faceChoice: { flex: 1, gap: space.xs, padding: 3, borderRadius: radius.md, borderWidth: 2 },
	faceChoiceOn: { borderColor: palette.teal },
	faceSwatch: { height: 34, borderRadius: radius.sm },
	faceLabel: { ...type.small, color: palette.creamMute, textAlign: 'center' }
});
