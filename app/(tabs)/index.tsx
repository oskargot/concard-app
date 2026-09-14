import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFace } from '@/card/CardFace';
import { CardShell } from '@/card/CardShell';
import { FlipCard } from '@/card/FlipCard';
import { DEMO_CARD } from '@/card/demo-card';
import { foilForTier } from '@/card/tiers';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

/**
 * My Card — placeholder. Phase 3 gives this the real active card, the QR back
 * and the card switcher; for now it renders the fixture so the card renderer has
 * somewhere to live while the rest is built.
 */
export default function MyCardScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const cardWidth = Math.min(width - space.xl * 2, 340);

	return (
		<ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}>
			<Text style={styles.kicker}>Tap the card to flip · drag to tilt</Text>

			<FlipCard
				width={cardWidth}
				renderFront={(rx, ry) => (
					<CardShell
						style={DEMO_CARD.style}
						width={cardWidth}
						foil={foilForTier(0)}
						seed="demo"
						rx={rx}
						ry={ry}
					>
						<CardFace view={DEMO_CARD} width={cardWidth} />
					</CardShell>
				)}
			/>

			<View style={styles.devBox}>
				<Text style={styles.devTitle}>Phase 1</Text>
				<Text style={styles.devBody}>
					The foil lab is where the tier effects get tuned. Open it on a real device and check every
					layer — blend modes are the one thing that has to be verified on hardware.
				</Text>
				<Link href="/dev/foil-lab" style={styles.devLink}>
					Open the foil lab →
				</Link>
				<Link href="/dev/cards" style={styles.devLink}>
					Open the card gallery →
				</Link>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	page: {
		alignItems: 'center',
		paddingTop: space.xl,
		paddingHorizontal: space.xl,
		gap: space.xl
	},
	kicker: { ...type.meta, color: palette.creamFaint },
	devBox: {
		width: '100%',
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		padding: space.lg,
		gap: space.sm
	},
	devTitle: { ...type.subtitle, color: palette.cream },
	devBody: { ...type.small, color: palette.creamMute },
	devLink: { ...type.bodyStrong, color: palette.teal, paddingTop: space.xs }
});
