/**
 * The card front's content: name, username and pronoun pill, photo, bio box
 * and link pills (card spec §3).
 *
 * Nothing here decides a size or a line break. `layoutFront` (in `layout/`,
 * shared with the web card) returns every rectangle in design units and every
 * string already ellipsised or wrapped, and this file only positions them at
 * `width / 250` px per unit. The same card therefore breaks its bio in the same
 * place in a binder thumbnail, on the hero card, and on concard.me, and a
 * snapshot looks the way it did the day it was collected.
 *
 * All card text uses Outfit and opts out of OS font scaling: accessibility text
 * sizes would break a fixed layout, and they still apply to the app around it.
 *
 * ## Editing in place
 *
 * The card editor passes an `edit` prop. A tapped name, pronoun pill or bio
 * becomes a `TextInput` carrying the identical style, in the identical box,
 * until it loses focus — then the exact card rendering (with its real
 * ellipsis and whole-line bio) comes back, which is the editor's live preview.
 * The photo takes a drag to reframe and a pinch to zoom. Editor-only
 * affordances (the empty-bio and empty-pronoun ghosts, the "add photo" label)
 * draw only while `edit` is present, so the binder, the dev gallery and
 * collection snapshots never see them.
 */

import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { font } from '../theme/tokens';
import { BOX, BIO, CARD_W, FRAME, LINKS, NAME, PHOTO, PILL, TAG } from './layout/spec';
import { coverCrop, panFocal, ZOOM_RANGE, type Focal } from './layout/crop';
import { layoutFront, type FrontLayout, type Rect } from './layout/front';
import type { OutfitWeight } from './layout/measure';
import { BGS, inkFor, normalizeStyle, withAlpha, type CardStyle, type FaceInk } from './card-style';
import { displayHandle, normalizeLinks } from './links';
import { LinkIcon } from './LinkIcon';
import type { CardView } from './types';

/**
 * Turns the face into the editor's canvas.
 *
 * Every field is optional on its own: a handler that isn't passed stays
 * read-only, so the editor can open the name for editing while the username —
 * which belongs to the profile, not the card — stays fixed text.
 */
export interface CardFaceEdit {
	onChangeTitle?: (next: string) => void;
	onChangePronouns?: (next: string) => void;
	onChangeBio?: (next: string) => void;
	bioMax?: number;
	/** Tap the photo to pick a new image. */
	onPressPhoto?: () => void;
	/** Drag / pinch the photo to move its focal point and zoom. */
	onChangeFocal?: (next: Focal) => void;
	/** Drag the divider under the photo. Drawn by `Card` in the overlay. */
	onChangePhotoHeight?: (next: number) => void;
	/** True while a drag on the card is in progress, so a scroll view can pause. */
	onInteraction?: (active: boolean) => void;
}

const FAMILY: Record<OutfitWeight, string> = {
	400: font.ui,
	600: font.uiSemi,
	700: font.uiBold
};

/** The normalized inputs and the layout, memoised per card. */
export function useFrontLayout(view: CardView): {
	style: CardStyle;
	layout: FrontLayout;
	handles: string[];
} {
	return useMemo(() => {
		// Normalised here, not trusted: persisted binder cards and snapshots were
		// written by older builds, before `alignment`, `photo_height` or handles.
		const style = normalizeStyle(view.style);
		const handles = normalizeLinks(view.links).map(displayHandle);
		const layout = layoutFront({
			name: view.title,
			username: view.handle,
			pronouns: view.pronouns,
			bio: view.bio,
			linkHandles: handles,
			photoShape: style.photo_shape,
			photoHeight: style.photo_height,
			alignment: style.alignment
		});
		return { style, layout, handles };
	}, [view.style, view.links, view.title, view.handle, view.pronouns, view.bio]);
}

type Field = 'title' | 'pronouns' | 'bio';

