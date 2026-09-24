/**
 * Every card look on fixture data — the direct equivalent of the web app's
 * `/dev/cards`. Its value is that regressions in the renderer show up as a
 * card that looks wrong next to fifteen that look right, which is far easier
 * to spot than reading a diff.
 *
 * Grouped by the card spec's axes: photo shapes, divider positions, link
 * counts, alignments, the fit edge cases, the back, and binder size — which is
 * the same layout scaled to ~106 px, where the name stays legible and small
 * text becomes texture.
 */

import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/card/Card';
import { CardBack } from '@/card/CardBack';
import { StaticCard } from '@/card/FlipCard';
import { DEMO_CARD } from '@/card/demo-card';
import {
	ALIGNMENTS,
	FRAME_KEYS,
	PHOTO_SHAPES,
	type BgKey,
	type CardStyle
} from '@/card/card-style';
import { photoHeightMax } from '@/card/layout/front';
import { CARD_TIERS, foilForTier } from '@/card/tiers';
import type { CardLink, CardView } from '@/card/types';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

/** A representative slice of the 18 backgrounds: pastels, saturated hues, the dark one. */
const BG_SAMPLE: BgKey[] = ['paper', 'blush', 'butter', 'cyan', 'violet', 'slate'];

const EIGHT_LINKS: CardLink[] = [
	{ url: 'https://instagram.com/pixelpastrycafe', handle: '@pixelpastrycafe' },
	{ url: 'https://bsky.app/profile/rafa.bsky.social', handle: '@rafa.bsky.social' },
	{ url: 'https://rafadraws.itch.io', handle: 'rafadraws' },
	{ url: 'https://oskargot.space', handle: 'oskargot.space' },
	{ url: 'https://twitch.tv/rafadraws', handle: 'rafadraws' },
	{ url: 'https://ko-fi.com/rafadraws', handle: 'rafadraws' },
	{ url: 'https://discord.gg/concard', handle: 'discord.gg/concard' },
	{ url: 'https://tiktok.com/@rafadraws', handle: '@rafadraws' }
];

const LONG_BIO =
	'Inks comics too slowly, sells stickers too cheaply. Table H14 all weekend — say hi and ask about the zine. Trades welcome, tea preferred!!';

export default function CardGalleryScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const hero = Math.min((width - space.xl * 2 - space.md) / 2, 180);
	const binder = Math.min((width - space.xl * 2 - space.sm * 2) / 3, 106);

	const v = (patch: Partial<CardView>, style: Partial<CardStyle> = {}): CardView => ({
		...DEMO_CARD,
		...patch,
		style: { ...DEMO_CARD.style, ...style }
	});

	return (
		<ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}>
			<Group title="Photo shapes · no photo draws the outline only">
				<Row>
					{PHOTO_SHAPES.map((photo_shape) => (
						<Labelled key={photo_shape} label={photo_shape}>
							<Sample view={v({}, { photo_shape })} width={hero} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Divider · one link row · H 112 / 140 / 196 / H_max 234 (bio hidden)">
				<Row>
					{[112, 140, 196, photoHeightMax(1)].map((photo_height) => (
						<Labelled key={photo_height} label={`H ${photo_height}`}>
							<Sample
								view={v({ bio: LONG_BIO, links: EIGHT_LINKS.slice(0, 1) }, { photo_height })}
								width={hero}
							/>
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Links · 0 / 1 / 4 / 8 (5–8 under the default sticker)">
				<Row>
					{[0, 1, 4, 8].map((n) => (
						<Labelled key={n} label={`${n} links`}>
							<Sample
								view={v({ links: EIGHT_LINKS.slice(0, n), bio: LONG_BIO }, { photo_height: 112 })}
								width={hero}
							/>
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Alignment · name, username row, bio">
				<Row>
					{ALIGNMENTS.map((alignment) => (
						<Labelled key={alignment} label={alignment}>
							<Sample
								view={v({ pronouns: 'they/them', affiliation: null }, { alignment })}
								width={hero}
							/>
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Fit · long name, 20-char username, long pronouns">
				<Row>
					<Labelled label="name cut">
						<Sample view={v({ title: 'Alexandria Montgomery-Vale' })} width={hero} />
					</Labelled>
					<Labelled label="centre collision">
						<Sample
							view={v(
								{ handle: 'abcdefghijklmnopqrst', pronouns: 'she/they', affiliation: null },
								{ alignment: 'center' }
							)}
							width={hero}
						/>
					</Labelled>
					<Labelled label="pill truncates">
						<Sample view={v({ pronouns: 'she/her/hers/they/them' })} width={hero} />
					</Labelled>
				</Row>
			</Group>

			<Group title="Edges">
				<Row>
					{FRAME_KEYS.map((frame) => (
						<Labelled key={frame} label={frame}>
							<Sample view={v({}, { frame })} width={hero} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Faces">
				<Row>
					{BG_SAMPLE.map((bg) => (
						<Labelled key={bg} label={bg}>
							<Sample view={v({}, { bg })} width={hero} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Tiers · the foil covers the whole face">
				<Row>
					{CARD_TIERS.map((spec) => (
						<Labelled key={spec.tier} label={`T${spec.tier} · ${spec.label}`}>
							<Sample view={DEMO_CARD} width={hero} tier={spec.tier} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Back · qr / offline placeholder / record">
				<Row>
					{(['qr', 'placeholder', 'record'] as const).map((variant) => (
						<Labelled key={variant} label={variant}>
							<StaticCard
								width={hero}
								render={(rx, ry) => (
									<CardBack
										style={DEMO_CARD.style}
										width={hero}
										variant={variant}
										qrValue="https://concard.me/oskar"
										url="concard.me/oskar"
										record={{
											collected: 'Sep 23, 2026',
											event: 'In person',
											note: 'First meeting logged.'
										}}
										rx={rx}
										ry={ry}
									/>
								)}
							/>
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Binder size · identical layout at ~0.42×">
				<Row gap={space.sm}>
					{CARD_TIERS.slice(0, 3).map((spec, i) => (
						<Sample
							key={spec.tier}
							view={v(
								{ links: EIGHT_LINKS.slice(0, [2, 4, 8][i]), bio: LONG_BIO },
								{ photo_shape: PHOTO_SHAPES[i], bg: BG_SAMPLE[i + 2] }
							)}
							width={binder}
							tier={spec.tier}
							detail="thumb"
						/>
					))}
				</Row>
			</Group>
		</ScrollView>
	);
}

function Sample({
	view,
	width,
	tier = 0,
	detail = 'full'
}: {
	view: CardView;
	width: number;
	tier?: number;
	detail?: 'full' | 'thumb';
}) {
	return (
		<StaticCard
			width={width}
			render={(rx, ry) => (
				<Card
					view={view}
					width={width}
					foil={foilForTier(tier)}
					seed={`gallery-${tier}`}
					rx={rx}
					ry={ry}
					detail={detail}
				/>
			)}
		/>
	);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<View style={styles.group}>
			<Text style={styles.groupTitle}>{title}</Text>
			{children}
		</View>
	);
}

function Row({ children, gap = space.md }: { children: React.ReactNode; gap?: number }) {
	return <View style={[styles.row, { gap }]}>{children}</View>;
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<View style={styles.labelled}>
			{children}
			<Text style={styles.label}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.xl },
	group: {
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		padding: space.md,
		gap: space.md
	},
	groupTitle: { ...type.meta, color: palette.teal },
	row: { flexDirection: 'row', flexWrap: 'wrap' },
	labelled: { gap: space.xs },
	label: { ...type.meta, color: palette.creamFaint, fontSize: 9 }
});
