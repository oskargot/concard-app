import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { useConcardStore } from '@/store/useConcardStore';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

export default function HomeScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { signOut } = useAuth();
	const [signingOut, setSigningOut] = useState(false);
	const binder = useConcardStore((state) => state.binder_cache);
	const pending = useConcardStore((state) => state.scan_queue.length);
	const activeCard = useConcardStore((state) => state.active_card);
	const lastSync = useConcardStore((state) => state.last_sync_at);
	const uniquePeople = new Set(binder.map((card) => card.view.handle)).size;

	async function handleSignOut() {
		if (signingOut) return;
		setSigningOut(true);
		try {
			await signOut();
		} catch (error) {
			Alert.alert(
				'Could not sign out',
				error instanceof Error ? error.message : 'Please try again.'
			);
			setSigningOut(false);
		}
	}

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.header}>
				<View>
					<Text style={styles.eyebrow}>CONCARD / EVENT MODE</Text>
					<Text style={styles.title}>Ready, {activeCard.title.split(' ')[0]}?</Text>
				</View>
				<View style={styles.liveDot} />
			</View>

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

			<View style={styles.statRow}>
				<Stat value={String(uniquePeople)} label="People met" />
				<Stat value={String(binder.length)} label="Cards held" />
				<Stat value={String(pending)} label="To sync" accent={pending > 0} />
			</View>

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

			<Pressable
				onPress={handleSignOut}
				disabled={signingOut}
				accessibilityRole="button"
				style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
			>
				<Text style={styles.signOutText}>{signingOut ? 'SIGNING OUT…' : 'SIGN OUT'}</Text>
			</Pressable>
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
	actionGlyphText: { ...type.title, color: palette.teal },
	actionCopy: { flex: 1 },
	actionTitle: { ...type.bodyStrong, color: palette.cream },
	actionBody: { ...type.small, color: palette.creamFaint },
	chevron: { fontSize: 28, color: palette.creamFaint },
	pressed: { opacity: 0.76 },
	sync: { ...type.small, color: palette.creamFaint, textAlign: 'center' },
	signOut: { alignItems: 'center', paddingVertical: space.sm },
	signOutText: { ...type.meta, color: palette.creamFaint }
});
