/**
 * Sticker lab: every sticker at every foil, loose and on a card, with no
 * Supabase (HANDOFF Phase 3). Deco art comes from the bundled fixtures, the
 * same bakes the ingest uploads.
 *
 * Query params, so the screenshot harness can pin a state:
 *   ?tilt=x,y   card tilt as the shader sees it, -1..1 each (0,0 = at rest)
 *   ?perf=1     only the performance card: 20 foiled stickers
 *
 * The web target draws the real SkSL foil (CanvasKit), but not fandom foil
 * (react-native-masked-view has no web mask) and not tilt from a finger.
 */

import { useEffect, useMemo, useState } from 'react';
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	useWindowDimensions,
	View
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';

import { Card } from '@/card/Card';
import { DEMO_CARD } from '@/card/demo-card';
import { TILT_RANGE } from '@/card/FlipCard';
import { STICKER_FOIL_LABELS, STICKER_FOILS, type StickerFoil } from '@/card/tiers';
import type { CardView, PlacedSticker } from '@/card/types';
import { STICKER_BASE_WIDTH } from '@/stickers/constants';
import { decoDefinition, fandomDefinition, fandomStickerId } from '@/stickers/definitions';
import { FANDOM_STYLE_LABELS, makeFandomDefinition } from '@/stickers/fandom-styles';
import { FIXTURE_STICKERS } from '@/stickers/fixtures.generated';
import { StickerRenderer } from '@/stickers/StickerRenderer';
import { FANDOM_STYLE_CATEGORIES } from '@/stickers/types';
import { Field } from '@/ui';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

// Each foiled sticker is its own Skia canvas, and on the web target each
// canvas is its own WebGL context, which Chrome caps at ~16 per page. So the
// web page shows two ladder rows (and ?perf=1 shows only the perf card);
// native shows all five.
const LADDER_DECO =
	Platform.OS === 'web' ? ['star', 'sparkles'] : ['star', 'sparkles', 'cat', 'rocket', 'rainbow'];
const LADDER_FANDOM = [
	{ id: 'scifi', label: 'Sci-fi', style: 'retro-sci-fi' },
	{ id: 'demo-poke', label: 'Pokémon', style: 'cute' }
] as const;

const TILTS: { label: string; value: [number, number] }[] = [
	{ label: 'Rest', value: [0, 0] },
	{ label: 'Left', value: [-0.8, 0] },
	{ label: 'Up-right', value: [0.6, -0.6] },
	{ label: 'Down', value: [0, 0.9] }
];

function parseTilt(raw: string | string[] | undefined): [number, number] {
	const [x, y] = String(raw ?? '')
		.split(',')
		.map(Number);
	return [Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0];
}

/** A plain sticker placement, for fixture cards. */
function place(
	sticker_id: string,
	x: number,
	y: number,
	foil: StickerFoil,
	extra: Partial<PlacedSticker> = {}
): PlacedSticker {
	return {
		id: `${sticker_id}-${x}-${y}`,
		sticker_id,
		x,
		y,
		rotation: 0,
		scale: 1,
		z_index: 1,
		foil,
		size: STICKER_BASE_WIDTH,
		...extra
	};
}

/** A glitter card with a glitter sticker on the photo, beside the card's own flecks. */
const GLITTER_CHECK: CardView = {
	...DEMO_CARD,
	affiliation: null,
	stickers: [
		place('sparkles', 0.3, 0.42, 'glitter', { scale: 1.3 }),
		place('heart', 0.72, 0.4, 'none', { scale: 1.1 })
	]
};

