/**
 * The card front's content: ruled name/handle, photo, bio and link chips.
 *
 * The face keeps the web card's proportional sizing (`m.u(n)` is `n cqw`) but
 * uses a clearer native hierarchy: identity, artwork, then anchored details.
 *
 * Bio alignment and link layout come from `CardStyle` (design bible §6).
 *
 * Like the web card, the face drops its bio and links below a certain width so
 * binder thumbnails stay legible instead of turning into grey mush.
 *
 * ## Editing in place
 *
 * The card editor passes an `edit` prop and this file swaps its `Text` nodes for
 * `TextInput`s carrying the identical style — see `FaceText`. That is deliberate
 * and it is why the editor does not have its own copy of this layout: the geometry
 * above is load-bearing for snapshot fidelity, and a forked editing renderer would
 * be a second place for it to drift from the web card. With `edit` absent every
 * branch here collapses back to exactly what it drew before, so the binder, the
 * dev gallery and collection snapshots are untouched.
 */

import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { font } from '../theme/tokens';
import { BGS, inkFor, type CardStyle } from './card-style';
import { shellMetrics } from './CardShell';
import { displayUrl } from './links';
import type { CardView } from './types';

/** Below this card width the face shows name and photo only. */
const COMPACT_BELOW = 180;
/** Below this, even the handle goes — binder micro-tiles. */
const MICRO_BELOW = 110;
/** Web card shows at most three chips; the rest become "+N more". */
const MAX_CHIPS = 3;

/**
 * Lifts a block onto its own layer, closer to the viewer, the same way the
 * photo is. The name, bio and links take it too, so they sit above the foil's
 * holo pattern and stay legible whatever the finish, while the foil's gloss
 * (see `Foil.tsx`) still lights them from above. (`elevation` is the Android
 * draw-order lever; `zIndex` the iOS one.) The bio and links sit on a
 * translucent wash, which an Android elevation shadow would show through as a
 * smudge, so the shadow is switched off. The photo keeps its own because its
 * well is opaque.
 */
const LIFT = { zIndex: 1, elevation: 2, shadowColor: 'transparent' } as const;

/**
 * Turns the face into the editor's canvas.
 *
 * Every field is optional on its own: a handler that isn't passed stays
 * read-only, so the editor can open the name for editing while the handle —
 * which belongs to the profile, not the card — stays fixed text.
 */
export interface CardFaceEdit {
	onChangeTitle?: (next: string) => void;
	onChangePronouns?: (next: string) => void;
	onChangeBio?: (next: string) => void;
	bioMax?: number;
	/** Tap the photo well to pick a new image. */
	onPressPhoto?: () => void;
}