export function CardFace({
	view,
	width,
	edit
}: {
	view: CardView;
	width: number;
	edit?: CardFaceEdit;
}) {
	const { style, layout } = useFrontLayout(view);
	const links = useMemo(() => normalizeLinks(view.links), [view.links]);
	const s = width / CARD_W;
	const ink = inkFor(style.bg);
	const [active, setActive] = useState<Field | null>(null);

	/** Card-coordinate rect → absolute style inside the face (which is inset by the edge). */
	const place = (r: Rect): ViewStyle => ({
		position: 'absolute',
		left: (r.x - FRAME.edge) * s,
		top: (r.y - FRAME.edge) * s,
		width: r.w * s,
		height: r.h * s
	});

	const text = (weight: OutfitWeight, size: number, lineHeight: number, color: string) =>
		({
			fontFamily: FAMILY[weight],
			fontSize: size * s,
			lineHeight: lineHeight * s,
			color,
			includeFontPadding: false,
			textAlignVertical: 'center'
		}) satisfies TextStyle;

	// RN positions children inside a view's border, but the spec measures the
	// pills' insides from their outer edge, so their children step back by it.
	const bw = Math.max(BOX.outline * s, StyleSheet.hairlineWidth);
	const box: ViewStyle = {
		backgroundColor: withAlpha(ink.raised, BOX.fillOpacity),
		borderWidth: bw,
		borderColor: ink.line
	};

	const nameStyle: TextStyle = {
		...text(NAME.weight, NAME.size, NAME.lineHeight, ink.ink),
		letterSpacing: NAME.tracking * NAME.size * s,
		textAlign: layout.name.align
	};
	const tagStyle = text(TAG.weight, TAG.size, TAG.lineHeight, ink.mute);
	const pillText = text(PILL.weight, PILL.size, PILL.size * 1.3, ink.ink);
	const bioStyle: TextStyle = text(BIO.weight, BIO.size, BIO.lineHeight, ink.mute);

	// Editor-only: somewhere to tap when the pronouns are empty. Laid out as if
	// they said "pronouns", so the ghost sits exactly where the pill will.
	const ghostPill =
		edit?.onChangePronouns && !layout.pill && !layout.pillHidden
			? layoutFront({
					name: view.title,
					username: view.handle,
					pronouns: 'pronouns',
					bio: '',
					linkHandles: [],
					photoShape: style.photo_shape,
					photoHeight: style.photo_height,
					alignment: style.alignment
				}).pill
			: null;
	const pillRect = layout.pill?.rect ?? ghostPill?.rect;

	// Editor-only: an empty bio still needs a box to tap, when there is room for one.
	const bioGhost =
		edit?.onChangeBio && !view.bio.trim() && !layout.bioHidden ? ghostBioRect(layout) : null;
	const bioRect = layout.bio?.rect ?? bioGhost;

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents={edit ? 'box-none' : 'none'}>
			{/* Name */}
			<Editable
				field="title"
				active={active}
				setActive={setActive}
				onChangeText={edit?.onChangeTitle}
				value={view.title}
				rect={place(layout.name.rect)}
				style={nameStyle}
				placeholder="Your name"
				placeholderColor={ink.mute}
				maxLength={40}
				onInteraction={edit?.onInteraction}
			>
				<Line style={nameStyle}>{layout.name.text}</Line>
			</Editable>

			{/* @username — never truncates, never editable here. */}
			<Line
				style={[
					place(slack(layout.username.rect, style.alignment)),
					tagStyle,
					{ textAlign: style.alignment }
				]}
			>
				{layout.username.text}
			</Line>

			{/* Pronoun pill */}
			{pillRect ? (
				<View
					style={[
						place(pillRect),
						layout.pill ? box : ghost(ink, s),
						{ borderRadius: PILL.radius * s, justifyContent: 'center' }
					]}
				>
					<Editable
						field="pronouns"
						active={active}
						setActive={setActive}
						onChangeText={edit?.onChangePronouns}
						value={view.pronouns ?? ''}
						rect={{
							position: 'absolute',
							left: -bw,
							right: -bw,
							top: -bw,
							bottom: -bw,
							paddingHorizontal: PILL.padX * s,
							justifyContent: 'center'
						}}
						style={[pillText, { textAlign: 'center' }]}
						placeholder="pronouns"
						placeholderColor={ink.mute}
						maxLength={30}
						onInteraction={edit?.onInteraction}
					>
						<Line
							style={[pillText, { textAlign: 'center', color: layout.pill ? ink.ink : ink.mute }]}
						>
							{layout.pill?.text ?? 'pronouns'}
						</Line>
					</Editable>
				</View>
			) : null}

			<Photo
				view={view}
				layout={layout}
				style={style}
				scale={s}
				ink={ink}
				place={place}
				edit={edit}
			/>

			{/* Bio box */}
			{bioRect ? (
				<View
					style={[
						place(bioRect),
						layout.bio ? box : ghost(ink, s),
						{ borderRadius: BIO.radius * s, overflow: 'hidden' }
					]}
				>
					<Editable
						field="bio"
						active={active}
						setActive={setActive}
						onChangeText={edit?.onChangeBio}
						value={view.bio}
						// The box's border is the spec's 1-unit outline, and padding is
						// measured inside it (see \`layoutFront\`), so these are inside-border offsets.
						rect={{
							position: 'absolute',
							left: BIO.padX * s,
							right: BIO.padX * s,
							top: BIO.padY * s,
							bottom: BIO.padY * s
						}}
						style={[bioStyle, { textAlign: style.alignment }]}
						placeholder="Say something card-sized."
						placeholderColor={ink.mute}
						maxLength={edit?.bioMax}
						multiline
						onInteraction={edit?.onInteraction}
					>
						{layout.bio ? (
							layout.bio.lines.map((line, i) => (
								<Line
									key={i}
									style={[
										bioStyle,
										{
											position: 'absolute',
											left: 0,
											right: 0,
											top: i * BIO.lineHeight * s,
											height: BIO.lineHeight * s,
											textAlign: layout.bio!.align
										}
									]}
								>
									{line}
								</Line>
							))
						) : (
							<Line style={[bioStyle, { textAlign: style.alignment }]}>
								Say something card-sized.
							</Line>
						)}
					</Editable>
				</View>
			) : null}

			{/* Link pills — always left-aligned inside, whatever the alignment. */}
			{layout.links.pills.map((pill) => (
				<View key={pill.index} style={[place(pill.rect), box, { borderRadius: LINKS.radius * s }]}>
					<View
						style={{
							position: 'absolute',
							left: (pill.icon.x - pill.rect.x) * s - bw,
							top: (pill.icon.y - pill.rect.y) * s - bw
						}}
					>
						<LinkIcon url={links[pill.index]?.url ?? ''} size={LINKS.icon * s} color={ink.mute} />
					</View>
					<Line
						style={[
							text(LINKS.weight, LINKS.size, LINKS.lineHeight, ink.mute),
							{
								position: 'absolute',
								left: (pill.text.x - pill.rect.x) * s - bw,
								top: -bw,
								width: pill.text.w * s,
								height: pill.text.h * s
							}
						]}
					>
						{pill.label}
					</Line>
				</View>
			))}
		</View>
	);
}

