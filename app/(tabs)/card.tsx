import { useEffect, useMemo, useState } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	useWindowDimensions
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';

import { useAuth } from '@/auth/AuthProvider';
import { CardFace } from '@/card/CardFace';
import { CardShell } from '@/card/CardShell';
import { FlipCard, StaticCard } from '@/card/FlipCard';
import { StickerLayer } from '@/card/StickerLayer';
import {
	BGS,
	BG_KEYS,
	FRAMES,
	FRAME_KEYS,
	normalizeStyle,
	styleToJson,
	type BgKey,
	type FrameKey
} from '@/card/card-style';
import { foilForTier } from '@/card/tiers';
import type { CardLink, PlacedSticker } from '@/card/types';
import { supabase } from '@/lib/supabase';
import { STICKER_CATALOG } from '@/stickers/catalog';
import { useConcardStore } from '@/store/useConcardStore';
import { Button, Field, FormError } from '@/ui';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

type Mode = 'card' | 'edit' | 'share';

export default function CardScreen() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const router = useRouter();
	const { profile } = useAuth();
	const [mode, setMode] = useState<Mode>('card');
	const [selected, setSelected] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const card = useConcardStore((state) => state.active_card);
	const updateCard = useConcardStore((state) => state.updateActiveCard);
	const addSticker = useConcardStore((state) => state.addSticker);
	const updateSticker = useConcardStore((state) => state.updateSticker);
	const removeSticker = useConcardStore((state) => state.removeSticker);
	const cardWidth = Math.min(width - space.xl * 2, mode === 'edit' ? 292 : 320);

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

	async function save() {
		setSaving(true);
		setSaved(false);
		setError(null);
		try {
			if (supabase && profile?.active_card_id) {
				const { error: cardError } = await supabase
					.from('cards')
					.update({
						display_name: card.title,
						pronouns: card.pronouns,
						bio: card.bio,
						label: card.label,
						style: styleToJson(card.style)
					})
					.eq('id', profile.active_card_id);
				if (cardError) throw cardError;

				const { error: deleteError } = await supabase
					.from('sticker_placements')
					.delete()
					.eq('card_id', profile.active_card_id);
				if (deleteError) throw deleteError;
				if (card.stickers.length) {
					const { error: stickerError } = await supabase.from('sticker_placements').insert(
						card.stickers.map((sticker, index) => ({
							card_id: profile.active_card_id!,
							sticker_id: sticker.sticker_id,
							x: sticker.x,
							y: sticker.y,
							rotation: sticker.rotation,
							scale: sticker.scale,
							z_index: index,
							foil: sticker.foil
						}))
					);
					if (stickerError) throw stickerError;
				}
			}
			setSaved(true);
			setMode('card');
			setSelected(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSaving(false);
		}
	}

	function place(stickerId: string) {
		const id = addSticker(stickerId);
		setSelected(id);
	}

	const renderCard = (rx: SharedValue<number>, ry: SharedValue<number>) => (
		<CardShell
			style={card.style}
			width={cardWidth}
			foil={foilForTier(0)}
			seed={card.id}
			rx={rx}
			ry={ry}
			overlay={
				<StickerLayer
					stickers={card.stickers}
					width={cardWidth}
					editable={mode === 'edit'}
					selectedId={selected}
					onSelect={setSelected}
					onChange={updateSticker}
					onDelete={(id) => {
						removeSticker(id);
						setSelected(null);
					}}
				/>
			}
		>
			<CardFace view={card} width={cardWidth} />
		</CardShell>
	);

	return (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={[
					styles.page,
					{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }
				]}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.header}>
					<View>
						<Text style={styles.eyebrow}>ACTIVE CARD</Text>
						<Text style={styles.title}>{mode === 'edit' ? 'Make it yours' : 'Your Concard'}</Text>
					</View>
					<View style={styles.modeSwitch}>
						{(['card', 'edit', 'share'] as Mode[]).map((item) => (
							<Pressable
								key={item}
								onPress={() => {
									setMode(item);
									setSelected(null);
								}}
								style={[styles.mode, mode === item && styles.modeOn]}
							>
								<Text style={[styles.modeText, mode === item && styles.modeTextOn]}>
									{item === 'card' ? 'VIEW' : item.toUpperCase()}
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
						{mode === 'edit' ? (
							<StaticCard width={cardWidth} render={renderCard} />
						) : (
							<FlipCard width={cardWidth} renderFront={renderCard} flippable={false} />
						)}
						{mode === 'edit' ? (
							<Text style={styles.tip}>
								Drag a sticker · use the corner dots to delete, resize or rotate
							</Text>
						) : null}
					</View>
				)}

				{saved ? <Text style={styles.saved}>✓ Card saved locally and ready to share</Text> : null}
				<FormError message={error} />

				{mode === 'edit' ? (
					<View style={styles.editor}>
						<Field
							label="Display name"
							value={card.title}
							onChangeText={(title) => updateCard({ title })}
							maxLength={36}
						/>
						<Field
							label="Pronouns"
							value={card.pronouns ?? ''}
							onChangeText={(pronouns) => updateCard({ pronouns })}
							maxLength={30}
						/>
						<Field
							label="Bio"
							value={card.bio}
							onChangeText={(bio) => updateCard({ bio: bio.slice(0, 140) })}
							multiline
							style={styles.bio}
							status={<Text style={styles.count}>{140 - card.bio.length}</Text>}
						/>

						<ChoiceRow
							label="Edge"
							items={FRAME_KEYS}
							value={card.style.frame}
							onChange={(frame) => updateCard({ style: { ...card.style, frame } })}
							color={(frame) => FRAMES[frame]}
						/>
						<ChoiceRow
							label="Face"
							items={BG_KEYS}
							value={card.style.bg}
							onChange={(bg) => updateCard({ style: { ...card.style, bg } })}
							color={(bg) => BGS[bg]}
						/>

						<Text style={styles.editorLabel}>ADD A STICKER</Text>
						<ScrollView horizontal showsHorizontalScrollIndicator={false}>
							<View style={styles.stickerRow}>
								{STICKER_CATALOG.filter((item) => item.unlocked).map((item) => (
									<Pressable
										key={item.id}
										style={styles.stickerPick}
										onPress={() => place(item.id)}
									>
										<View style={[styles.stickerDisc, { backgroundColor: item.color }]}>
											<Text style={styles.stickerGlyph}>{item.glyph}</Text>
										</View>
										<Text style={styles.stickerName}>{item.name}</Text>
									</Pressable>
								))}
							</View>
						</ScrollView>
						<Button label="Save card" onPress={save} busy={saving} />
					</View>
				) : mode === 'card' ? (
					<View style={styles.viewActions}>
						<Button label="Edit this card" onPress={() => setMode('edit')} />
						<Button label="Show my QR" variant="secondary" onPress={() => setMode('share')} />
						<Button
							label="Open holo lab"
							variant="ghost"
							onPress={() => router.push('/dev/foil-lab')}
						/>
					</View>
				) : null}
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

function ChoiceRow<T extends FrameKey | BgKey>({
	label,
	items,
	value,
	onChange,
	color
}: {
	label: string;
	items: readonly T[];
	value: T;
	onChange: (value: T) => void;
	color: (value: T) => string;
}) {
	return (
		<View style={styles.choice}>
			<Text style={styles.editorLabel}>{label}</Text>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.choiceRow}>
					{items.map((item) => (
						<Pressable
							key={item}
							accessibilityRole="radio"
							accessibilityState={{ selected: item === value }}
							onPress={() => onChange(item)}
							style={[styles.swatch, item === value && styles.swatchOn]}
						>
							<View
								style={[
									styles.swatchFill,
									color(item).startsWith('linear')
										? { experimental_backgroundImage: color(item) }
										: { backgroundColor: color(item) }
								]}
							/>
						</Pressable>
					))}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
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
	tip: { ...type.small, color: palette.teal, textAlign: 'center' },
	editor: { gap: space.md },
	bio: { minHeight: 82, paddingTop: space.md, textAlignVertical: 'top' },
	count: { ...type.meta, color: palette.creamFaint },
	editorLabel: { ...type.meta, color: palette.creamMute },
	choice: { gap: space.xs },
	choiceRow: { flexDirection: 'row', gap: space.sm, paddingVertical: 2 },
	swatch: {
		width: 40,
		height: 40,
		padding: 3,
		borderRadius: radius.sm,
		borderWidth: 2,
		borderColor: 'transparent'
	},
	swatchOn: { borderColor: palette.teal },
	swatchFill: { flex: 1, borderRadius: radius.sm - 3 },
	stickerRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.xs },
	stickerPick: { width: 68, alignItems: 'center', gap: space.xs },
	stickerDisc: {
		width: 54,
		height: 54,
		borderRadius: 27,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: palette.cream
	},
	stickerGlyph: { ...type.title, color: palette.void },
	stickerName: { ...type.small, color: palette.creamMute, textAlign: 'center' },
	viewActions: { gap: space.sm },
	saved: { ...type.small, color: palette.success, textAlign: 'center' },
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
