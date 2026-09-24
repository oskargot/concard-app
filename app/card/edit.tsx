import { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
	useWindowDimensions
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Card } from '@/card/Card';
import {
	ALIGNMENTS,
	ALIGNMENT_LABEL,
	ART_DEFAULT,
	BADGE_HOME,
	FRAMES,
	FRAME_KEYS,
	FRAME_LABEL,
	PHOTO_SHAPES,
	PHOTO_SHAPE_LABEL
} from '@/card/card-style';
import { AffiliationRow } from '@/card/editor/AffiliationRow';
import { EditorStage, stageLayout, type StyleAxis } from '@/card/editor/EditorStage';
import { FitNotes } from '@/card/editor/FitNotes';
import { LinkRows } from '@/card/editor/LinkRows';
import { LINKS_LIVE_MAX } from '@/card/links';
import { foilForTier } from '@/card/tiers';
import { BIO_MAX } from '@/card/types';
import { useCardEditor } from '@/card/use-card-editor';
import { useLocalCardEditor } from '@/card/use-local-card-editor';
import { PhotoPermissionError, pickCardPhoto, uploadCardPhoto } from '@/lib/card-photo';
import { supabase } from '@/lib/supabase';
import { FormError } from '@/ui';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

const PAGE_PADDING = space.md;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Edit card.
 *
 * The card is the interface. Name, pronouns and bio are edited on the face
 * itself (`CardFace`'s `edit` prop); the photo is tapped to replace, dragged to
 * reframe and pinched to zoom; the divider under it trades photo height for
 * bio lines; the style axes are arrow pairs in the gutters beside the part of
 * the card each one changes; and the eighteen face colours are a grid above
 * the card. Nothing covers the card while you work on it — every change is
 * visible on the object being changed, at the size it will actually be seen.
 *
 * Anything that won't fit is said under the card rather than clipped silently
 * (`fitNotices`). Links sit below: they are the one part of a card that is a
 * list, and a list does not edit in place. Everything autosaves
 * (`useCardEditor`), so there is no save button.
 *
 * Reached from My Card. Takes `?id=` so the switcher can hand it a specific
 * card; without one it edits whichever card is currently active.
 *
 * With no Supabase project configured, or nobody signed in (development builds
 * let you into the tabs either way), there is no card row to load. The screen
 * then edits the on-device card instead (`useLocalCardEditor`) and says so,
 * rather than waiting forever for a client that will never exist.
 */
export default function EditCardScreen() {
	const { session, profile, loading: authLoading } = useAuth();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const { id } = useLocalSearchParams<{ id?: string }>();

	const remoteId = id ?? profile?.active_card_id ?? null;
	// Only a real card row can be loaded; the on-device starter card's id is not a uuid.
	const remote = !!supabase && !!session && !!profile && !!remoteId && UUID.test(remoteId);
	const remoteEditor = useCardEditor(remote ? remoteId : null, profile);
	const localEditor = useLocalCardEditor(!remote && !authLoading);
	const editor = remote ? remoteEditor : localEditor;
	const cardId = remote ? remoteId : null;
	const { draft, view, set, setStyle } = editor;
	const localReason = remote
		? null
		: !supabase
			? 'Supabase isn’t configured (no .env), so you’re editing the card saved on this device. Changes stay here.'
			: 'You’re not signed in, so you’re editing the card saved on this device. Changes stay here.';

	const [photoBusy, setPhotoBusy] = useState(false);
	const [photoError, setPhotoError] = useState<string | null>(null);
	/** A drag on the card (divider, photo) pauses the page's scroll. */
	const [dragging, setDragging] = useState(false);

	const { cardWidth, stageWidth } = useMemo(() => stageLayout(width, PAGE_PADDING), [width]);

	const pickPhoto = useCallback(async () => {
		if (!draft || photoBusy) return;
		setPhotoBusy(true);
		setPhotoError(null);
		try {
			const picked = await pickCardPhoto();
			if (!picked) return;

			// Nowhere to upload to: the on-device card keeps the local file.
			if (!session || !cardId) {
				set({
					art_url: picked.uri,
					art_x: ART_DEFAULT.x,
					art_y: ART_DEFAULT.y,
					art_scale: ART_DEFAULT.scale
				});
				return;
			}

			// Show the local file straight away — an upload over hall wifi is not
			// something to stare at an unchanged card through. A new photo starts
			// centred and unzoomed; the public url replaces the local one below,
			// and that is what actually gets saved.
			set({
				art_url: picked.uri,
				art_x: ART_DEFAULT.x,
				art_y: ART_DEFAULT.y,
				art_scale: ART_DEFAULT.scale
			});

			const url = await uploadCardPhoto(picked, session.user.id, cardId);
			set({ art_url: url });
		} catch (e) {
			// The optimistic uri points at a file only this device can read, so a
			// failed upload has to put the card back rather than leave it there.
			set({
				art_url: draft.art_url,
				art_x: draft.art_x,
				art_y: draft.art_y,
				art_scale: draft.art_scale
			});
			setPhotoError(
				e instanceof PhotoPermissionError ? e.message : e instanceof Error ? e.message : String(e)
			);
		} finally {
			setPhotoBusy(false);
		}
	}, [draft, session, cardId, photoBusy, set]);

	// Each axis is parked beside the part of the card it changes: alignment at
	// the name, the shape at the photo, and the edge colour down by the links.
	const axes = useMemo<StyleAxis[]>(() => {
		if (!draft) return [];
		return [
			{
				label: 'Alignment',
				band: 'header',
				options: ALIGNMENTS,
				value: draft.style.alignment,
				labelFor: (v) => ALIGNMENT_LABEL[v as (typeof ALIGNMENTS)[number]],
				onChange: (alignment) => setStyle({ alignment: alignment as never })
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
				label: 'Edge',
				band: 'footer',
				options: FRAME_KEYS,
				value: draft.style.frame,
				labelFor: (v) => FRAME_LABEL[v as keyof typeof FRAMES],
				onChange: (frame) => setStyle({ frame: frame as never })
			}
		];
	}, [draft, setStyle]);

	if (editor.loading || authLoading || !draft || !view) {
		return (
			<>
				<Stack.Screen options={{ title: 'Edit card' }} />
				<View style={styles.centre}>
					{editor.error ? (
						<Text style={styles.empty}>{editor.error}</Text>
					) : (
						<ActivityIndicator color={palette.holo} />
					)}
				</View>
			</>
		);
	}

	const stickerAtHome =
		!!view.affiliation &&
		Math.abs(view.affiliation.x - BADGE_HOME.x) < 0.02 &&
		Math.abs(view.affiliation.y - BADGE_HOME.y) < 0.02;

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
					scrollEnabled={!dragging}
					contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}
					keyboardShouldPersistTaps="handled"
				>
					<EditorStage
						view={view}
						cardWidth={cardWidth}
						stageWidth={stageWidth}
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
									onChangeFocal: (f) => set({ art_x: f.x, art_y: f.y, art_scale: f.zoom }),
									onChangePhotoHeight: (photo_height) => setStyle({ photo_height }),
									onInteraction: setDragging
								}}
							/>
						)}
					/>

					{localReason ? <Text style={styles.local}>{localReason}</Text> : null}

					<FitNotes view={view} />

					<Text style={styles.hint}>
						Tap words to edit · drag the photo to frame it · drag the handle under it to trade photo
						for bio
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

					<LinkRows
						links={draft.links}
						onChange={(links) => set({ links })}
						photoHeight={draft.style.photo_height}
						stickerOverRightColumn={stickerAtHome}
					/>

					{editor.linksBlocked ? (
						<Text style={styles.blocked}>
							Links aren’t saving: this Supabase project doesn’t have the{' '}
							<Text style={styles.code}>cards.links</Text> column yet. Everything else on the card
							is saving normally.
						</Text>
					) : editor.linksCapped ? (
						<Text style={styles.blocked}>
							Only your first {LINKS_LIVE_MAX} links are saving: the database still allows{' '}
							{LINKS_LIVE_MAX} per card until its links constraint is updated. The rest show here
							but won’t persist yet.
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
	local: { ...type.small, color: palette.textDim, textAlign: 'center' },
	blocked: { ...type.small, color: palette.butter },
	code: { fontFamily: 'Outfit-SemiBold', color: palette.cream },
	badgeText: { ...type.meta, color: palette.creamFaint },
	badgeSaved: { ...type.meta, color: palette.success },
	badgeError: { ...type.meta, color: palette.danger }
});
