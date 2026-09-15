import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Card } from '@/card/Card';
import { CardBack } from '@/card/CardBack';
import { FlipCard } from '@/card/FlipCard';
import { normalizeStyle } from '@/card/card-style';
import { foilForTier } from '@/card/tiers';
import { useCard } from '@/card/use-card';
import type { CardView } from '@/card/types';
import { SITE_ORIGIN } from '@/lib/env';
import { profileUrl } from '@/lib/username';
import { Button, Meta, Panel } from '@/ui';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

export default function HomeScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const cardWidth = Math.min(width - space.xl * 2, 340);

	// The editor is pushed over this screen, so coming back fires no mount and a
	// card edited there would otherwise still be drawn as it was on the way in.
	const [refreshKey, setRefreshKey] = useState(0);
	const firstFocus = useRef(true);
	useFocusEffect(
		useCallback(() => {
			if (firstFocus.current) {
				firstFocus.current = false;
				return;
			}
			setRefreshKey((k) => k + 1);
		}, [])
	);

	const { view: loaded } = useCard(profile?.active_card_id ?? null, profile, refreshKey);

	// Until the row arrives, the profile alone is enough to draw a plausible card
	// rather than a hole where one goes.
	const fallback = useMemo<CardView>(
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
			style: normalizeStyle(null),
			affiliation: null,
			links: [],
			stickers: []
		}),
		[profile]
	);

	const view = loaded ?? fallback;

	return (
		<ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}>
			<Text style={styles.kicker}>Drag to tilt</Text>

			<FlipCard
				width={cardWidth}
				renderFront={(rx, ry) => (
					<Card
						view={view}
						width={cardWidth}
						foil={foilForTier(0)}
						seed={profile?.username ?? 'me'}
						rx={rx}
						ry={ry}
					/>
				)}
				renderBack={(rx, ry) => (
					<CardBack
						style={view.style}
						width={cardWidth}
						variant="qr"
						url={
							profile
								? profileUrl(SITE_ORIGIN, profile.username).replace(/^https?:\/\//, '')
								: undefined
						}
						rx={rx}
						ry={ry}
					/>
				)}
			/>

			<Pressable style={styles.hero} onPress={() => router.push('/scan' as never)}>
				<View style={styles.heroGlow} />
				<Text style={styles.heroKicker}>QUICK ENCOUNTER</Text>
				<Text style={styles.heroTitle}>Scan a new card</Text>
				<Text style={styles.heroBody}>
					Works offline. We’ll keep it safe until the convention Wi-Fi catches up.
				</Text>
				<View style={styles.scanPill}>
					<Text style={styles.scanPillText}>OPEN SCANNER →</Text>
				</View>
			</Pressable>

			<View style={styles.actions}>
				<Button
					label="Edit card"
					onPress={() => router.push('/card/edit')}
					disabled={!profile?.active_card_id}
				/>
			</View>

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

			<Text style={styles.sectionLabel}>YOUR NEXT MOVE</Text>
			<View style={styles.actions}>
				<Action
					glyph="▯"
					title="Tune your card"
					body={`${activeCard.stickers.length} sticker${activeCard.stickers.length === 1 ? '' : 's'} equipped`}
					onPress={() => router.push('/card' as never)}
				/>
				<Action
					glyph="✦"
					title="Browse stickers"
					body="5 unlocked · 3 still hidden"
					onPress={() => router.push('/stickers' as never)}
				/>
				<Action
					glyph="▦"
					title="Open binder"
					body="Your encounters, saved locally"
					onPress={() => router.push('/binder' as never)}
				/>
			</View>

			<Text style={styles.sync}>
				{pending
					? `${pending} scan${pending === 1 ? '' : 's'} waiting safely on this device`
					: lastSync
						? `All caught up · synced ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
						: 'Offline-ready · your binder lives on this device'}
			</Text>
		</ScrollView>
	);
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
	return (
		<View style={styles.stat}>
			<Text style={[styles.statValue, accent && styles.statAccent]}>{value}</Text>
			<Text style={styles.statLabel}>{label}</Text>
		</View>
	);
}

function Action({
	glyph,
	title,
	body,
	onPress
}: {
	glyph: string;
	title: string;
	body: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			style={({ pressed }) => [styles.action, pressed && styles.pressed]}
			onPress={onPress}
		>
			<View style={styles.actionGlyph}>
				<Text style={styles.actionGlyphText}>{glyph}</Text>
			</View>
			<View style={styles.actionCopy}>
				<Text style={styles.actionTitle}>{title}</Text>
				<Text style={styles.actionBody}>{body}</Text>
			</View>
			<Text style={styles.chevron}>›</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	eyebrow: { ...type.meta, color: palette.teal },
	title: { ...type.hero, color: palette.cream, marginTop: 2 },
	liveDot: {
		width: 11,
		height: 11,
		borderRadius: 6,
		backgroundColor: palette.success,
		boxShadow: `0 0 13px ${palette.success}`
	},
	hero: {
		overflow: 'hidden',
		backgroundColor: palette.raised,
		borderRadius: radius.xl,
		borderWidth: 1,
		borderColor: palette.roseDim,
		padding: space.xl,
		gap: space.sm,
		minHeight: 205
	},
	heroGlow: {
		position: 'absolute',
		width: 180,
		height: 180,
		borderRadius: 90,
		backgroundColor: 'rgba(255,77,151,0.16)',
		right: -50,
		top: -55,
		boxShadow: `0 0 45px ${palette.roseGlow}`
	},
	heroKicker: { ...type.meta, color: palette.rose },
	heroTitle: { ...type.hero, color: palette.cream, maxWidth: 240 },
	heroBody: { ...type.small, color: palette.creamMute, maxWidth: 270 },
	scanPill: {
		alignSelf: 'flex-start',
		marginTop: space.xs,
		backgroundColor: palette.rose,
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		borderRadius: radius.pill
	},
	scanPillText: { ...type.meta, color: palette.void },
	statRow: { flexDirection: 'row', gap: space.sm },
	stat: {
		flex: 1,
		backgroundColor: palette.raised,
		borderRadius: radius.md,
		padding: space.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	statValue: { ...type.title, color: palette.cream },
	statAccent: { color: palette.butter },
	statLabel: { ...type.small, color: palette.creamFaint },
	sectionLabel: { ...type.meta, color: palette.creamFaint, marginTop: space.xs },
	actions: { gap: space.sm },
	action: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		padding: space.md,
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	actionGlyph: {
		width: 43,
		height: 43,
		borderRadius: radius.md,
		backgroundColor: palette.raisedHigh,
		alignItems: 'center',
		justifyContent: 'center'
	},
	kicker: { ...type.meta, color: palette.creamFaint },
	actions: { width: '100%' },
	handle: { ...type.bodyStrong, color: palette.teal },
	devTitle: { ...type.subtitle, color: palette.cream },
	devBody: { ...type.small, color: palette.creamMute },
	devLink: { ...type.bodyStrong, color: palette.teal, paddingTop: space.xs },
	footer: { width: '100%', gap: space.sm, alignItems: 'center' }
});
