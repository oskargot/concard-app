import { useState } from 'react';
import {
	Linking,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	useWindowDimensions,
	type ViewStyle
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/card/Card';
import { FlipCard } from '@/card/FlipCard';
import { DEMO_CARD } from '@/card/demo-card';
import { BG_KEYS, FRAME_KEYS, type BgKey, type FrameKey } from '@/card/card-style';
import {
	FOIL_LAYERS,
	type FoilEngine,
	type FoilLayerName,
	type FoilOverride
} from '@/card/foil/Foil';
import {
	FOIL_RECIPES,
	FOIL_RECIPE_IDS,
	V2_KIND_RECIPES,
	type FoilRecipeId
} from '@/card/foil/recipes';
import { FOIL_KINDS, type FoilKind } from '@/card/tiers';
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

	const [engine, setEngine] = useState<FoilEngine>('v2');
	const [kind, setKind] = useState<FoilKind>('glitter');
	const [recipeOverride, setRecipeOverride] = useState<FoilRecipeId | null>(null);
	const [frame, setFrame] = useState<FrameKey>('silver');
	const [bg, setBg] = useState<BgKey>('blush');
	const [intensity, setIntensity] = useState(1);
	const [overrides, setOverrides] = useState<Partial<Record<FoilLayerName, FoilOverride>>>({});

	const patch = (layer: FoilLayerName, next: FoilOverride) =>
		setOverrides((prev) => ({ ...prev, [layer]: { ...prev[layer], ...next } }));

	const view = { ...DEMO_CARD, style: { ...DEMO_CARD.style, frame, bg } };
	const activeRecipe = recipeOverride ?? V2_KIND_RECIPES[kind];
	const recipeDef = FOIL_RECIPES[activeRecipe];

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
						<Card
							view={view}
							width={cardWidth}
							foil="holo"
							seed="production-holo-lab"
							rx={rx}
							ry={ry}
							intensity={intensity}
							foilOverrides={engine === 'legacy' ? overrides : undefined}
							foilEngine={engine}
							foilRecipe={engine === 'v2' ? (recipeOverride ?? undefined) : undefined}
						/>
					)}
				/>
			</View>
			<Text style={styles.hint}>DRAG TO MOVE THE LIGHT · WATCH TEXT AND EDGES</Text>

			<Section title="Engine">
				<Chips
					options={['v2', 'legacy'] as const}
					value={engine}
					onChange={(next) => {
						setEngine(next);
						setOverrides({});
						if (next === 'legacy') setRecipeOverride(null);
					}}
				/>
				<Text style={styles.note}>
					{engine === 'v2'
						? 'Shine + glare recipes (sampler techniques on a real card). Production still uses legacy.'
						: 'Production layer stack — toggle layers / blend modes below.'}
				</Text>
				<Link href="/dev/foil-sampler" style={styles.link}>
					Open blank-card sampler →
				</Link>
			</Section>

			<Section title="Foil kind">
				<Chips
					options={FOIL_KINDS}
					value={kind}
					onChange={(k) => {
						setKind(k);
						setOverrides({});
						// kind change clears a forced recipe so the draft map applies
						setRecipeOverride(null);
					}}
				/>
				{engine === 'v2' ? (
					<Text style={styles.note}>
						Draft map: {kind} → {V2_KIND_RECIPES[kind]}
					</Text>
				) : null}
			</Section>

			{engine === 'v2' ? (
				<Section title="Recipe override">
					<Chips
						options={['auto', ...FOIL_RECIPE_IDS] as const}
						value={recipeOverride ?? 'auto'}
						onChange={(id) => setRecipeOverride(id === 'auto' ? null : (id as FoilRecipeId))}
					/>
					<Text style={styles.recipeTitle}>{recipeDef.title}</Text>
					<Text style={styles.note}>{recipeDef.description}</Text>
				</Section>
			) : null}

			<Section title="Frame">
				<Chips options={FRAME_KEYS} value={frame} onChange={setFrame} />
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

			{engine === 'legacy' ? (
				<Section title="Layers">
					<Text style={styles.note}>
						Layers not used by the current foil are greyed out. Tap a blend mode to cycle it.
					</Text>
					{FOIL_LAYERS.map((layer) => (
						<LayerRow
							key={layer}
							layer={layer}
							override={overrides[layer]}
							onPatch={(next) => patch(layer, next)}
						/>
					))}
					<Stepper label="reset all layers" wide onPress={() => setOverrides({})} />
				</Section>
			) : (
				<Section title="Reference">
					<Pressable
						onPress={() => Linking.openURL('https://poke-holo.simey.me/')}
						style={styles.refBtn}
					>
						<Text style={styles.refText}>poke-holo.simey.me — technique reference</Text>
					</Pressable>
				</Section>
			)}
		</ScrollView>
	);
}

function LayerRow({
	layer,
	override,
	onPatch
}: {
	layer: FoilLayerName;
	override?: FoilOverride;
	onPatch: (next: FoilOverride) => void;
}) {
	const enabled = override?.enabled !== false;
	const blend = override?.blend;
	const opacity = override?.opacity;

	const cycleBlend = () => {
		const i = blend ? BLEND_MODES.indexOf(blend) : -1;
		onPatch({ blend: BLEND_MODES[(i + 1) % BLEND_MODES.length] });
	};

	return (
		<View style={[styles.layerRow, !enabled && styles.layerRowOff]}>
			<Pressable onPress={() => onPatch({ enabled: !enabled })} style={styles.layerToggle}>
				<Text style={[styles.checkbox, enabled && styles.checkboxOn]}>{enabled ? '●' : '○'}</Text>
				<Text style={styles.layerName}>{layer}</Text>
			</Pressable>

			<Pressable onPress={cycleBlend} style={styles.blendBtn}>
				<Text style={styles.blendText}>{blend ?? 'default'}</Text>
			</Pressable>

			<View style={styles.opacityGroup}>
				<Stepper
					label="−"
					small
					onPress={() => onPatch({ opacity: clamp((opacity ?? 0.5) - 0.05) })}
				/>
				<Text style={styles.opacityText}>{opacity === undefined ? '—' : opacity.toFixed(2)}</Text>
				<Stepper
					label="+"
					small
					onPress={() => onPatch({ opacity: clamp((opacity ?? 0.5) + 0.05) })}
				/>
			</View>
		</View>
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
	sectionTitle: { ...type.meta, color: palette.teal },
	note: { ...type.small, color: palette.creamFaint },
	recipeTitle: { ...type.subtitle, color: palette.cream },
	link: { ...type.bodyStrong, color: palette.teal, paddingTop: space.xs },
	refBtn: {
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		borderRadius: radius.sm,
		backgroundColor: palette.raisedHigh
	},
	refText: { ...type.small, color: palette.butter },
	row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
	chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
	chip: {
		paddingVertical: space.xs + 2,
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
