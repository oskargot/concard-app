/**
 * The foil lab.
 *
 * Phase 1's actual deliverable. The foils are the product — a Concard is
 * supposed to feel like an object you'd want to screenshot — and they are built
 * from React Native blend modes that have to be verified on real hardware, on
 * both platforms, before anything else gets built on top of them.
 *
 * So every layer is individually switchable here: toggle it, cycle its blend
 * mode, nudge its opacity, and watch what happens on a card you can tilt. If a
 * blend mode misbehaves on a device, this screen is where that shows up, and the
 * fallback is to rebuild the layer in react-native-svg (also available in Expo
 * Go) rather than reaching for a development build.
 *
 * Not shipped to users; it lives under /dev like the web app's /dev/cards.
 */

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
import { BG_KEYS, FRAME_KEYS, type BgKey, type FrameKey } from '@/card/card-style';
import { FOIL_LAYERS, type FoilLayerName, type FoilOverride } from '@/card/foil/Foil';
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

	const [kind, setKind] = useState<FoilKind>('glitter');
	const [frame, setFrame] = useState<FrameKey>('silver');
	const [bg, setBg] = useState<BgKey>('blush');
	const [intensity, setIntensity] = useState(1);
	const [overrides, setOverrides] = useState<Partial<Record<FoilLayerName, FoilOverride>>>({});

	const patch = (layer: FoilLayerName, next: FoilOverride) =>
		setOverrides((prev) => ({ ...prev, [layer]: { ...prev[layer], ...next } }));

	const view = { ...DEMO_CARD, style: { ...DEMO_CARD.style, frame, bg } };

	return (
		<ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}>
			<View style={styles.stage}>
				<FlipCard
					width={cardWidth}
					renderFront={(rx, ry) => (
						<CardShell
							style={view.style}
							width={cardWidth}
							foil={kind}
							seed="foil-lab"
							rx={rx}
							ry={ry}
							intensity={intensity}
							foilOverrides={overrides}
						>
							<CardFace view={view} width={cardWidth} />
						</CardShell>
					)}
				/>
			</View>
			<Text style={styles.hint}>Drag the card to move the light</Text>

			<Section title="Foil">
				<Chips
					options={FOIL_KINDS}
					value={kind}
					onChange={(k) => {
						setKind(k);
						// overrides are per-layer and recipes differ per foil, so a
						// half-applied set from another foil would just be confusing
						setOverrides({});
					}}
				/>
			</Section>

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
