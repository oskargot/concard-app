import { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
	useWindowDimensions
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Card } from '@/card/Card';
import {
	BIO_ALIGNS,
	BIO_ALIGN_LABEL,
	FRAMES,
	FRAME_KEYS,
	FRAME_LABEL,
	PHOTO_SHAPES,
	PHOTO_SHAPE_LABEL,
	SHAPES,
	SHAPE_LABEL
} from '@/card/card-style';
import { AffiliationRow } from '@/card/editor/AffiliationRow';
import { EditorStage, stageLayout, type StyleAxis } from '@/card/editor/EditorStage';
import { LinkRows } from '@/card/editor/LinkRows';
import { StickerLayer } from '@/card/StickerLayer';
import { foilForTier } from '@/card/tiers';
import { STICKER_CATALOG } from '@/stickers/catalog';
import { BIO_MAX } from '@/card/types';
import { useCardEditor } from '@/card/use-card-editor';
import { PhotoPermissionError, pickCardPhoto, uploadCardPhoto } from '@/lib/card-photo';
import { FormError } from '@/ui';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

const PAGE_PADDING = space.md;

/**
 * Edit card.
 *
 * The card is the interface. Name, pronouns and bio are edited on the face
 * itself (`CardFace`'s `edit` prop), the style axes are arrow pairs in the
 * gutters beside the part of the card each one changes, and the eighteen face
 * colours are swatch rails down the outer edges. Nothing covers the card while
 * you work on it, which is the point — every change is visible on the object
 * being changed, at the size it will actually be seen.
 *
 * Links sit below the card rather than on it: they are the one part of a card
 * that is a list, and a list does not edit in place. Everything autosaves
 * (`useCardEditor`), so there is no save button to reach for and no way to leave
 * with unsaved work.
 *
 * Reached from My Card. Takes `?id=` so the switcher can hand it a specific
 * card; without one it edits whichever card is currently active.
 */
