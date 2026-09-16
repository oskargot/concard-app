/**
 * Stage 1 playground: generate fandom text stickers from a name + category.
 *
 * This is the visual test bench for the on-device type renderer. It does not
 * touch production cards, inventory, or the affiliation picker — those wait
 * on product review of whether the stickers read as Concard, not as logos.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BGS } from '@/card/card-style';
import { FANDOM_STYLE_LABELS, makeFandomDefinition } from '@/stickers/fandom-styles';
import { StickerRenderer } from '@/stickers/StickerRenderer';
import { FANDOM_STYLE_CATEGORIES, type DecoStickerDefinition } from '@/stickers/types';
import { Field } from '@/ui';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

const PRESET_LABELS = [
	'STAR TREK',
	'HOMESTUCK',
	'Pokémon',
	'Dungeon Meshi',
	'The Legend of Zelda',
	"Baldur's Gate 3",
	'Doctor Who',
	'Splatoon',
	'Final Fantasy XIV'
];

const EDGE_LABELS = ['X', 'OK', 'JoJo', 'Neon Genesis Evangelion'];

const SIZES: { value: number; label: string }[] = [
	{ value: 72, label: 'Small' },
	{ value: 120, label: 'Card' },
	{ value: 168, label: 'Hero' },
	{ value: 240, label: 'Large' }
];

const BACKGROUNDS: { value: keyof typeof BGS | 'void'; label: string; color: string }[] = [
	{ value: 'void', label: 'Night', color: palette.base },
	{ value: 'paper', label: 'Paper', color: BGS.paper },
	{ value: 'blush', label: 'Blush', color: BGS.blush },
	{ value: 'slate', label: 'Slate', color: BGS.slate }
];

const DECO_PLACEHOLDER: DecoStickerDefinition = {
	id: 'deco-placeholder',
	name: 'Star Drop',
	kind: 'deco',
	imageUrl: ''
};

export default function StickerLabScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const [query, setQuery] = useState('STAR TREK');
	const [size, setSize] = useState(168);
	const [bg, setBg] = useState<(typeof BACKGROUNDS)[number]['value']>('void');
	const stageColor = BACKGROUNDS.find((item) => item.value === bg)?.color ?? palette.base;

	const previewLabel = query.trim() || 'Fandom';
	const previewDefs = useMemo(
		() => FANDOM_STYLE_CATEGORIES.map((category) => makeFandomDefinition(previewLabel, category)),
		[previewLabel]
	);

	const gridGap = space.sm;
	const columns = size >= 200 ? 1 : size >= 140 ? 2 : 3;
	const cellWidth = (width - space.xl * 2 - space.lg * 2 - gridGap * (columns - 1)) / columns;
	const stickerWidth = Math.min(size, cellWidth - space.sm * 2);

	return (
		<ScrollView
			keyboardShouldPersistTaps="handled"
			contentContainerStyle={[
				styles.page,
				{ paddingTop: space.lg, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.intro}>
				<Text style={styles.eyebrow}>STAGE 1 · TYPE RENDERER</Text>
				<Text style={styles.title}>Fandom stickers</Text>
				<Text style={styles.body}>
					Live SVG from a name and a Concard category. White rims are vector strokes. Foil is wired
					on the API and not drawn yet.
				</Text>
			</View>

			<View style={styles.section}>
				<Field
					label="Fandom name"
					value={query}
					onChangeText={setQuery}
					placeholder="Type any fandom"
					autoCapitalize="words"
					autoCorrect={false}
					hint="Previewed in every style below. Production picker is unchanged."
				/>
				<ChipRow
					label="Size"
					options={SIZES.map((item) => ({ value: String(item.value), label: item.label }))}
					value={String(size)}
					onChange={(next) => setSize(Number(next))}
				/>
				<ChipRow
					label="Stage"
					options={BACKGROUNDS.map((item) => ({ value: item.value, label: item.label }))}
					value={bg}
					onChange={(next) => {
						const match = BACKGROUNDS.find((item) => item.value === next);
						if (match) setBg(match.value);
					}}
				/>
			</View>

			<View style={[styles.section, styles.stage, { backgroundColor: stageColor }]}>
				<Text style={[styles.sectionTitle, stageOnDark(stageColor) && styles.sectionTitleOnDark]}>
					{previewLabel} · every category
				</Text>
				<View style={[styles.grid, { gap: gridGap }]}>
					{previewDefs.map((definition) => (
						<View key={definition.id} style={[styles.cell, { width: cellWidth }]}>
							<StickerRenderer definition={definition} width={stickerWidth} seed={definition.id} />
							<Text style={[styles.cellLabel, stageOnDark(stageColor) && styles.cellLabelOnDark]}>
								{FANDOM_STYLE_LABELS[definition.styleCategory]}
							</Text>
						</View>
					))}
				</View>
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Presets</Text>
				<Text style={styles.note}>Tap a name to load it into the editor above.</Text>
				<View style={styles.presetWrap}>
					{PRESET_LABELS.map((label) => (
						<Pressable
							key={label}
							onPress={() => setQuery(label)}
							style={[styles.preset, query.trim() === label && styles.presetOn]}
						>
							<Text style={[styles.presetText, query.trim() === label && styles.presetTextOn]}>
								{label}
							</Text>
						</Pressable>
					))}
				</View>
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Preset grid · picker size</Text>
				<Text style={styles.note}>
					Each row is one fandom across all seven categories, at 96px — a sticker-picker tile.
				</Text>
				{PRESET_LABELS.map((label) => (
					<PresetRow key={label} label={label} onPress={() => setQuery(label)} />
				))}
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Edge cases · card size</Text>
				<Text style={styles.note}>Short marks and a long title at ~card-sticker scale (52px).</Text>
				{EDGE_LABELS.map((label) => (
					<PresetRow key={label} label={label} compact onPress={() => setQuery(label)} />
				))}
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Deco placeholder</Text>
				<Text style={styles.note}>
					Stage 1 only needs the fandom path. Deco is a dashed PNG slot so `StickerRenderer` already
					has a second kind.
				</Text>
				<View style={styles.decoRow}>
					<StickerRenderer definition={DECO_PLACEHOLDER} width={96} />
					<StickerRenderer definition={DECO_PLACEHOLDER} width={52} />
				</View>
			</View>
		</ScrollView>
	);
}

function PresetRow({
	label,
	compact,
	onPress
}: {
	label: string;
	compact?: boolean;
	onPress: () => void;
}) {
	const stickerWidth = compact ? 52 : 96;
	return (
		<Pressable onPress={onPress} style={styles.presetRow}>
			<Text style={styles.presetRowTitle}>{label}</Text>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.presetRowStickers}>
					{FANDOM_STYLE_CATEGORIES.map((category) => (
						<View key={category} style={styles.presetItem}>
							<StickerRenderer
								definition={makeFandomDefinition(label, category)}
								width={stickerWidth}
							/>
							<Text style={styles.presetItemLabel}>{FANDOM_STYLE_LABELS[category]}</Text>
						</View>
					))}
				</View>
			</ScrollView>
		</Pressable>
	);
}

function ChipRow({
	label,
	options,
	value,
	onChange
}: {
	label: string;
	options: { value: string; label: string }[];
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<View style={styles.chipBlock}>
			<Text style={styles.chipLabel}>{label}</Text>
			<View style={styles.chipWrap}>
				{options.map((option) => {
					const on = option.value === value;
					return (
						<Pressable
							key={option.value}
							onPress={() => onChange(option.value)}
							style={[styles.chip, on && styles.chipOn]}
						>
							<Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

function stageOnDark(color: string): boolean {
	return color === palette.base || color === BGS.slate;
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	intro: { gap: space.xs },
	eyebrow: { ...type.meta, color: palette.teal },
	title: { ...type.hero, color: palette.cream },
	body: { ...type.body, color: palette.creamMute },
	section: {
		gap: space.md,
		padding: space.lg,
		borderRadius: radius.lg,
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	stage: { borderColor: palette.lineStrong },
	sectionTitle: { ...type.meta, color: palette.teal },
	sectionTitleOnDark: { color: palette.teal },
	note: { ...type.small, color: palette.creamFaint },
	grid: { flexDirection: 'row', flexWrap: 'wrap' },
	cell: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
	cellLabel: { ...type.meta, color: palette.void, fontSize: 9, textAlign: 'center' },
	cellLabelOnDark: { color: palette.creamFaint },
	presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
	preset: {
		paddingVertical: space.xs + 2,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	presetOn: { backgroundColor: palette.teal, borderColor: palette.teal },
	presetText: { ...type.small, color: palette.creamMute },
	presetTextOn: { color: palette.void, fontFamily: 'SpaceGrotesk-Bold' },
	presetRow: { gap: space.sm, paddingVertical: space.sm },
	presetRowTitle: { ...type.bodyStrong, color: palette.cream },
	presetRowStickers: { flexDirection: 'row', gap: space.md, paddingRight: space.lg },
	presetItem: { alignItems: 'center', gap: 4, minWidth: 72 },
	presetItemLabel: { ...type.meta, color: palette.creamFaint, fontSize: 8 },
	decoRow: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
	chipBlock: { gap: space.xs },
	chipLabel: { ...type.meta, color: palette.creamMute },
	chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
	chip: {
		paddingVertical: space.xs + 2,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	chipOn: { backgroundColor: palette.teal, borderColor: palette.teal },
	chipText: { ...type.small, color: palette.creamMute },
	chipTextOn: { color: palette.void, fontFamily: 'SpaceGrotesk-Bold' }
});