export function CardFace({
	view,
	width,
	edit
}: {
	view: CardView;
	width: number;
	edit?: CardFaceEdit;
}) {
	const style: CardStyle = view.style;
	const m = shellMetrics(width, style.shape);
	const ink = inkFor(style.bg);
	const compact = width < COMPACT_BELOW;
	const micro = width < MICRO_BELOW;

	// An empty bio normally collapses. While editing it has to stay, or there is
	// nothing left on screen to tap to write one.
	const showBio = !compact && (!!view.bio || !!edit?.onChangeBio);
	const showLinks = !compact && (view.links.length > 0 || !!edit);

	const titleStyle: TextStyle = {
		fontFamily: font.display,
		fontSize: m.u(7.67),
		lineHeight: m.u(7.67),
		color: ink.ink
	};
	const handleStyle: TextStyle = {
		fontFamily: font.bodyBold,
		fontSize: Math.max(m.u(3.17), 7),
		lineHeight: Math.max(m.u(3.17), 7) * 1.2,
		letterSpacing: 0.4,
		color: ink.mute,
		flexShrink: 1
	};
	const pronounStyle: TextStyle = {
		fontFamily: font.body,
		fontSize: Math.max(m.u(2.9), 6.5),
		color: ink.mute
	};
	const bioStyle: TextStyle = {
		fontFamily: font.body,
		fontSize: Math.max(m.u(3.83), 8),
		lineHeight: Math.max(m.u(3.83), 8) * 1.45,
		color: ink.body,
		textAlign: style.bio_align
	};

	return (
		<View style={{ flex: 1, padding: m.u(4.67), gap: m.u(2.4) }}>
			<View style={{ gap: m.u(0.55), ...LIFT }}>
				<FaceText
					value={view.title}
					onChangeText={edit?.onChangeTitle}
					numberOfLines={1}
					style={{
						...titleStyle,
						fontSize: m.u(7.2),
						lineHeight: m.u(7.2) * 1.06
					}}
					placeholder="Your name"
					placeholderColor={ink.mute}
					maxLength={40}
				/>
				{!micro ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: m.u(1.5) }}>
						<Text numberOfLines={1} style={handleStyle}>
							@{view.handle}
						</Text>
						{view.pronouns || edit?.onChangePronouns ? (
							<View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
								<Text style={pronounStyle}>· </Text>
								<FaceText
									value={view.pronouns ?? ''}
									onChangeText={edit?.onChangePronouns}
									numberOfLines={1}
									style={pronounStyle}
									placeholder="pronouns"
									placeholderColor={ink.mute}
									maxLength={30}
								/>
							</View>
						) : null}
					</View>
				) : null}
			</View>

			<Photo view={view} width={width} ink={ink} compact={compact} edit={edit} />

			{showBio || showLinks ? (
				<View style={{ flex: 1, minHeight: 0, gap: m.u(2) }}>
					{showBio ? (
						<View
							style={{
								flex: 1,
								minHeight: 0,
								backgroundColor: ink.wash,
								borderRadius: m.u(3.4),
								paddingVertical: m.u(2.35),
								paddingHorizontal: m.u(3),
								...LIFT
							}}
						>
							<FaceText
								value={view.bio}
								onChangeText={edit?.onChangeBio}
								style={bioStyle}
								placeholder="Say something card-sized."
								placeholderColor={ink.mute}
								maxLength={edit?.bioMax}
								multiline
								fill
							/>
						</View>
					) : null}
					{showLinks ? <Links view={view} width={width} ink={ink} /> : null}
				</View>
			) : null}
		</View>
	);
}

/**
 * A line of card text that becomes a field when the editor hands it a setter.
 *
 * Both branches take the same `style` object, which is the point: the text must
 * not shift by a pixel when it turns into an input. `TextInput` needs three
 * resets to match `Text` — its own default padding, Android's extra font
 * padding, and Android's vertical centring — and without them the name would
 * jump on focus.
 */
function FaceText({
	value,
	onChangeText,
	style,
	placeholder,
	placeholderColor,
	numberOfLines,
	maxLength,
	multiline,
	fill
}: {
	value: string;
	onChangeText?: (next: string) => void;
	style: TextStyle;
	placeholder?: string;
	placeholderColor?: string;
	numberOfLines?: number;
	maxLength?: number;
	multiline?: boolean;
	fill?: boolean;
}) {
	if (!onChangeText) {
		// Rendered even when empty: an empty `Text` still claims its line box, and
		// the header's height is part of the geometry the web card agrees with.
		return (
			<Text numberOfLines={numberOfLines} style={style}>
				{value}
			</Text>
		);
	}

	return (
		<TextInput
			value={value}
			onChangeText={onChangeText}
			placeholder={placeholder}
			placeholderTextColor={placeholderColor}
			maxLength={maxLength}
			multiline={multiline}
			numberOfLines={numberOfLines}
			scrollEnabled={false}
			accessibilityLabel={placeholder}
			style={[
				style,
				faceInput.reset,
				multiline ? faceInput.multiline : null,
				fill ? faceInput.fill : null
			]}
		/>
	);
}

const faceInput = StyleSheet.create({
	reset: { padding: 0, margin: 0, includeFontPadding: false },
	multiline: { textAlignVertical: 'top' },
	fill: { flex: 1 }
});