export default function EditCardScreen() {
	const { session, profile } = useAuth();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const { id } = useLocalSearchParams<{ id?: string }>();

	const cardId = id ?? profile?.active_card_id ?? null;
	const editor = useCardEditor(cardId, profile);
	const { draft, view, set, setStyle } = editor;

	const [photoBusy, setPhotoBusy] = useState(false);
	const [photoError, setPhotoError] = useState<string | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);
	/** Which placement shows its delete/resize handles. */
	const [selectedSticker, setSelectedSticker] = useState<string | null>(null);

	const { cardWidth, railsBeside } = useMemo(() => stageLayout(width, PAGE_PADDING), [width]);

	const pickPhoto = useCallback(async () => {
		if (!draft || !session || !cardId || photoBusy) return;
		setPhotoBusy(true);
		setPhotoError(null);
		try {
			const picked = await pickCardPhoto(draft.style.photo_shape);
			if (!picked) return;

			// Show the local file straight away — an upload over hall wifi is not
			// something to stare at an unchanged card through. The public url
			// replaces it below, and that is what actually gets saved.
			set({ art_url: picked.uri });

			const url = await uploadCardPhoto(picked, session.user.id, cardId);
			set({ art_url: url });
		} catch (e) {
			// The optimistic uri points at a file only this device can read, so a
			// failed upload has to put the card back rather than leave it there.
			set({ art_url: draft.art_url });
			setPhotoError(
				e instanceof PhotoPermissionError ? e.message : e instanceof Error ? e.message : String(e)
			);
		} finally {
			setPhotoBusy(false);
		}
	}, [draft, session, cardId, photoBusy, set]);

	// Each axis is parked beside the part of the card it changes: the metal at the
	// header, the shape of the photo at the photo, alignment at the bio, and the
	// card's own silhouette at the bottom edge.
	const axes = useMemo<StyleAxis[]>(() => {
		if (!draft) return [];
		return [
			{
				label: 'Frame',
				band: 'header',
				options: FRAME_KEYS,
				value: draft.style.frame,
				labelFor: (v) => FRAME_LABEL[v as keyof typeof FRAMES],
				onChange: (frame) => setStyle({ frame: frame as never })
			},
			{
				label: 'Photo shape',
				band: 'photo',
				options: PHOTO_SHAPES,
				value: draft.style.photo_shape,
				labelFor: (v) => PHOTO_SHAPE_LABEL[v as (typeof PHOTO_SHAPES)[number]],
				onChange: (photo_shape) => setStyle({ photo_shape: photo_shape as never })
			},
			{
				label: 'Bio placement',
				band: 'bio',
				options: BIO_ALIGNS,
				value: draft.style.bio_align,
				labelFor: (v) => BIO_ALIGN_LABEL[v as (typeof BIO_ALIGNS)[number]],
				onChange: (bio_align) => setStyle({ bio_align: bio_align as never })
			},
			{
				label: 'Outline',
				band: 'footer',
				options: SHAPES,
				value: draft.style.shape,
				labelFor: (v) => SHAPE_LABEL[v as (typeof SHAPES)[number]],
				onChange: (shape) => setStyle({ shape: shape as never })
			}
		];
	}, [draft, setStyle]);

	if (editor.loading || !draft || !view) {
		return (
			<>
				<Stack.Screen options={{ title: 'Edit card' }} />
				<View style={styles.centre}>
					{editor.error ? (
						<Text style={styles.empty}>{editor.error}</Text>
					) : cardId ? (
						<ActivityIndicator color={palette.rose} />
					) : (
						<Text style={styles.empty}>You don’t have a card to edit yet.</Text>
					)}
				</View>
			</>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Edit card',
					headerRight: () => <SaveBadge state={editor.saveState} busy={photoBusy} />
				}}
			/>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView
					contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}
					keyboardShouldPersistTaps="handled"
				>
					{/* The card's own name — the user's label for it in the switcher, never
					    drawn on the face, so it cannot be edited in place like the rest. */}
					<View style={styles.nameRow}>
						<Text style={styles.nameLabel}>Card name</Text>
						<TextInput
							value={draft.label}
							onChangeText={(label) => set({ label })}
							placeholder="Cosplay"
							placeholderTextColor={palette.creamFaint}
							selectionColor={palette.teal}
							maxLength={24}
							accessibilityLabel="Card name, only you see this"
							style={styles.nameInput}
						/>
					</View>

					<EditorStage
						style={draft.style}
						cardWidth={cardWidth}
						railsBeside={railsBeside}
						axes={axes}
						onPickBackground={(bg) => setStyle({ bg })}
						renderCard={(rx, ry) => (
							<Card
								view={view}
								width={cardWidth}
								foil={foilForTier(0)}
								seed={cardId ?? 'card'}
								rx={rx}
								ry={ry}
								edit={{
									onChangeTitle: (display_name) => set({ display_name }),
									onChangePronouns: (pronouns) => set({ pronouns }),
									onChangeBio: (bio) => set({ bio: bio.slice(0, BIO_MAX) }),
									bioMax: BIO_MAX,
									onPressPhoto: pickPhoto,
									onPressStickers: () => setDrawerOpen((open) => !open),
									stickersEnabled: true
								}}
								overlay={
									<StickerLayer
										stickers={draft.stickers}
										width={cardWidth}
										editable
										selectedId={selectedSticker}
										onSelect={setSelectedSticker}
										onChange={editor.updateSticker}
										onDelete={(id) => {
											editor.removeSticker(id);
											setSelectedSticker(null);
										}}
									/>
								}
							/>
						)}
					/>

					{drawerOpen ? (
						<StickerDrawer
							onPlace={(stickerId) => setSelectedSticker(editor.addSticker(stickerId))}
							onClose={() => setDrawerOpen(false)}
						/>
					) : null}

					{draft.stickers.length > 0 && !drawerOpen ? (
						<Text style={styles.hint}>
							Drag a sticker · tap one, then use the corner dots to delete or resize
						</Text>
					) : null}

					<Text style={styles.hint}>
						Tap the card to edit its words · arrows change the part beside them
					</Text>

					<FormError message={photoError ?? editor.error} />

					<LinkRows links={draft.links} onChange={(links) => set({ links })} />

					{editor.linksBlocked ? (
						<Text style={styles.blocked}>
							Links aren’t saving: this Supabase project doesn’t have the{' '}
							<Text style={styles.code}>cards.links</Text> column yet. Everything else on the card
							is saving normally.
						</Text>
					) : null}

					<AffiliationRow
						fandoms={editor.fandoms}
						value={draft.affiliation}
						onChange={(affiliation) => set({ affiliation })}
					/>
				</ScrollView>
			</KeyboardAvoidingView>
		</>
	);
}

