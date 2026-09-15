/**
 * Every card look on fixture data — the direct equivalent of the web app's
 * `/dev/cards`. Its value is that regressions in the renderer show up as a
 * card that looks wrong next to fifteen that look right, which is far easier
 * to spot than reading a diff.
 *
 * Rendered at two sizes, because the face drops its bio and links below
 * 180px and binder thumbnails need checking as deliberately as hero cards do.
 */

import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/card/Card';
import { StaticCard } from '@/card/FlipCard';
import { DEMO_CARD } from '@/card/demo-card';
import { FRAME_KEYS, PHOTO_SHAPES, SHAPES, type BgKey, type CardStyle } from '@/card/card-style';
import { CARD_TIERS, foilForTier } from '@/card/tiers';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

/** A representative slice of the 18 backgrounds: a pastel, a saturated hue, the dark one. */
const BG_SAMPLE: BgKey[] = ['paper', 'blush', 'butter', 'cyan', 'violet', 'slate'];

export default function CardGalleryScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const hero = Math.min((width - space.xl * 2 - space.md) / 2, 180);
	const thumb = (width - space.xl * 2 - space.sm * 2) / 3;

	return (
		<ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}>
			<Group title="Tiers · the foil ladder">
				<Row>
					{CARD_TIERS.map((spec) => (
						<Labelled key={spec.tier} label={`T${spec.tier} · ${spec.label}`}>
							<Sample style={DEMO_CARD.style} width={hero} tier={spec.tier} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Frames">
				<Row>
					{FRAME_KEYS.map((frame) => (
						<Labelled key={frame} label={frame}>
							<Sample style={{ ...DEMO_CARD.style, frame }} width={hero} tier={0} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Faces">
				<Row>
					{BG_SAMPLE.map((bg) => (
						<Labelled key={bg} label={bg}>
							<Sample style={{ ...DEMO_CARD.style, bg }} width={hero} tier={0} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Silhouettes">
				<Row>
					{SHAPES.map((shape) => (
						<Labelled key={shape} label={shape}>
							<Sample style={{ ...DEMO_CARD.style, shape }} width={hero} tier={0} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Photo shapes">
				<Row>
					{PHOTO_SHAPES.map((photo_shape) => (
						<Labelled key={photo_shape} label={photo_shape}>
							<Sample style={{ ...DEMO_CARD.style, photo_shape }} width={hero} tier={0} />
						</Labelled>
					))}
				</Row>
			</Group>

			<Group title="Binder size · every tier">
				<Row gap={space.sm}>
					{CARD_TIERS.map((spec) => (
						<Sample
							key={spec.tier}
							style={DEMO_CARD.style}
							width={thumb}
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
	style,
	width,
	tier,
	detail = 'full'
}: {
	style: CardStyle;
	width: number;
	tier: number;
	detail?: 'full' | 'thumb';
}) {
	const view = { ...DEMO_CARD, style };
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