/**
 * The username's box, a few units wider than measured on the side away from
 * its anchor. It must never be cut, and a platform that renders a hair wider
 * than the metrics say would otherwise clip its last character.
 */
function slack(r: Rect, align: 'left' | 'center' | 'right'): Rect {
	const extra = 4;
	const x = align === 'left' ? r.x : align === 'right' ? r.x - extra : r.x - extra / 2;
	return { ...r, x, w: r.w + extra };
}

/** The editor's placeholder treatment: a dashed outline, no fill. */
function ghost(ink: FaceInk, s: number): ViewStyle {
	return {
		borderWidth: Math.max(BOX.outline * s, StyleSheet.hairlineWidth),
		borderColor: ink.line,
		borderStyle: 'dashed'
	};
}

/** Where an empty bio's box would be, for the editor's ghost. */
function ghostBioRect(layout: FrontLayout): Rect | null {
	const top = layout.photo.zone.y + layout.photo.zone.h + 8;
	const bottom = layout.links.block ? layout.links.block.y - 8 : 330;
	return bottom - top >= BIO.minHeight ? { x: 20, y: top, w: 210, h: bottom - top } : null;
}

/** One line of card text: never scaled by the OS, never wrapped, never re-ellipsised. */
function Line({ style, children }: { style: TextStyle | TextStyle[] | object; children: string }) {
	return (
		<Text
			allowFontScaling={false}
			numberOfLines={1}
			// The string is already cut to fit by measurement. If a platform
			// renders it a hair wider, clip that hair rather than cutting a
			// different number of characters than the other platforms.
			ellipsizeMode="clip"
			style={style}
		>
			{children}
		</Text>
	);
}

