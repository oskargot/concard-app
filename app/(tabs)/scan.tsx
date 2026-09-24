import { useCallback, useState } from 'react';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFace } from '@/card/CardFace';
import { CardShell } from '@/card/CardShell';
import { StaticCard } from '@/card/FlipCard';
import { CardOverlay } from '@/card/CardOverlay';
import { foilForTier } from '@/card/tiers';
import { formatRetryIn } from '@/lib/collect';
import { ALLOWED_QR_HOSTS, SITE_ORIGIN } from '@/lib/env';
import { profileUrl, usernameFromScan } from '@/lib/username';
import { useConcardStore } from '@/store/useConcardStore';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';
import { HoloButton, IconCircle, ScreenHeader } from '@/ui';

const VIEWFINDER = 320;
const SCAN_LINE_GRADIENT =
	'linear-gradient(90deg, transparent, #b9c9ff 30%, #9ff0dc 70%, transparent)';

export default function ScanScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const router = useRouter();
	const [permission, requestPermission] = useCameraPermissions();
	const enqueue = useConcardStore((state) => state.enqueueScan);
	const pending = useConcardStore((state) => state.scan_queue.length);
	const syncError = useConcardStore((state) => state.sync_error);
	const recent = useConcardStore((state) => state.binder_cache).slice(0, 2);
	const [locked, setLocked] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const finder = Math.min(VIEWFINDER, width - space.xl * 2);
	const thumbWidth = (width - space.xl * 2 - space.md) / 2;

	const onScan = useCallback(
		(result: BarcodeScanningResult) => {
			if (locked) return;
			const username = usernameFromScan(result.data, ALLOWED_QR_HOSTS);
			if (!username) {
				setError('That isn’t a Concard code. Look for a code pointing at someone’s profile.');
				setLocked(true);
				setTimeout(() => setLocked(false), 1600);
				return;
			}
			const added = enqueue({ username, scanned_at: new Date().toISOString() });
			setError(null);
			setMessage(added ? `Got @${username}! Saved to your binder.` : 'Already got that one.');
			setLocked(true);
			setTimeout(() => {
				setLocked(false);
				setMessage(null);
			}, 2200);
		},
		[enqueue, locked]
	);

	const syncErrorText = syncError
		? syncError.code === 'cooldown' && syncError.retryAt
			? `@${syncError.username}: already collected — try again in ${formatRetryIn(syncError.retryAt)}.`
			: `@${syncError.username}: ${syncError.hint || 'Could not collect that card.'}`
		: null;

	const statusText = message ?? error ?? syncErrorText ?? null;
	const statusTone: 'ok' | 'bad' | null = message ? 'ok' : error || syncErrorText ? 'bad' : null;

	if (!permission) return <View style={styles.page} />;

	if (!permission.granted) {
		return (
			<View style={[styles.permissionPage, { paddingTop: insets.top + space.xl }]}>
				<View style={styles.permissionIcon}>
					<View style={styles.reticleMini}>
						<View style={[styles.corner, styles.topLeft]} />
						<View style={[styles.corner, styles.topRight]} />
						<View style={[styles.corner, styles.bottomLeft]} />
						<View style={[styles.corner, styles.bottomRight]} />
					</View>
				</View>
				<Text style={styles.leadTitle}>Meet cards face to face</Text>
				<Text style={styles.leadBody}>
					Concard only uses the camera while this scanner is open. Nothing is recorded.
				</Text>
				<HoloButton label="Allow Camera" onPress={requestPermission} />
				{statusText ? (
					<Text style={statusTone === 'ok' ? styles.leadOk : styles.leadBad}>{statusText}</Text>
				) : null}
				<DemoScan onPress={() => onScan({ data: demoPayload } as BarcodeScanningResult)} />
			</View>
		);
	}

	return (
		<ScrollView
			style={styles.page}
			contentContainerStyle={[
				styles.content,
				{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<ScreenHeader
				title="Scan"
				right={
					<IconCircle label="Toggle flash">
						<View style={styles.flashGlyph} />
					</IconCircle>
				}
			/>

			<View style={[styles.viewfinder, { width: finder, height: finder }]}>
				<CameraView
					style={StyleSheet.absoluteFill}
					facing="back"
					barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
					onBarcodeScanned={locked ? undefined : onScan}
				/>
				<View style={[styles.corner, styles.topLeft]} />
				<View style={[styles.corner, styles.topRight]} />
				<View style={[styles.corner, styles.bottomLeft]} />
				<View style={[styles.corner, styles.bottomRight]} />
				<View style={styles.scanLine} />
				<View style={styles.scanGlow} />
			</View>

			{statusText ? (
				<Text style={statusTone === 'ok' ? styles.leadOk : styles.leadBad}>{statusText}</Text>
			) : (
				<View style={styles.instructions}>
					<Text style={styles.leadTitle}>Point at their code</Text>
					<Text style={styles.leadBody}>
						We’ll save it instantly — even offline{pending ? ` · ${pending} queued` : ''}.
					</Text>
				</View>
			)}

			<View style={styles.orRow}>
				<View style={styles.orLine} />
				<Text style={styles.orLabel}>OR</Text>
				<View style={styles.orLine} />
			</View>

			<HoloButton
				label="Show My QR Code"
				onPress={() => router.push({ pathname: '/', params: { flip: '1' } } as never)}
			/>

			<DemoScan onPress={() => onScan({ data: demoPayload } as BarcodeScanningResult)} />

			{recent.length ? (
				<View style={styles.recent}>
					<Text style={styles.sectionHeader}>RECENT</Text>
					<View style={styles.recentStrip}>
						{recent.map((card) => (
							<View key={card.id} style={{ width: thumbWidth }}>
								<StaticCard
									width={thumbWidth}
									render={(rx, ry) => (
										<CardShell
											style={card.view.style}
											width={thumbWidth}
											foil={foilForTier(card.tier)}
											seed={card.card_id ?? card.id}
											rx={rx}
											ry={ry}
											detail="thumb"
											overlay={<CardOverlay view={card.view} width={thumbWidth} rx={rx} ry={ry} />}
										>
											<CardFace view={card.view} width={thumbWidth} />
										</CardShell>
									)}
								/>
								<Text numberOfLines={1} style={styles.recentName}>
									@{card.view.handle}
								</Text>
							</View>
						))}
					</View>
				</View>
			) : null}
		</ScrollView>
	);
}

/** Same shape a QR on My Card encodes — a profile URL, never a session token. */
const demoPayload = profileUrl(SITE_ORIGIN, 'pixel-pal');

function DemoScan({ onPress }: { onPress: () => void }) {
	return (
		<Pressable onPress={onPress} style={styles.demoButton}>
			<Text style={styles.demoText}>Preview with a demo scan</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: palette.scanBg },
	content: { paddingHorizontal: space.xl, gap: space.lg, alignItems: 'stretch' },
	permissionPage: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: space.xl,
		gap: space.lg,
		backgroundColor: palette.scanBg
	},
	permissionIcon: {
		width: 96,
		height: 96,
		borderRadius: radius.xl,
		backgroundColor: '#1a1920',
		alignItems: 'center',
		justifyContent: 'center'
	},
	reticleMini: { width: 52, height: 52 },
	leadTitle: { ...type.subtitle, fontSize: 16, color: palette.textPrimary, textAlign: 'center' },
	leadBody: {
		...type.small,
		fontSize: 13,
		color: palette.textDim,
		textAlign: 'center',
		maxWidth: 300
	},
	leadOk: { ...type.small, fontSize: 13, color: palette.teal, textAlign: 'center' },
	leadBad: { ...type.small, fontSize: 13, color: palette.danger, textAlign: 'center' },

	viewfinder: {
		alignSelf: 'center',
		marginTop: space.md,
		borderRadius: radius.xl,
		backgroundColor: '#1a1920',
		overflow: 'hidden'
	},
	corner: { position: 'absolute', width: 30, height: 30, borderColor: palette.holo },
	topLeft: {
		top: 14,
		left: 14,
		borderTopWidth: 2.5,
		borderLeftWidth: 2.5,
		borderTopLeftRadius: 6
	},
	topRight: {
		top: 14,
		right: 14,
		borderTopWidth: 2.5,
		borderRightWidth: 2.5,
		borderTopRightRadius: 6
	},
	bottomLeft: {
		bottom: 14,
		left: 14,
		borderBottomWidth: 2.5,
		borderLeftWidth: 2.5,
		borderBottomLeftRadius: 6
	},
	bottomRight: {
		bottom: 14,
		right: 14,
		borderBottomWidth: 2.5,
		borderRightWidth: 2.5,
		borderBottomRightRadius: 6
	},
	scanLine: {
		position: 'absolute',
		top: '50%',
		left: 24,
		right: 24,
		height: 1.5,
		opacity: 0.7,
		...({ experimental_backgroundImage: SCAN_LINE_GRADIENT } as object)
	},
	scanGlow: {
		position: 'absolute',
		top: '50%',
		left: 24,
		right: 24,
		height: 10,
		...({
			experimental_backgroundImage:
				'linear-gradient(180deg, transparent, rgba(185,201,255,0.06), transparent)'
		} as object)
	},
	flashGlyph: {
		width: 12,
		height: 16,
		borderRadius: 2,
		borderWidth: 1.5,
		borderColor: palette.textFaint
	},

	instructions: { alignItems: 'center', gap: 4 },

	orRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
	orLine: { flex: 1, height: 1, backgroundColor: palette.line },
	orLabel: { ...type.meta, color: palette.mutedUi },

	demoButton: { alignSelf: 'center', paddingVertical: space.sm, paddingHorizontal: space.md },
	demoText: { ...type.small, color: palette.textFaint, textDecorationLine: 'underline' },

	recent: { gap: space.sm },
	sectionHeader: { ...type.meta, color: palette.textFaint },
	recentStrip: { flexDirection: 'row', gap: space.md },
	recentName: { ...type.small, color: palette.textDim, marginTop: space.xs }
});
