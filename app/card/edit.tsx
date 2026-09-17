import { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
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
import { foilForTier } from '@/card/tiers';
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
 * colours are a grid above the card. Nothing covers the card while you work
 * on it, which is the point — every change is visible on the object being
 * changed, at the size it will actually be seen.
 *
 * Links sit below the card rather than on it: they are the one part of a card
 * that is a list, and a list does not edit in place. A sticker button sits
 * between the card and those rows; the drawer behind it comes later.
 * Everything autosaves (`useCardEditor`), so there is no save button to reach
 * for and no way to leave with unsaved work.
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

	const { cardWidth } = useMemo(() => stageLayout(width, PAGE_PADDING), [width]);

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
					<EditorStage
						style={draft.style}
						cardWidth={cardWidth}
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
									onPressPhoto: pickPhoto
								}}
							/>
						)}
					/>

					<Text style={styles.hint}>
						Tap the card to edit its words · arrows change the part beside them
					</Text>

					<Pressable
						onPress={() => {}}
						accessibilityRole="button"
						accessibilityLabel="Stickers — coming soon"
						style={({ pressed }) => [styles.stickerBtn, pressed && styles.stickerBtnPressed]}
					>
						<Text style={styles.stickerGlyph}>✦</Text>
					</Pressable>

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
	stickerBtn: {
		alignSelf: 'center',
		width: 52,
		height: 52,
		borderRadius: radius.md,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	stickerBtnPressed: { opacity: 0.75 },
	stickerGlyph: { fontSize: 22, color: palette.cream },
	hint: { ...type.small, color: palette.creamFaint, textAlign: 'center' },
	blocked: { ...type.small, color: palette.butter },
	code: { fontFamily: 'SpaceGrotesk-Bold', color: palette.cream },
	badgeText: { ...type.meta, color: palette.creamFaint },
	badgeSaved: { ...type.meta, color: palette.success },
	badgeError: { ...type.meta, color: palette.danger }
});