/**
 * The sticker drawer, opened by the button on the card face.
 *
 * It slides in under the card rather than over it, for the same reason the style
 * controls live in the margins: covering the card would hide the thing you are
 * decorating at the moment you are deciding where a sticker goes. Locked
 * stickers are shown rather than hidden, because a drawer that silently omits
 * them gives no reason to go and earn them.
 */
function StickerDrawer({
	onPlace,
	onClose
}: {
	onPlace: (stickerId: string) => void;
	onClose: () => void;
}) {
	return (
		<View style={styles.drawer}>
			<View style={styles.drawerHead}>
				<Text style={styles.drawerLabel}>Stickers</Text>
				<Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
					<Text style={styles.drawerClose}>Done</Text>
				</Pressable>
			</View>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.drawerRow}>
					{STICKER_CATALOG.map((sticker) => (
						<Pressable
							key={sticker.id}
							onPress={() => onPlace(sticker.id)}
							disabled={!sticker.unlocked}
							accessibilityRole="button"
							accessibilityLabel={
								sticker.unlocked ? `Place ${sticker.name}` : `${sticker.name}, locked`
							}
							accessibilityState={{ disabled: !sticker.unlocked }}
							style={({ pressed }) => [
								styles.stickerPick,
								!sticker.unlocked && styles.stickerLocked,
								pressed && sticker.unlocked && { opacity: 0.7 }
							]}
						>
							<View style={[styles.stickerDisc, { backgroundColor: sticker.color }]}>
								<Text style={styles.stickerGlyph}>{sticker.unlocked ? sticker.glyph : '🔒'}</Text>
							</View>
							<Text numberOfLines={1} style={styles.stickerName}>
								{sticker.name}
							</Text>
						</Pressable>
					))}
				</View>
			</ScrollView>
		</View>
	);
}

/**
 * The only trace of saving in the interface.
 *
 * With no save button, something still has to say the work is safe — but it is
 * status, not an action, so it stays a word in the corner rather than anything
 * that looks pressable.
 */
function SaveBadge({ state, busy }: { state: string; busy: boolean }) {
	if (busy) return <Text style={styles.badgeText}>Uploading…</Text>;
	if (state === 'saving') return <Text style={styles.badgeText}>Saving…</Text>;
	if (state === 'saved') return <Text style={styles.badgeSaved}>Saved</Text>;
	if (state === 'error') return <Text style={styles.badgeError}>Not saved</Text>;
	return null;
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
	empty: { ...type.body, color: palette.creamMute, textAlign: 'center' },
	page: {
		paddingHorizontal: PAGE_PADDING,
		paddingTop: space.md,
		gap: space.lg
	},
	nameRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		paddingHorizontal: space.xs
	},
	nameLabel: { ...type.meta, color: palette.creamMute },
	nameInput: {
		flex: 1,
		minHeight: 40,
		backgroundColor: palette.raisedHigh,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		paddingHorizontal: space.md,
		...type.small,
		color: palette.cream
	},
	hint: { ...type.small, color: palette.creamFaint, textAlign: 'center' },
	drawer: {
		gap: space.sm,
		padding: space.md,
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	drawerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	drawerLabel: { ...type.meta, color: palette.creamMute },
	drawerClose: { ...type.bodyStrong, color: palette.teal },
	drawerRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.xs },
	stickerPick: { width: 64, alignItems: 'center', gap: space.xs },
	stickerLocked: { opacity: 0.4 },
	stickerDisc: {
		width: 50,
		height: 50,
		borderRadius: 25,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: palette.cream
	},
	stickerGlyph: { fontFamily: 'Fredoka-Bold', fontSize: 22, color: palette.void },
	stickerName: { ...type.small, color: palette.creamMute, textAlign: 'center', maxWidth: '100%' },
	blocked: { ...type.small, color: palette.butter },
	code: { fontFamily: 'SpaceGrotesk-Bold', color: palette.cream },
	badgeText: { ...type.meta, color: palette.creamFaint },
	badgeSaved: { ...type.meta, color: palette.success },
	badgeError: { ...type.meta, color: palette.danger }
});