/** One sticker at each rung, spread over the card. */
const RUNGS_ON_CARD: CardView = {
	...DEMO_CARD,
	affiliation: null,
	stickers: [
		place('star', 0.2, 0.2, 'none', { rotation: -8 }),
		place('star', 0.78, 0.2, 'glitter', { rotation: 6 }),
		place('star', 0.5, 0.45, 'holo', { scale: 1.2 }),
		place('star', 0.22, 0.72, 'cosmic', { rotation: 12 }),
		place('star', 0.78, 0.72, 'mosaic', { rotation: -10 }),
		place(fandomStickerId('scifi'), 0.5, 0.92, 'holo', {
			kind: 'fandom',
			label: 'Sci-fi',
			style_category: 'retro-sci-fi',
			is_affiliation: false,
			size: 0.3
		})
	]
};

/** Twenty foiled stickers, the per-card cap, for the performance check. */
const TWENTY_FOILED: CardView = {
	...DEMO_CARD,
	affiliation: null,
	stickers: Array.from({ length: 20 }, (_, i) =>
		place(
			FIXTURE_STICKERS[i % FIXTURE_STICKERS.length].id,
			0.12 + (i % 4) * 0.25,
			0.1 + Math.floor(i / 4) * 0.2,
			STICKER_FOILS[1 + (i % 4)],
			{ id: `perf-${i}`, z_index: i, rotation: ((i * 37) % 30) - 15, scale: 0.8 }
		)
	)
};

export default function StickerLabScreen() {
	const params = useLocalSearchParams<{ tilt?: string; perf?: string }>();
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const [tilt, setTilt] = useState<[number, number]>(() => parseTilt(params.tilt));
	const rx = useSharedValue(0);
	const ry = useSharedValue(0);
	useEffect(() => {
		// u_tilt = [ry, -rx] / TILT_RANGE (SkiaFoil), so invert that here
		rx.value = -tilt[1] * TILT_RANGE;
		ry.value = tilt[0] * TILT_RANGE;
	}, [tilt, rx, ry]);

	const contentWidth = Math.min(width, 520) - space.lg * 2;
	// inside a section: its padding and hairline border come off too
	const cell = Math.floor((contentWidth - space.md * 2 - 2 - space.xs * 4) / 5);
	const cardWidth = Math.min(contentWidth, 320);
	const light = useMemo(() => ({ rx, ry }), [rx, ry]);

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: space.lg, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.intro}>
				<Text style={styles.eyebrow}>DEV · STICKERS</Text>
				<Text style={styles.title}>Sticker lab</Text>
				<Text style={styles.body}>
					Every rung of the foil ladder, loose and on a card. Foil is the card&apos;s own engine,
					lit by the card&apos;s light and clipped to each sticker&apos;s die cut.
				</Text>
			</View>

			<View style={styles.chips}>
				{TILTS.map((t) => {
					const on = t.value[0] === tilt[0] && t.value[1] === tilt[1];
					return (
						<Pressable
							key={t.label}
							onPress={() => setTilt(t.value)}
							style={[styles.chip, on && styles.chipOn]}
						>
							<Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
						</Pressable>
					);
				})}
			</View>

			{params.perf ? (
				<Section title="20 foiled stickers on one card">
					<View style={styles.center}>
						<Card view={TWENTY_FOILED} width={cardWidth} seed="perf" rx={rx} ry={ry} />
					</View>
				</Section>
			) : (
				<>
					<Section title="Glitter sticker on a glitter card">
						<View style={styles.center}>
							<Card
								view={GLITTER_CHECK}
								width={cardWidth}
								foil="glitter"
								seed="glitter-check"
								rx={rx}
								ry={ry}
							/>
						</View>
						<Text style={styles.note}>
							The sparkles sticker is glitter; the heart is plain. Its flecks should match the
							card&apos;s in size and catch the same glare.
						</Text>
					</Section>

					<Section title="The ladder, loose">
						<View style={styles.ladderHead}>
							{STICKER_FOILS.map((foil) => (
								<Text key={foil} style={[styles.colLabel, { width: cell }]}>
									{STICKER_FOIL_LABELS[foil]}
								</Text>
							))}
						</View>
						{LADDER_DECO.map((id) => {
							const definition = decoDefinition({ id });
							return (
								<View key={id} style={styles.row}>
									{STICKER_FOILS.map((foil) => (
										<View key={foil} style={[styles.cell, { width: cell, height: cell }]}>
											<StickerRenderer
												definition={definition}
												foil={foil}
												width={cell - space.sm}
												light={light}
											/>
										</View>
									))}
								</View>
							);
						})}
						{LADDER_FANDOM.map((f) => {
							const definition = fandomDefinition({
								id: fandomStickerId(f.id),
								label: f.label,
								style_category: f.style
							});
							return (
								<View key={f.id} style={styles.row}>
									{STICKER_FOILS.map((foil) => (
										<View key={foil} style={[styles.cell, { width: cell, height: cell }]}>
											<StickerRenderer
												definition={definition}
												foil={foil}
												width={cell - space.xs}
												light={light}
											/>
										</View>
									))}
								</View>
							);
						})}
					</Section>

					<Section title="Every rung on a card">
						<View style={styles.center}>
							<Card view={RUNGS_ON_CARD} width={cardWidth} seed="rungs" rx={rx} ry={ry} />
						</View>
					</Section>

					<Section title="Every fixture sticker">
						<View style={styles.wrap}>
							{FIXTURE_STICKERS.map((f) => (
								<View key={f.id} style={[styles.cell, { width: cell, height: cell }]}>
									<StickerRenderer
										definition={decoDefinition(f)}
										width={cell - space.sm}
										art="thumb"
									/>
								</View>
							))}
						</View>
					</Section>

					<FandomPlayground contentWidth={contentWidth} />
				</>
			)}
		</ScrollView>
	);
}