function Photo({
	view,
	width,
	ink,
	compact,
	edit
}: {
	view: CardView;
	width: number;
	ink: ReturnType<typeof inkFor>;
	compact: boolean;
	edit?: CardFaceEdit;
}) {
	const m = shellMetrics(width, view.style.shape);
	const shape = view.style.photo_shape;
	const photoSize = compact ? 88 : 38;

	// The four photo silhouettes, carried over from the web card.
	const radius =
		shape === 'square'
			? m.u(1.33)
			: shape === 'circle'
				? m.u(photoSize) / 2
				: shape === 'arch'
					? undefined
					: m.u(4.67);

	const box = {
		height: m.u(photoSize),
		width: shape === 'circle' ? m.u(photoSize) : undefined,
		alignSelf: shape === 'circle' ? ('center' as const) : undefined,
		borderRadius: radius,
		// the arch: fully round at the top, gently rounded at the bottom
		borderTopLeftRadius: shape === 'arch' ? m.u(31.33) : radius,
		borderTopRightRadius: shape === 'arch' ? m.u(31.33) : radius,
		borderBottomLeftRadius: shape === 'arch' ? m.u(4.67) : radius,
		borderBottomRightRadius: shape === 'arch' ? m.u(4.67) : radius,
		overflow: 'hidden' as const,
		backgroundColor: ink.hatchA,
		// Lift the photo onto its own layer, closer to the viewer, so it composites
		// as one stable surface during the flip instead of flickering as the card
		// rotates. (`elevation` is the Android draw-order lever; `zIndex` the iOS one.)
		zIndex: 1,
		elevation: 2
	};

	const label = (
		<Text
			style={{
				fontFamily: font.bodyBold,
				fontSize: Math.max(m.u(2.67), 6.5),
				letterSpacing: 1.1,
				textTransform: 'uppercase',
				color: ink.mute
			}}
		>
			{edit?.onPressPhoto ? (view.art_url ? 'change' : 'add photo') : 'photo'}
		</Text>
	);

	const inner = !view.art_url ? (
		// Empty well: hatch + "photo" label, same as the web card.
		<>
			<View
				style={[
					StyleSheet.absoluteFill,
					{
						experimental_backgroundImage: `repeating-linear-gradient(135deg, ${ink.hatchA} 0 7px, ${ink.hatchB} 7px 14px)`
					}
				]}
			/>
			{label}
		</>
	) : (
		<>
			<Image
				source={{ uri: view.art_url }}
				style={[
					StyleSheet.absoluteFill,
					{
						transform: [{ scale: view.art_scale }]
					}
				]}
				contentFit="cover"
				// pan/zoom: the web card offsets background-position and scales
				contentPosition={{
					left: `${view.art_x * 100}%`,
					top: `${view.art_y * 100}%`
				}}
				transition={120}
			/>
			{/* A filled well says nothing normally; in the editor it needs to advertise
			    that it is tappable, so the label comes back over a scrim. */}
			{edit?.onPressPhoto ? (
				<View
					style={[
						StyleSheet.absoluteFill,
						{
							alignItems: 'center',
							justifyContent: 'flex-end',
							paddingBottom: m.u(2),
							backgroundColor: 'rgba(23,22,27,0.28)'
						}
					]}
				>
					{label}
				</View>
			) : null}
		</>
	);

	const centred = !view.art_url;

	if (!edit?.onPressPhoto) {
		return (
			<View style={[box, centred && { alignItems: 'center', justifyContent: 'center' }]}>
				{inner}
			</View>
		);
	}

	return (
		<Pressable
			onPress={edit.onPressPhoto}
			accessibilityRole="button"
			accessibilityLabel={view.art_url ? 'Change card photo' : 'Add a card photo'}
			style={({ pressed }) => [
				box,
				centred && { alignItems: 'center', justifyContent: 'center' },
				pressed && { opacity: 0.8 }
			]}
		>
			{inner}
		</Pressable>
	);
}

