import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Card } from '@/card/Card';
import { CardBack } from '@/card/CardBack';
import { FlipCard, type FlipCardHandle } from '@/card/FlipCard';
import { foilForTier } from '@/card/tiers';
import { useCard, useSyncActiveCard } from '@/card/use-card';
import { useConcardStore } from '@/store/useConcardStore';
import { palette } from '@/theme/palette';
import { CARD_ASPECT, uiFont } from '@/theme/tokens';

const HERO_CARD_WIDTH = 266;
const SCREEN_PADDING = 24;

export default function HomeScreen() {
	const insets = useSafeAreaInsets();
	const { width, height } = useWindowDimensions();
	const { profile } = useAuth();
	const card = useConcardStore((state) => state.active_card);
	const { view } = useCard(profile?.active_card_id ?? null, profile);
	useSyncActiveCard(view, profile?.active_card_id ?? null);
	const flipCard = useRef<FlipCardHandle>(null);
	const [showingBack, setShowingBack] = useState(false);

	const heightLimitedWidth = Math.max(
		190,
		(height - insets.top - insets.bottom - 220) * CARD_ASPECT
	);
	const cardWidth = Math.min(HERO_CARD_WIDTH, width - SCREEN_PADDING * 2, heightLimitedWidth);
	const cardHeight = cardWidth / CARD_ASPECT;
	const qrPayload = useMemo(
		() => JSON.stringify({ username: card.handle, card_id: card.id }),
		[card.handle, card.id]
	);

	return (
		<View style={[styles.page, { paddingTop: insets.top }]}>
			<View style={styles.header}>
				<Text style={styles.wordmark}>CONCARD</Text>
			</View>

			<View style={styles.content}>
				<View style={[styles.stage, { width: cardWidth, height: cardHeight }]}>
					<View pointerEvents="none" style={styles.ambientGlow} />
					<FlipCard
						ref={flipCard}
						width={cardWidth}
						onFlipChange={setShowingBack}
						renderFront={(rx, ry) => (
							<Card
								view={card}
								width={cardWidth}
								foil={foilForTier(0)}
								seed={card.id}
								rx={rx}
								ry={ry}
							/>
						)}
						renderBack={(rx, ry) => (
							<CardBack
								style={card.style}
								width={cardWidth}
								variant="qr"
								url={`concard.me/${card.handle}`}
								qr={
									<QRCode
										value={qrPayload}
										size={cardWidth * 0.5}
										backgroundColor="#fbf9f3"
										color="#17161b"
									/>
								}
								rx={rx}
								ry={ry}
							/>
						)}
					/>
				</View>

				<Pressable
					onPress={() => flipCard.current?.flip()}
					accessibilityRole="button"
					accessibilityLabel={showingBack ? 'Show card front' : 'Show QR code'}
					style={({ pressed }) => [styles.qrButton, pressed && styles.qrButtonPressed]}
				>
					<Text style={styles.qrButtonText}>
						{showingBack ? 'Show Card Front' : 'Show QR Code'}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: palette.base },
	header: {
		height: 60,
		paddingHorizontal: SCREEN_PADDING,
		justifyContent: 'center'
	},
	wordmark: {
		fontFamily: uiFont.bold,
		fontSize: 16,
		lineHeight: 20,
		letterSpacing: 1.92,
		color: palette.cream
	},
	content: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: SCREEN_PADDING,
		paddingBottom: 16,
		gap: 24
	},
	stage: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	ambientGlow: {
		position: 'absolute',
		width: 320,
		height: 320,
		borderRadius: 160,
		experimental_backgroundImage:
			'radial-gradient(ellipse, rgba(185,201,255,0.10) 0%, rgba(185,201,255,0) 68%)'
	},
	qrButton: {
		minHeight: 46,
		minWidth: 176,
		paddingVertical: 11,
		paddingHorizontal: 28,
		borderRadius: 24,
		borderWidth: 1.5,
		borderColor: palette.line,
		alignItems: 'center',
		justifyContent: 'center'
	},
	qrButtonPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
	qrButtonText: {
		fontFamily: uiFont.semibold,
		fontSize: 13,
		lineHeight: 17,
		letterSpacing: 0.26,
		color: palette.cream
	}
});