/** Type any fandom name and see it in every style category. */
function FandomPlayground({ contentWidth }: { contentWidth: number }) {
	const [query, setQuery] = useState('STAR TREK');
	const label = query.trim() || 'Fandom';
	const definitions = useMemo(
		() => FANDOM_STYLE_CATEGORIES.map((category) => makeFandomDefinition(label, category)),
		[label]
	);
	const cellWidth = (contentWidth - space.sm) / 2;

	return (
		<Section title="Fandom playground">
			<Field
				label="Fandom name"
				value={query}
				onChangeText={setQuery}
				placeholder="Type any fandom"
				autoCapitalize="words"
				autoCorrect={false}
				hint="Drawn by the generative renderer in every style category."
			/>
			<View style={styles.wrap}>
				{definitions.map((definition) => (
					<View key={definition.id} style={[styles.fandomCell, { width: cellWidth }]}>
						<StickerRenderer definition={definition} width={cellWidth - space.lg} />
						<Text style={styles.cellLabel}>{FANDOM_STYLE_LABELS[definition.styleCategory]}</Text>
					</View>
				))}
			</View>
		</Section>
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

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.lg, gap: space.lg, backgroundColor: palette.ground },
	intro: { gap: space.xs },
	eyebrow: { ...type.meta, color: palette.holo },
	title: { ...type.title, color: palette.textPrimary },
	body: { ...type.body, color: palette.textDim },
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
	chip: {
		paddingHorizontal: space.md,
		paddingVertical: space.xs,
		borderRadius: radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	chipOn: { backgroundColor: palette.holo, borderColor: palette.holo },
	chipText: { ...type.small, color: palette.textDim },
	chipTextOn: { color: palette.ground },
	section: {
		gap: space.sm,
		padding: space.md,
		borderRadius: radius.lg,
		backgroundColor: palette.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	sectionTitle: { ...type.meta, color: palette.textDim },
	note: { ...type.small, color: palette.textFaint },
	center: { alignItems: 'center' },
	ladderHead: { flexDirection: 'row', gap: space.xs },
	colLabel: { ...type.small, color: palette.textFaint, textAlign: 'center' },
	row: { flexDirection: 'row', gap: space.xs },
	wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
	cell: {
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: radius.md,
		backgroundColor: palette.raised
	},
	fandomCell: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
	cellLabel: { ...type.small, color: palette.textFaint }
});
