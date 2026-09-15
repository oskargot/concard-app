/**
 * The foil lab.
 *
 * Two engines on one real Concard face:
 *
 *  - **legacy** — the production layer stack in `Foil.tsx`. Every named layer
 *    is toggleable / blend-cycleable / opacity-nudgeable, which is how we find
 *    blend modes that misbehave on a given device.
 *  - **v2** — shine + glare recipes from `recipes.ts` (the sampler techniques,
 *    driven by FlipCard tilt). This is the experiment: pick a kind or force a
 *    recipe and see whether it reads as foil on a real card face.
 *
 * Not shipped to users; lives under /dev.
 */

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

/** Every CSS blend mode React Native 0.86 accepts, in `mixBlendMode`'s order. */
const BLEND_MODES: NonNullable<ViewStyle['mixBlendMode']>[] = [
	'normal',
	'multiply',
	'screen',
	'overlay',
	'darken',
	'lighten',
	'color-dodge',
	'color-burn',
	'hard-light',
	'soft-light',
	'difference',
	'exclusion',
	'hue',
	'saturation',
	'color',
	'luminosity',
	'plus-lighter'
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
		<ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}>
			<View style={styles.stage}>
				<FlipCard
					width={cardWidth}
					renderFront={(rx, ry) => (
						<Card
							view={view}
							width={cardWidth}
							foil={kind}
							seed="foil-lab"
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
			<Text style={styles.hint}>Drag the card to move the light</Text>

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

			<Section title="Face">
				<Chips options={BG_KEYS} value={bg} onChange={setBg} />
			</Section>

			<Section title={`Intensity · ${intensity.toFixed(2)}`}>
				<View style={styles.row}>
					<Stepper label="−" onPress={() => setIntensity((v) => clamp(v - 0.1))} />
					<Stepper label="+" onPress={() => setIntensity((v) => clamp(v + 0.1))} />
					<Stepper label="reset" wide onPress={() => setIntensity(1)} />
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

function Stepper({
	label,
	onPress,
	wide,
	small
}: {
	label: string;
	onPress: () => void;
	wide?: boolean;
	small?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.stepper, wide && styles.stepperWide, small && styles.stepperSmall]}
		>
			<Text style={styles.stepperText}>{label}</Text>
		</Pressable>
	);
}

const clamp = (n: number) => Math.max(0, Math.min(2, Math.round(n * 100) / 100));

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.lg },
	stage: { alignItems: 'center' },
	hint: { ...type.meta, color: palette.creamFaint, textAlign: 'center' },
	section: {
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		padding: space.md,
		gap: space.sm
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
	chipOn: {
		backgroundColor: palette.rose,
		borderColor: palette.rose,
		boxShadow: `0 0 14px ${palette.roseGlow}`
	},
	chipText: { ...type.small, color: palette.creamMute },
	chipTextOn: { color: palette.void, fontFamily: 'SpaceGrotesk-Bold' },
	layerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		paddingVertical: space.xs,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: palette.line
	},
	layerRowOff: { opacity: 0.45 },
	layerToggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs, width: 96 },
	checkbox: { color: palette.creamFaint, fontSize: 13 },
	checkboxOn: { color: palette.teal },
	layerName: { ...type.small, color: palette.cream },
	blendBtn: {
		flex: 1,
		paddingVertical: space.xs,
		paddingHorizontal: space.sm,
		borderRadius: radius.sm,
		backgroundColor: palette.raisedHigh
	},
	blendText: { ...type.small, color: palette.butter, fontSize: 11 },
	opacityGroup: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
	opacityText: { ...type.small, color: palette.creamMute, width: 38, textAlign: 'center' },
	stepper: {
		minWidth: 40,
		alignItems: 'center',
		paddingVertical: space.xs + 2,
		paddingHorizontal: space.sm,
		borderRadius: radius.sm,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	stepperWide: { minWidth: 120 },
	stepperSmall: { minWidth: 30, paddingVertical: 2 },
	stepperText: { ...type.small, color: palette.cream }
});
