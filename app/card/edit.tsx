import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	View,
	useWindowDimensions
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
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
import {
	STICKER_BUTTON_MARGIN,
	STICKER_BUTTON_SIZE,
	StickerButton
} from '@/card/editor/StickerButton';
import { drawerLayout, StickerDrawer, type StickerKindTab } from '@/card/editor/StickerDrawer';
import type { StickerEditHandlers } from '@/card/editor/StickerEditLayer';
import { affiliationPlacement } from '@/card/CardOverlay';
import { FitNotes } from '@/card/editor/FitNotes';
import { LinkRows } from '@/card/editor/LinkRows';
import { LINKS_LIVE_MAX } from '@/card/links';
import { foilForTier } from '@/card/tiers';
import { BIO_MAX, type PlacedSticker } from '@/card/types';
import { useCardEditor } from '@/card/use-card-editor';
import { useLocalCardEditor } from '@/card/use-local-card-editor';
import { PhotoPermissionError, pickCardPhoto, uploadCardPhoto } from '@/lib/card-photo';
import { supabase } from '@/lib/supabase';
import { useConcardStore } from '@/store/useConcardStore';
import { STICKER_BASE_WIDTH } from '@/stickers/constants';
import { definitionForPlacement } from '@/stickers/definitions';
import { localFandomRows, submitFandom, type FandomRow } from '@/stickers/fandoms';
import { slugifyFandomLabel, styleCategoryForFandom } from '@/stickers/fandom-styles';
import { placementFields, type InventoryEntry } from '@/stickers/inventory';
import { StickerRenderer } from '@/stickers/StickerRenderer';
import { useCardStickers, type PlacementPatch } from '@/stickers/use-card-stickers';
import { FormError } from '@/ui';
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';