/**
 * A piece of card text that turns into a field when tapped in the editor, and
 * back into the exact card rendering when it loses focus.
 */
function Editable({
	field,
	active,
	setActive,
	onChangeText,
	value,
	rect,
	style,
	placeholder,
	placeholderColor,
	maxLength,
	multiline,
	onInteraction,
	children
}: {
	field: Field;
	active: Field | null;
	setActive: (f: Field | null) => void;
	onChangeText?: (next: string) => void;
	value: string;
	rect: ViewStyle;
	style: TextStyle | (TextStyle | object)[];
	placeholder: string;
	placeholderColor: string;
	maxLength?: number;
	multiline?: boolean;
	onInteraction?: (active: boolean) => void;
	children: React.ReactNode;
}) {
	if (!onChangeText) return <View style={rect}>{children}</View>;

	if (active === field) {
		return (
			<View style={rect}>
				<TextInput
					autoFocus
					value={value}
					onChangeText={onChangeText}
					onBlur={() => setActive(null)}
					placeholder={placeholder}
					placeholderTextColor={placeholderColor}
					maxLength={maxLength}
					multiline={multiline}
					numberOfLines={multiline ? undefined : 1}
					scrollEnabled={false}
					allowFontScaling={false}
					accessibilityLabel={placeholder}
					style={[style, inputReset.reset, multiline ? inputReset.multiline : inputReset.single]}
				/>
			</View>
		);
	}

	const tap = Gesture.Tap()
		.runOnJS(true)
		.onBegin(() => onInteraction?.(true))
		.onFinalize(() => onInteraction?.(false))
		.onEnd(() => setActive(field));

	return (
		<GestureDetector gesture={tap}>
			<View
				style={rect}
				accessible
				accessibilityRole="button"
				accessibilityLabel={`Edit ${placeholder.toLowerCase()}`}
			>
				{value ? children : <Line style={[style, { color: placeholderColor }]}>{placeholder}</Line>}
			</View>
		</GestureDetector>
	);
}

/**
 * `TextInput` needs three resets to match `Text` — its own default padding,
 * Android's extra font padding, and Android's vertical centring — or the text
 * would jump when it turns into a field.
 */
const inputReset = StyleSheet.create({
	reset: { padding: 0, margin: 0, includeFontPadding: false },
	single: { flex: 1 },
	multiline: { flex: 1, textAlignVertical: 'top' }
});

