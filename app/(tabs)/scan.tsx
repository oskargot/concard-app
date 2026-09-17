import { useCallback, useState } from 'react';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConcardStore } from '@/store/useConcardStore';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

export default function ScanScreen() {
	const insets = useSafeAreaInsets();
	const [permission, requestPermission] = useCameraPermissions();
	const enqueue = useConcardStore((state) => state.enqueueScan);
	const pending = useConcardStore((state) => state.scan_queue.length);
	const [locked, setLocked] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const onScan = useCallback(
		(result: BarcodeScanningResult) => {
			if (locked) return;
			const payload = parsePayload(result.data);
			if (!payload) {
				setError('That isn’t a Concard code. Look for a code with a username and card ID.');
				setLocked(true);
				setTimeout(() => setLocked(false), 1600);
				return;
			}
			const added = enqueue({ ...payload, scanned_at: new Date().toISOString() });
			setError(null);
			setMessage(
				added ? `Got @${payload.username}! Saved to your binder.` : 'Already got that one.'
			);
			setLocked(true);
			setTimeout(() => {
				setLocked(false);
				setMessage(null);
			}, 2200);
		},
		[enqueue, locked]
	);

	if (!permission) return <View style={styles.page} />;

	if (!permission.granted) {
		return (
			<View style={[styles.permissionPage, { paddingTop: insets.top + space.xl }]}>
				<View style={styles.permissionIcon}>
					<Text style={styles.permissionGlyph}>⌁</Text>
				</View>
				<Text style={styles.title}>Meet cards face to face</Text>
				<Text style={styles.body}>
					Concard only uses the camera while this scanner is open. Nothing is recorded.
				</Text>
				<Pressable style={styles.permissionButton} onPress={requestPermission}>
					<Text style={styles.permissionButtonText}>ALLOW CAMERA</Text>
				</Pressable>
				{message ? <Text style={styles.permissionSuccess}>{message}</Text> : null}
				{error ? <Text style={styles.permissionError}>{error}</Text> : null}
			</View>
		);
	}

	return (
		<View style={styles.page}>
			<CameraView
				style={StyleSheet.absoluteFill}
				facing="back"
				barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
				onBarcodeScanned={locked ? undefined : onScan}
			/>
			<View style={styles.scrimTop} />
			<View style={styles.scrimBottom} />

			<View style={[styles.header, { top: insets.top + space.lg }]}>
				<Text style={styles.eyebrow}>ENCOUNTER MODE</Text>
				<Text style={styles.title}>Find their code</Text>
				<Text style={styles.body}>Hold steady. We’ll save it instantly—even offline.</Text>
			</View>

			<View style={styles.reticle}>
				<View style={[styles.corner, styles.topLeft]} />
				<View style={[styles.corner, styles.topRight]} />
				<View style={[styles.corner, styles.bottomLeft]} />
				<View style={[styles.corner, styles.bottomRight]} />
				<View style={styles.scanLine} />
			</View>

			<View style={[styles.footer, { bottom: insets.bottom + space.xl }]}>
				{message ? (
					<View style={styles.success}>
						<Text style={styles.successGlyph}>✓</Text>
						<View style={styles.successCopy}>
							<Text style={styles.successTitle}>CARD CAPTURED</Text>
							<Text style={styles.successBody}>{message}</Text>
						</View>
					</View>
				) : error ? (
					<View style={styles.error}>
						<Text style={styles.errorText}>{error}</Text>
					</View>
				) : (
					<View style={styles.offlinePill}>
						<View style={styles.statusDot} />
						<Text style={styles.offlineText}>
							OFFLINE READY{pending ? ` · ${pending} QUEUED` : ''}
						</Text>
					</View>
				)}
			</View>
		</View>
	);
}