const PAGE_PADDING = space.md;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The affiliation's id in the sticker layer; it's edited as card columns. */
const AFFILIATION_ID = 'affiliation';
/** Where a tapped sticker lands: the middle of the card, a touch high. */
const TAP_PLACE = { x: 0.5, y: 0.45 };

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
	const { width, height: windowHeight } = useWindowDimensions();
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

	// ── stickers ──────────────────────────────────────────────────────────────
	const stickers = useCardStickers({
		live: remote && session && cardId ? { cardId, userId: session.user.id } : null,
		enabled: !!draft,
		hasAffiliation: !!view?.affiliation,
		affiliation: { current: draft?.affiliation ?? null, saved: remoteEditor.savedAffiliation }
	});
	const updateActiveCard = useConcardStore((s) => s.updateActiveCard);
	const addFandomSubmission = useConcardStore((s) => s.addFandomSubmission);
	/** Fandoms submitted this session, shown "In review" before any reload. */
	const [submitted, setSubmitted] = useState<FandomRow[]>([]);
	const pickerFandoms = useMemo(
		() => [
			...editor.fandoms,
			...submitted.filter((f) => !editor.fandoms.some((e) => e.id === f.id))
		],
		[editor.fandoms, submitted]
	);

	const submitNewFandom = useCallback(
		async (name: string) => {
			if (remote) {
				const made = await submitFandom(name);
				setSubmitted((list) => [
					...list,
					{ ...localFandomRows([])[0], ...made, status: 'pending', sort_order: 1000 }
				]);
				return;
			}
			// No live project to review it: keep it on this device, in review.
			addFandomSubmission({
				id: `local-${slugifyFandomLabel(name)}-${Date.now().toString(36)}`,
				name,
				style_category: styleCategoryForFandom({ id: slugifyFandomLabel(name), name }),
				created_at: new Date().toISOString()
			});
		},
		[remote, addFandomSubmission]
	);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [kind, setKind] = useState<StickerKindTab>('deco');
	const drawer = useMemo(() => drawerLayout(width, insets.bottom), [width, insets.bottom]);
	const drawerTop = useSharedValue(Number.POSITIVE_INFINITY);
	const overDrawer = useSharedValue(false);
	useEffect(() => {
		drawerTop.set(drawerOpen ? windowHeight - drawer.height : Number.POSITIVE_INFINITY);
	}, [drawerOpen, windowHeight, drawer.height, drawerTop]);

	/** The sticker being dragged out of the drawer, drawn under the finger. */
	const [ghost, setGhost] = useState<InventoryEntry | null>(null);
	const ghostX = useSharedValue(0);
	const ghostY = useSharedValue(0);
	const rootRef = useRef<View>(null);
	const rootOffset = useSharedValue({ x: 0, y: 0 });
	const cardRef = useRef<View>(null);
	const scrollRef = useRef<ScrollView>(null);
	const stageY = useRef(0);

	const ghostSize = cardWidth * STICKER_BASE_WIDTH;
	const ghostStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: ghostX.value - rootOffset.value.x - ghostSize / 2 },
			{ translateY: ghostY.value - rootOffset.value.y - ghostSize / 2 }
		]
	}));

	const measureRoot = useCallback(() => {
		rootRef.current?.measureInWindow((x, y) => rootOffset.set({ x, y }));
	}, [rootOffset]);

	const toggleDrawer = useCallback(() => {
		setDrawerOpen((open) => {
			// bring the card up so it stays in view above the sheet
			if (!open) scrollRef.current?.scrollTo({ y: stageY.current, animated: true });
			return !open;
		});
	}, []);

	const dropFromDrawer = useCallback(
		(entry: InventoryEntry, ax: number, ay: number) => {
			setGhost(null);
			cardRef.current?.measureInWindow((x, y, w, h) => {
				if (ax >= x && ax <= x + w && ay >= y && ay <= y + h) {
					stickers.place(entry, { x: (ax - x) / w, y: (ay - y) / h });
				}
			});
		},
		[stickers]
	);

	/** The card's stickers as the layer edits them: placements, then the affiliation. */
	const editStickers = useMemo<PlacedSticker[]>(() => {
		if (!view) return [];
		const list = [...stickers.placements];
		if (view.affiliation) {
			// live, the turn comes from its placement row (reset for a new fandom)
			const base = affiliationPlacement(view.affiliation);
			const turn = stickers.affiliationTurn;
			list.push({
				...base,
				id: AFFILIATION_ID,
				rotation: turn?.rotation ?? base.rotation,
				scale: turn?.scale ?? base.scale
			});
		}
		return list;
	}, [view, stickers.placements, stickers.affiliationTurn]);

	const changeAffiliation = (patch: PlacementPatch) => {
		if (!draft) return;
		if (patch.x !== undefined || patch.y !== undefined) {
			set({
				affiliation_x: patch.x ?? draft.affiliation_x,
				affiliation_y: patch.y ?? draft.affiliation_y
			});
		}
		const turn = {
			...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
			...(patch.scale !== undefined ? { scale: patch.scale } : {})
		};
		if (!Object.keys(turn).length) return;
		if (remote) {
			stickers.updateAffiliation(turn);
		} else {
			const current = useConcardStore.getState().active_card.affiliation;
			if (current) updateActiveCard({ affiliation: { ...current, ...turn } });
		}
	};

	const stickerHandlers: StickerEditHandlers = {
		onChange: (id, patch) =>
			id === AFFILIATION_ID ? changeAffiliation(patch) : stickers.update(id, patch),
		onRaise: (id) => {
			if (id !== AFFILIATION_ID) stickers.raise(id);
		},
		// The affiliation was never a copy, so putting it away just clears it.
		onRemove: (id) => (id === AFFILIATION_ID ? set({ affiliation: null }) : stickers.remove(id)),
		onInteraction: setDragging,
		drawerTop,
		overDrawer
	};

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

	const bottomRoom = drawerOpen
		? drawer.height + space.lg
		: insets.bottom + STICKER_BUTTON_SIZE + STICKER_BUTTON_MARGIN * 2;

	return (
		<View ref={rootRef} style={styles.flex} onLayout={measureRoot} collapsable={false}>
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
					ref={scrollRef}
					scrollEnabled={!dragging}
					contentContainerStyle={[styles.page, { paddingBottom: bottomRoom }]}
					keyboardShouldPersistTaps="handled"
				>
					<View onLayout={(e) => (stageY.current = e.nativeEvent.layout.y)} />
					<EditorStage
						view={view}
						cardWidth={cardWidth}
						stageWidth={stageWidth}
						axes={axes}
						onPickBackground={(bg) => setStyle({ bg })}
						renderCard={(rx, ry) => (
							<View ref={cardRef} collapsable={false}>
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
									stickerEdit={{ stickers: editStickers, handlers: stickerHandlers }}
								/>
							</View>
						)}
					/>

					{localReason ? <Text style={styles.local}>{localReason}</Text> : null}

					<FitNotes view={view} />

					<Text style={styles.hint}>
						Tap words to edit · drag the photo to frame it · drag the handle under it to trade photo
						for bio
					</Text>

					<FormError message={photoError ?? editor.error ?? stickers.error} />

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
						fandoms={pickerFandoms}
						value={draft.affiliation}
						onChange={(affiliation) => set({ affiliation })}
						onSubmit={submitNewFandom}
					/>
				</ScrollView>
			</KeyboardAvoidingView>

			<StickerDrawer
				open={drawerOpen}
				layout={drawer}
				inventory={stickers.inventory}
				kind={kind}
				onKind={setKind}
				canPlace={stickers.canPlace}
				onTap={(entry) => stickers.place(entry, TAP_PLACE)}
				drag={{ x: ghostX, y: ghostY, onStart: setGhost, onEnd: dropFromDrawer }}
				overDrawer={overDrawer}
			/>
			<StickerButton
				open={drawerOpen}
				bottom={drawerOpen ? drawer.height + space.md : insets.bottom + STICKER_BUTTON_MARGIN}
				onPress={toggleDrawer}
			/>
			{ghost ? (
				<Animated.View pointerEvents="none" style={[styles.ghost, ghostStyle]}>
					<StickerRenderer
						definition={definitionForPlacement({
							...placementFields(ghost.sticker),
							sticker_id: ghost.sticker.id
						} as PlacedSticker)}
						foil={ghost.foil}
						width={ghostSize}
					/>
				</Animated.View>
			) : null}
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
	ghost: { position: 'absolute', left: 0, top: 0, zIndex: 50, opacity: 0.9 },
	hint: { ...type.small, color: palette.creamFaint, textAlign: 'center' },
	local: { ...type.small, color: palette.textDim, textAlign: 'center' },
	blocked: { ...type.small, color: palette.butter },
	code: { fontFamily: 'Outfit-SemiBold', color: palette.cream },
	badgeText: { ...type.meta, color: palette.creamFaint },
	badgeSaved: { ...type.meta, color: palette.success },
	badgeError: { ...type.meta, color: palette.danger }
});
