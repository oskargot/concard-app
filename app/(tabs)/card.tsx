import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';
import { Button, ChipButton, ScreenHeader } from '@/ui';

/**
 * Card: this is where you *edit* your card. It is not a second share surface —
 * flipping to the QR back lives on Home, which owns the "the card is what you
 * share" story. So the only action here is Edit Card.
 */
export default function CardScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const router = useRouter();
	const { profile } = useAuth();
	const card = useConcardStore((state) => state.active_card);
	const updateCard = useConcardStore((state) => state.updateActiveCard);
	const cardWidth = Math.min(width - space.xl * 2, 266);

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

	const openEditor = () =>
		router.push({ pathname: '/card/edit', params: card.id ? { id: card.id } : {} });

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<ScreenHeader title="Your Card" right={<ChipButton label="Edit" onPress={openEditor} />} />

			<View style={styles.stage}>
				{/* No back face: flip-to-QR lives on Home. Tilt (drag) still works. */}
				<FlipCard width={cardWidth} renderFront={renderFront} />
			</View>

			<View style={styles.actions}>
				<Button label="Edit Card" onPress={openEditor} />
				<Text style={styles.hint}>Tap anything on the card to change it.</Text>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	page: { flexGrow: 1, paddingHorizontal: space.xl, gap: space.lg },
	stage: {
		flexGrow: 1,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 400
	},
	actions: { alignItems: 'center', gap: space.md, paddingBottom: space.lg },
	hint: { ...type.small, color: palette.textFaint, textAlign: 'center' }
});