function Photo({
	view,
	layout,
	style,
	scale: s,
	ink,
	place,
	edit
}: {
	view: CardView;
	layout: FrontLayout;
	style: CardStyle;
	scale: number;
	ink: FaceInk;
	place: (r: Rect) => ViewStyle;
	edit?: CardFaceEdit;
}) {
	const { clip, radii } = layout.photo;
	const boxW = clip.w * s;
	const boxH = clip.h * s;
	const [natural, setNatural] = useState<{ uri: string; w: number; h: number } | null>(null);
	const focal: Focal = { x: view.art_x, y: view.art_y, zoom: view.art_scale };
	// Where a drag or pinch began; read by the gesture callbacks, not by render.
	const start = useSharedValue(focal);

	const shape: ViewStyle = {
		...place(clip),
		borderTopLeftRadius: radii.tl * s,
		borderTopRightRadius: radii.tr * s,
		borderBottomRightRadius: radii.br * s,
		borderBottomLeftRadius: radii.bl * s,
		overflow: 'hidden',
		// Lift the photo onto its own layer, closer to the viewer, so it composites
		// as one stable surface during the flip instead of flickering as the card
		// rotates. (`elevation` is the Android draw-order lever; `zIndex` the iOS
		// one.) The foil stack sits above it at 3.
		zIndex: 1,
		elevation: 2,
		shadowColor: 'transparent'
	};

	const known = view.art_url && natural?.uri === view.art_url ? natural : null;
	const crop = known ? coverCrop(known.w, known.h, boxW, boxH, focal) : null;

	const content = view.art_url ? (
		<Image
			source={{ uri: view.art_url }}
			onLoad={(e) => setNatural({ uri: view.art_url!, w: e.source.width, h: e.source.height })}
			style={
				crop
					? { position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h }
					: StyleSheet.absoluteFill
			}
			// Until the image's own size is known, a plain centred cover fit;
			// after that, the exact focal-point crop the web card computes too.
			contentFit={crop ? 'fill' : 'cover'}
			transition={120}
		/>
	) : edit?.onPressPhoto ? (
		<View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
			<Text
				allowFontScaling={false}
				style={{
					fontFamily: font.uiSemi,
					fontSize: 10 * s,
					letterSpacing: 1.1 * s,
					textTransform: 'uppercase',
					color: ink.mute
				}}
			>
				Add photo
			</Text>
		</View>
	) : null;

	// No photo: only the shape's outline, 1 unit in the line colour, no fill.
	const outline: ViewStyle | null = view.art_url
		? null
		: { borderWidth: Math.max(PHOTO.outline * s, StyleSheet.hairlineWidth), borderColor: ink.line };

	if (!edit?.onPressPhoto && !edit?.onChangeFocal) {
		return <View style={[shape, outline]}>{content}</View>;
	}

	const tap = Gesture.Tap()
		.runOnJS(true)
		.onEnd(() => edit.onPressPhoto?.());

	const reframe = !!(known && edit.onChangeFocal);
	const pan = Gesture.Pan()
		.enabled(reframe)
		.runOnJS(true)
		.minDistance(4)
		.onBegin(() => {
			start.value = focal;
			edit.onInteraction?.(true);
		})
		.onUpdate((e) => {
			if (!known) return;
			// Keep the live zoom, in case a pinch is running alongside the drag.
			const from = { ...start.value, zoom: focal.zoom };
			edit.onChangeFocal?.(
				panFocal(from, e.translationX, e.translationY, known.w, known.h, boxW, boxH)
			);
		})
		.onFinalize(() => edit.onInteraction?.(false));

	const pinch = Gesture.Pinch()
		.enabled(reframe)
		.runOnJS(true)
		.onBegin(() => {
			start.value = focal;
			edit.onInteraction?.(true);
		})
		.onUpdate((e) => {
			const zoom = Math.min(ZOOM_RANGE[1], Math.max(ZOOM_RANGE[0], start.value.zoom * e.scale));
			edit.onChangeFocal?.({ ...focal, zoom });
		})
		.onFinalize(() => edit.onInteraction?.(false));

	return (
		<GestureDetector gesture={Gesture.Race(Gesture.Simultaneous(pan, pinch), tap)}>
			<View
				style={[shape, outline]}
				accessible
				accessibilityRole="button"
				accessibilityLabel={view.art_url ? 'Change card photo' : 'Add a card photo'}
				accessibilityHint={reframe ? 'Drag to reframe, pinch to zoom' : undefined}
			>
				{content}
			</View>
		</GestureDetector>
	);
}

/** Exported so the foil lab can show a face colour swatch without importing BGS. */
export const faceColorFor = (style: CardStyle) => BGS[normalizeStyle(style).bg];

/** The vertical middle of each band of the face, in px from the card's top edge. */
export interface FaceBands {
	header: number;
	photo: number;
	bio: number;
	footer: number;
}

/**
 * Where each band of the face sits, from the same layout the face draws.
 *
 * The editor puts each control beside the thing it changes — alignment by the
 * name, photo shape by the photo, edge colour by the links — so it needs the
 * same measurements. Deriving them from `layoutFront` keeps one copy: move the
 * divider and the controls follow the photo instead of sliding out of step.
 */
export function faceBands(width: number, layout: FrontLayout): FaceBands {
	const s = width / CARD_W;
	const zone = layout.photo.zone;
	const below = zone.y + zone.h;
	const footTop = layout.links.block?.y ?? 330;
	return {
		header: ((layout.name.rect.y + layout.username.rect.y + TAG.height) / 2) * s,
		photo: (zone.y + zone.h / 2) * s,
		bio: ((below + footTop) / 2) * s,
		footer: layout.links.block
			? (layout.links.block.y + layout.links.block.h / 2) * s
			: (330 - 8) * s
	};
}
