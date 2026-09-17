import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';

import { useAuth } from '@/auth/AuthProvider';
import { CardFace } from '@/card/CardFace';
import { CardShell } from '@/card/CardShell';
import { FlipCard } from '@/card/FlipCard';
import { StickerLayer } from '@/card/StickerLayer';
import { normalizeStyle } from '@/card/card-style';
import { foilForTier } from '@/card/tiers';
import type { CardLink, PlacedSticker } from '@/card/types';
import { supabase } from '@/lib/supabase';
import { useConcardStore } from '@/store/useConcardStore';
import { Button } from '@/ui';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

type Mode = 'card' | 'share';

export default function CardScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const router = useRouter();
	const { profile } = useAuth();
	const [mode, setMode] = useState<Mode>('card');
	const card = useConcardStore((state) => state.active_card);
	const updateCard = useConcardStore((state) => state.updateActiveCard);
	const cardWidth = Math.min(width - space.xl * 2, 320);

	useEffect(() => {
		if (!supabase || !profile?.active_card_id) return;
		Promise.all([
			supabase.from('cards').select('*').eq('id', profile.active_card_id).maybeSingle(),
			supabase
				.from('sticker_placements')
				.select('*')
				.eq('card_id', profile.active_card_id)
				.order('z_index')
		]).then(([cardResult, stickerResult]) => {
			if (!cardResult.data) return;
			const row = cardResult.data;
			updateCard({
				id: row.id,
				title: row.display_name ?? profile.display_name,
				handle: profile.username,
				pronouns: row.pronouns ?? profile.pronouns,
				bio: row.bio ?? profile.bio,
				label: row.label,
				art_url: row.art_url,
				art_x: row.art_x,
				art_y: row.art_y,
				art_scale: row.art_scale,
				style: normalizeStyle(row.style),
				links: Array.isArray(profile.links) ? (profile.links as unknown as CardLink[]) : [],
				stickers: (stickerResult.data ?? []) as PlacedSticker[]
			});
		});
	}, [profile, updateCard]);

	const qrPayload = useMemo(
		() => JSON.stringify({ username: card.handle, card_id: card.id }),
		[card.handle, card.id]
	);

	const renderCard = (rx: SharedValue<number>, ry: SharedValue<number>) => (
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

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<View style={styles.header}>
				<View>
					<Text style={styles.eyebrow}>ACTIVE CARD</Text>
					<Text style={styles.title}>Your Concard</Text>
				</View>
				<View style={styles.modeSwitch}>
					{(['card', 'share'] as Mode[]).map((item) => (
						<Pressable
							key={item}
							onPress={() => setMode(item)}
							style={[styles.mode, mode === item && styles.modeOn]}
						>
							<Text style={[styles.modeText, mode === item && styles.modeTextOn]}>
								{item === 'card' ? 'VIEW' : 'SHARE'}
							</Text>
						</Pressable>
					))}
				</View>
			</View>

			{mode === 'share' ? (
				<View style={styles.shareCard}>
					<View style={styles.qrFrame}>
						<QRCode value={qrPayload} size={210} backgroundColor="#F7F0E4" color="#1A0B2E" />
					</View>
					<Text style={styles.shareTitle}>Let them scan this</Text>
					<Text style={styles.shareBody}>
						Your tiny card payload works even when the venue network doesn’t.
					</Text>
					<Text style={styles.handle}>@{card.handle}</Text>
				</View>
			) : (
				<View style={styles.stage}>
					<FlipCard width={cardWidth} renderFront={renderCard} flippable={false} />
				</View>
			)}

			{mode === 'card' ? (
				<View style={styles.viewActions}>
					<Button
						label="Edit this card"
						onPress={() =>
							router.push({
								pathname: '/card/edit',
								params: card.id ? { id: card.id } : {}
							})
						}
					/>
					<Button label="Show my QR" variant="secondary" onPress={() => setMode('share')} />
					<Button
						label="Open holo lab"
						variant="ghost"
						onPress={() => router.push('/dev/foil-lab')}
					/>
				</View>
			) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	header: { gap: space.md },
	eyebrow: { ...type.meta, color: palette.teal },
	title: { ...type.hero, color: palette.cream },
	modeSwitch: {
		flexDirection: 'row',
		padding: 3,
		backgroundColor: palette.raised,
		borderRadius: radius.md
	},
	mode: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
	modeOn: { backgroundColor: palette.raisedHigh },
	modeText: { ...type.meta, color: palette.creamFaint },
	modeTextOn: { color: palette.rose },
	stage: { alignItems: 'center', gap: space.md },
	viewActions: { gap: space.sm },
	shareCard: {
		alignItems: 'center',
		padding: space.xl,
		gap: space.md,
		backgroundColor: palette.raised,
		borderRadius: radius.xl,
		borderWidth: 1,
		borderColor: palette.tealDim
	},
	qrFrame: {
		padding: space.lg,
		borderRadius: radius.lg,
		backgroundColor: palette.cream,
		boxShadow: `0 0 24px ${palette.tealGlow}`
	},
	shareTitle: { ...type.title, color: palette.cream },
	shareBody: { ...type.small, color: palette.creamMute, textAlign: 'center' },
	handle: { ...type.bodyStrong, color: palette.teal }
});
