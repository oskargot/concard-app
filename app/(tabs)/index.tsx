import { useMemo } from 'react';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { CardFace } from '@/card/CardFace';
import { CardShell } from '@/card/CardShell';
import { FlipCard } from '@/card/FlipCard';
import { normalizeStyle } from '@/card/card-style';
import { foilForTier } from '@/card/tiers';
import type { CardView } from '@/card/types';
import { SITE_ORIGIN } from '@/lib/env';
import { profileUrl } from '@/lib/username';
import { Button, Meta, Panel } from '@/ui';
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';

/**
 * My Card.
 *
 * Phase 3 gives this the QR back, the card switcher and the editor. For now it
 * draws the signed-in user's active card from their profile, which is enough to
 * prove auth, onboarding and the renderer all line up.
 */
export default function MyCardScreen() {
	const { profile, signOut } = useAuth();
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const cardWidth = Math.min(width - space.xl * 2, 340);

	const view = useMemo<CardView>(
		() => ({
			title: profile?.display_name ?? 'Your name',
			handle: profile?.username ?? 'you',
			pronouns: profile?.pronouns ?? null,
			bio: profile?.bio ?? '',
			label: null,
			art_url: null,
			art_x: 0.5,
			art_y: 0.5,
			art_scale: 1,
			// Phase 3 loads the card row itself; until then the style defaults,
			// which is what normalizeStyle returns for an absent value.
			style: normalizeStyle(null),
			affiliation: null,
			links: [],
			stickers: []
		}),
		[profile]
	);

	return (
		<ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}>
			<Text style={styles.kicker}>Drag to tilt</Text>

			<FlipCard
				width={cardWidth}
				renderFront={(rx, ry) => (
					<CardShell
						style={view.style}
						width={cardWidth}
						foil={foilForTier(0)}
						seed={profile?.username ?? 'me'}
						rx={rx}
						ry={ry}
					>
						<CardFace view={view} width={cardWidth} />
					</CardShell>
				)}
			/>

			{profile ? (
				<Text style={styles.handle}>
					{profileUrl(SITE_ORIGIN, profile.username).replace(/^https?:\/\//, '')}
				</Text>
			) : null}

			<Panel>
				<Text style={styles.devTitle}>Phase 1 · the renderer</Text>
				<Text style={styles.devBody}>
					The foil lab is where the tier effects get tuned. Open it on a real device and check every
					layer — blend modes are the one thing that has to be verified on hardware.
				</Text>
				<Link href="/dev/foil-lab" style={styles.devLink}>
					Open the foil lab →
				</Link>
				<Link href="/dev/foil-sampler" style={styles.devLink}>
					Open the foil sampler →
				</Link>
				<Link href="/dev/cards" style={styles.devLink}>
					Open the card gallery →
				</Link>
			</Panel>

			<View style={styles.footer}>
				<Button label="Sign out" variant="secondary" onPress={signOut} />
				<Meta>Phase 2 · QR, the card switcher and the editor come next</Meta>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	page: {
		alignItems: 'center',
		paddingTop: space.lg,
		paddingHorizontal: space.xl,
		gap: space.lg
	},
	kicker: { ...type.meta, color: palette.creamFaint },
	handle: { ...type.bodyStrong, color: palette.teal },
	devTitle: { ...type.subtitle, color: palette.cream },
	devBody: { ...type.small, color: palette.creamMute },
	devLink: { ...type.bodyStrong, color: palette.teal, paddingTop: space.xs },
	footer: { width: '100%', gap: space.sm, alignItems: 'center' }
});