function Links({
	view,
	width,
	ink
}: {
	view: CardView;
	width: number;
	ink: ReturnType<typeof inkFor>;
}) {
	const m = shellMetrics(width, view.style.shape);
	const rowFont = Math.max(m.u(3.4), 8);
	const rowH = rowFont * 1.25 + m.u(1.6);
	const shown = view.links.slice(0, MAX_CHIPS);
	const extra = Math.max(0, view.links.length - shown.length);

	return (
		<View
			style={{
				height: rowH * MAX_CHIPS + m.u(2.4) * 2 + m.u(1.1) * (MAX_CHIPS - 1),
				borderRadius: m.u(4.67),
				backgroundColor: ink.wash,
				paddingVertical: m.u(2.4),
				paddingHorizontal: m.u(3),
				justifyContent: 'space-between',
				...LIFT
			}}
		>
			{Array.from({ length: MAX_CHIPS }, (_, i) => {
				const link = shown[i];
				return (
					<View key={i} style={{ height: rowH, justifyContent: 'center' }}>
						{link ? (
							<Text
								numberOfLines={1}
								style={{
									fontFamily: font.bodyMedium,
									fontSize: rowFont,
									lineHeight: rowFont * 1.25,
									color: ink.ink
								}}
							>
								{link.label || displayUrl(link.url)}
							</Text>
						) : extra > 0 && i === MAX_CHIPS - 1 ? (
							<Text
								style={{
									fontFamily: font.bodyBold,
									fontSize: Math.max(m.u(2.67), 6.5),
									letterSpacing: 1.1,
									color: ink.mute
								}}
							>
								+{extra} MORE
							</Text>
						) : null}
					</View>
				);
			})}
			{extra > 0 && shown.length === MAX_CHIPS ? (
				<Text
					style={{
						position: 'absolute',
						right: m.u(3),
						bottom: m.u(2),
						fontFamily: font.bodyBold,
						fontSize: Math.max(m.u(2.2), 6),
						letterSpacing: 1,
						color: ink.mute
					}}
				>
					+{extra}
				</Text>
			) : null}
		</View>
	);
}

/** Exported so the foil lab can show a face colour swatch without importing BGS. */
export const faceColorFor = (style: CardStyle) => BGS[style.bg];

/** The vertical middle of each band of the face, in px from the card's top edge. */
export interface FaceBands {
	header: number;
	photo: number;
	bio: number;
	footer: number;
}

/**
 * Where each band of the face sits.
 *
 * The editor puts an arrow beside the thing each arrow changes — the photo-shape
 * control next to the photo, the bio alignment next to the bio — which means it
 * needs the same measurements the layout above is built from. Deriving them here
 * rather than in the editor keeps one copy: change a padding or the photo height
 * and the controls follow it instead of quietly sliding out of alignment.
 */
export function faceBands(width: number, style: CardStyle): FaceBands {
	const m = shellMetrics(width, style.shape);
	const u = m.u;
	const pad = u(4.67);
	const gap = u(2.4);

	const headerH = u(7.2) * 1.06 + u(0.55) + Math.max(u(3.17), 7) * 1.2;
	const photoH = u(38);
	const rowFont = Math.max(u(3.4), 8);
	const rowH = rowFont * 1.25 + u(1.6);
	const linksH = rowH * MAX_CHIPS + u(2.4) * 2 + u(1.1) * (MAX_CHIPS - 1);

	// The face is inset from the card edge by the metal band, so every offset
	// below is measured from the card, not from the face.
	const headerTop = m.band + pad;
	const photoTop = headerTop + headerH + gap;
	const bioTop = photoTop + photoH + gap;
	const footerBottom = m.height - m.band - pad;
	const footerTop = footerBottom - linksH;

	return {
		header: headerTop + headerH / 2,
		photo: photoTop + photoH / 2,
		bio: (bioTop + Math.max(bioTop, footerTop - gap)) / 2,
		footer: (footerTop + footerBottom) / 2
	};
}
