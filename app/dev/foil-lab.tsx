import { useState } from 'react';
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	useWindowDimensions,
	type ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFace } from '@/card/CardFace';
import { CardShell } from '@/card/CardShell';
import { FlipCard } from '@/card/FlipCard';
import { DEMO_CARD } from '@/card/demo-card';
import { BGS, type BgKey } from '@/card/card-style';
import type { SamplerFoilOptions } from '@/card/foil/Foil';
import type { SamplerFoilPreset } from '@/card/foil/FoilSwatch';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

const PRESETS: { value: SamplerFoilPreset; label: string }[] = [
	{ value: 'linear-holo', label: 'Linear holo' },
	{ value: 'rainbow-glitter', label: 'Glitter' },
	{ value: 'radiant-crosshatch', label: 'Crosshatch' },
	{ value: 'cosmos-speckle', label: 'Cosmos' },
	{ value: 'ice-crackle', label: 'Ice crackle' }
];

const BLENDS: { value: NonNullable<ViewStyle['mixBlendMode']>; label: string }[] = [
	{ value: 'screen', label: 'Screen' },
	{ value: 'soft-light', label: 'Soft light' },
	{ value: 'overlay', label: 'Overlay' },
	{ value: 'plus-lighter', label: 'Plus lighter' },
	{ value: 'color-dodge', label: 'Color dodge' },
	{ value: 'hard-light', label: 'Hard light' },
	{ value: 'luminosity', label: 'Luminosity' }
];

const FACES: { value: BgKey; label: string }[] = [
	{ value: 'paper', label: 'Paper' },
	{ value: 'blush', label: 'Blush' },
	{ value: 'violet', label: 'Violet' },
	{ value: 'slate', label: 'Slate' }
];

export default function FoilLabScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const cardWidth = Math.min(width - space.xl * 2, 320);
	const [preset, setPreset] = useState<SamplerFoilPreset>('linear-holo');
	const [blend, setBlend] = useState<NonNullable<ViewStyle['mixBlendMode']>>('screen');
	const [intensity, setIntensity] = useState(0.42);
	const [bg, setBg] = useState<BgKey>('blush');
	const view = { ...DEMO_CARD, style: { ...DEMO_CARD.style, frame: 'holo' as const, bg } };
	const foilSampler: SamplerFoilOptions = { preset, blend, intensity };

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: space.lg, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.intro}>
				<Text style={styles.eyebrow}>ON-DEVICE TEST BENCH</Text>
				<Text style={styles.title}>Holo lab</Text>
				<Text style={styles.body}>
					Drag the real card, then compare modes for clarity at rest and at full tilt.
				</Text>
			</View>

			<View style={styles.stage}>
				<FlipCard
					width={cardWidth}
					flippable={false}
					renderFront={(rx, ry) => (
						<CardShell
							style={view.style}
							width={cardWidth}
							foil="holo"
							seed="production-holo-lab"
							rx={rx}
							ry={ry}
							foilSampler={foilSampler}
						>
							<CardFace view={view} width={cardWidth} />
						</CardShell>
					)}
				/>
			</View>
			<Text style={styles.hint}>DRAG TO MOVE THE LIGHT · WATCH TEXT AND EDGES</Text>

			<Section title="Effect">
				<ChoiceGrid options={PRESETS} value={preset} onChange={setPreset} />
			</Section>

			<Section title="Outer blend mode">
				<ChoiceGrid options={BLENDS} value={blend} onChange={setBlend} />
				<Text style={styles.note}>
					Screen and Plus lighter cannot darken text. Overlay and Color dodge are punchier but less
					predictable on saturated faces.
				</Text>
			</Section>

			<Section title={`Intensity · ${intensity.toFixed(2)}`}>
				<View style={styles.stepRow}>
					<Stepper label="− 0.05" onPress={() => setIntensity((value) => clamp(value - 0.05))} />
					<Stepper label="+ 0.05" onPress={() => setIntensity((value) => clamp(value + 0.05))} />
					<Stepper label="Reset" onPress={() => setIntensity(0.42)} />
				</View>
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

			<View style={styles.readability}>
				<Text style={styles.readabilityTitle}>What to check on your phone</Text>
				<Text style={styles.note}>
					1. No hard layer edge at maximum tilt.{'\n'}2. Name and bio stay readable while moving.
					{'\n'}3. Rainbow travel is obvious without becoming a tinted curtain.
				</Text>
			</View>
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

function ChoiceGrid<T extends string>({
	options,
	value,
	onChange
}: {
	options: { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<View style={styles.choices}>
			{options.map((option) => (
				<Pressable
					key={option.value}
					onPress={() => onChange(option.value)}
					style={[styles.choice, value === option.value && styles.choiceOn]}
				>
					<Text style={[styles.choiceText, value === option.value && styles.choiceTextOn]}>
						{option.label}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable style={styles.stepper} onPress={onPress}>
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
	sectionTitle: { ...type.meta, color: palette.cream },
	choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
	choice: {
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	choiceOn: { backgroundColor: palette.teal, borderColor: palette.teal },
	choiceText: { ...type.small, color: palette.creamMute },
	choiceTextOn: { color: palette.void, fontFamily: 'SpaceGrotesk-Bold' },
	note: { ...type.small, color: palette.creamMute },
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
	faceLabel: { ...type.small, color: palette.creamMute, textAlign: 'center' },
	readability: {
		gap: space.sm,
		padding: space.lg,
		borderRadius: radius.lg,
		backgroundColor: 'rgba(69,229,213,0.08)',
		borderWidth: 1,
		borderColor: 'rgba(69,229,213,0.25)'
	},
	readabilityTitle: { ...type.bodyStrong, color: palette.teal }
});
