import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';

import { CardBack } from '@/card/CardBack';
import { CardFace } from '@/card/CardFace';
import { CardShell, shellMetrics } from '@/card/CardShell';
import { FlipCard, type FlipCardHandle } from '@/card/FlipCard';
import { StickerLayer } from '@/card/StickerLayer';
import { foilForTier } from '@/card/tiers';
import { SITE_ORIGIN } from '@/lib/env';
import { profileUrl } from '@/lib/username';
import { useConcardStore } from '@/store/useConcardStore';
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';
import { HoloButton, IconCircle } from '@/ui';

/**
 * Home: the card is what you share. The hero card is visible on load; "Show QR
 * Code" flips it to its QR back — there is no separate share screen (the QR back
 * encodes the same profile URL the web scanner reads).
 */
export default function HomeScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const card = useConcardStore((state) => state.active_card);
	const flipRef = useRef<FlipCardHandle>(null);
	const [showingQr, setShowingQr] = useState(false);
	// Scan's "Show My QR Code" deep-links here with ?flip=1 rather than inventing
	// a second share surface — Home owns flip-to-QR.
	const { flip } = useLocalSearchParams<{ flip?: string }>();

	useEffect(() => {
		if (flip === '1') flipRef.current?.showFace(true);
	}, [flip]);

	const cardWidth = Math.min(width - space.xl * 2, 266);

	// The stable profile URL — never a session token — so the app QR and the web
	// scanner agree on one contract (`usernameFromScan` on the web).
	const qrUrl = useMemo(() => profileUrl(SITE_ORIGIN, card.handle), [card.handle]);
	const readableUrl = qrUrl.replace(/^https?:\/\//, '');
	const qrBoxSize = useMemo(() => {
		const m = shellMetrics(cardWidth, card.style.shape);
		return m.u(60) - 2 * m.u(3.33);
	}, [cardWidth, card.style.shape]);

	const renderFront = (rx: SharedValue<number>, ry: SharedValue<number>) => (
		<CardShell
			style={card.style}
			width={cardWidth}
			foil={foilForTier(0)}
			seed={card.id}
			rx={rx}
			ry={ry}
			overlay={<StickerLayer stickers={card.stickers} width={cardWidth} />}
		>
			<CardFace view={card} width={cardWidth} />
		</CardShell>
	);

	const renderBack = (rx: SharedValue<number>, ry: SharedValue<number>) => (
		<CardBack
			style={card.style}
			width={cardWidth}
			variant="qr"
			url={readableUrl}
			qr={<QRCode value={qrUrl} size={qrBoxSize} backgroundColor="#fbf9f3" color="#17161b" />}
			rx={rx}
			ry={ry}
		/>
	);

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.header}>
				<Text style={styles.wordmark}>CONCARD</Text>
				<IconCircle label="Notifications">
					<View style={styles.bell} />
				</IconCircle>
			</View>

			<View style={styles.stage}>
				<FlipCard
					ref={flipRef}
					width={cardWidth}
					renderFront={renderFront}
					renderBack={renderBack}
					onFlipChange={setShowingQr}
				/>
			</View>

			<View style={styles.actions}>
				<HoloButton
					label={showingQr ? 'Show Card' : 'Show QR Code'}
					onPress={() => flipRef.current?.flip()}
				/>
				<Text style={styles.hint}>
					{showingQr
						? '✦ Point this at a friend’s camera to be collected'
						: '✦ Flip to your code and let people collect you'}
				</Text>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	page: {
		flexGrow: 1,
		paddingHorizontal: space.xl,
		gap: space.lg
	},
	header: {
		height: 60,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	wordmark: {
		fontFamily: 'Outfit-Bold',
		fontSize: 16,
		letterSpacing: 3,
		color: palette.textPrimary
	},
	bell: {
		width: 14,
		height: 14,
		borderRadius: 5,
		borderWidth: 1.5,
		borderColor: palette.textFaint
	},
	stage: {
		flexGrow: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: space.lg,
		minHeight: 400,
		// Bias the centred card upward so it sits higher on screen.
		paddingBottom: 96
	},
	actions: { alignItems: 'center', gap: space.md, paddingBottom: space.lg },
	hint: { ...type.small, fontSize: 13, color: palette.textFaint, textAlign: 'center' }
});