function parsePayload(data: string): { username: string; card_id: string } | null {
	try {
		const value = JSON.parse(data) as Record<string, unknown>;
		if (typeof value.username === 'string' && typeof value.card_id === 'string') {
			return { username: value.username.replace(/^@/, '').trim(), card_id: value.card_id.trim() };
		}
	} catch {
		try {
			const url = new URL(data);
			const username =
				url.searchParams.get('username') ?? url.pathname.split('/').filter(Boolean)[0];
			const card_id = url.searchParams.get('card_id');
			if (username && card_id) return { username: username.replace(/^@/, ''), card_id };
		} catch {
			return null;
		}
	}
	return null;
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: palette.void },
	permissionPage: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: space.xl,
		gap: space.lg,
		backgroundColor: palette.base
	},
	permissionIcon: {
		width: 88,
		height: 88,
		borderRadius: radius.xl,
		backgroundColor: palette.raised,
		borderWidth: 1,
		borderColor: palette.teal,
		alignItems: 'center',
		justifyContent: 'center',
		boxShadow: `0 0 24px ${palette.tealGlow}`
	},
	permissionGlyph: { ...type.hero, color: palette.teal, fontSize: 42 },
	permissionButton: {
		backgroundColor: palette.rose,
		paddingHorizontal: space.xl,
		paddingVertical: space.md,
		borderRadius: radius.md
	},
	permissionButtonText: { ...type.meta, color: palette.void },
	permissionSuccess: { ...type.small, color: palette.success, textAlign: 'center' },
	permissionError: { ...type.small, color: palette.danger, textAlign: 'center' },
	scrimTop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: '32%',
		backgroundColor: 'rgba(18,7,32,0.72)'
	},
	scrimBottom: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		height: '28%',
		backgroundColor: 'rgba(18,7,32,0.78)'
	},
	header: { position: 'absolute', left: space.xl, right: space.xl, alignItems: 'center', gap: 3 },
	eyebrow: { ...type.meta, color: palette.teal },
	title: { ...type.hero, color: palette.cream, textAlign: 'center' },
	body: { ...type.small, color: palette.creamMute, textAlign: 'center', maxWidth: 300 },
	reticle: {
		position: 'absolute',
		width: 248,
		height: 248,
		top: '34%',
		alignSelf: 'center'
	},
	corner: { position: 'absolute', width: 50, height: 50, borderColor: palette.teal },
	topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
	topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
	bottomLeft: {
		bottom: 0,
		left: 0,
		borderBottomWidth: 4,
		borderLeftWidth: 4,
		borderBottomLeftRadius: 18
	},
	bottomRight: {
		bottom: 0,
		right: 0,
		borderBottomWidth: 4,
		borderRightWidth: 4,
		borderBottomRightRadius: 18
	},
	scanLine: {
		position: 'absolute',
		top: '50%',
		left: 22,
		right: 22,
		height: 2,
		backgroundColor: palette.rose,
		boxShadow: `0 0 13px ${palette.roseGlow}`
	},
	footer: {
		position: 'absolute',
		left: space.xl,
		right: space.xl,
		alignItems: 'center',
		gap: space.md
	},
	offlinePill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: 'rgba(36,19,64,0.9)'
	},
	statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.success },
	offlineText: { ...type.meta, color: palette.creamMute },
	success: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		padding: space.md,
		borderRadius: radius.lg,
		backgroundColor: palette.raised,
		borderWidth: 1,
		borderColor: palette.success
	},
	successGlyph: {
		width: 38,
		height: 38,
		borderRadius: 19,
		backgroundColor: palette.success,
		color: palette.void,
		fontSize: 24,
		textAlign: 'center',
		lineHeight: 38
	},
	successCopy: { flex: 1 },
	successTitle: { ...type.meta, color: palette.success },
	successBody: { ...type.small, color: palette.cream },
	error: {
		padding: space.md,
		backgroundColor: 'rgba(255,92,92,0.18)',
		borderRadius: radius.md
	},
	errorText: { ...type.small, color: palette.cream, textAlign: 'center' }
});
