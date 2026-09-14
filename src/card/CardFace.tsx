/**
 * The card front's content: photo, name, handle, pronouns, bio and links.
 *
 * Layout proportions are carried over from the web card (`Card.svelte`) so the
 * two renderers draw the same object — padding 4.67cqw, photo 47.33cqw tall,
 * name at 7.67cqw, and so on. `m.u(n)` is that file's `n cqw`.
 *
 * Bio alignment and link layout come from `CardStyle` (design bible §6).
 *
 * Like the web card, the face drops its bio and links below a certain width so
 * binder thumbnails stay legible instead of turning into grey mush.
 */

import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { font } from '../theme/tokens';
import { BGS, inkFor, type CardStyle } from './card-style';
import { shellMetrics } from './CardShell';
import type { CardView } from './types';

/** Below this card width the face shows name and handle only. */
const COMPACT_BELOW = 180;

export function CardFace({ view, width }: { view: CardView; width: number }) {
	const style: CardStyle = view.style;
	const m = shellMetrics(width, style.shape);
	const ink = inkFor(style.bg);
	const compact = width < COMPACT_BELOW;

	return (
		<View style={{ flex: 1, padding: m.u(4.67), gap: m.u(3) }}>
			<Photo view={view} width={width} ink={ink} />

			<View style={{ gap: m.u(1), paddingBottom: m.u(2) }}>
				<Text
					numberOfLines={1}
					style={{
						fontFamily: font.display,
						fontSize: m.u(7.67),
						lineHeight: m.u(7.67) * 1.1,
						color: ink.ink
					}}
				>
					{view.title}
				</Text>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: m.u(1.5) }}>
					<Text
						numberOfLines={1}
						style={{
							fontFamily: font.bodyBold,
							fontSize: Math.max(m.u(3.17), 7),
							lineHeight: Math.max(m.u(3.17), 7) * 1.2,
							letterSpacing: 0.4,
							color: ink.mute
						}}
					>
						@{view.handle}
					</Text>
					{view.pronouns ? (
						<Text
							numberOfLines={1}
							style={{
								fontFamily: font.body,
								fontSize: Math.max(m.u(2.9), 6.5),
								color: ink.mute
							}}
						>
							· {view.pronouns}
						</Text>
					) : null}
				</View>
			</View>

			{!compact && view.bio ? (
				<View
					style={{
						backgroundColor: ink.wash,
						borderRadius: m.u(4.67),
						paddingVertical: m.u(2.67),
						paddingHorizontal: m.u(3)
					}}
				>
					<Text
						style={{
							fontFamily: font.body,
							fontSize: Math.max(m.u(3.83), 8),
							lineHeight: Math.max(m.u(3.83), 8) * 1.45,
							color: ink.body,
							textAlign: style.bio_align
						}}
					>
						{view.bio}
					</Text>
				</View>
			) : null}

			{!compact && view.links.length > 0 ? <Links view={view} width={width} ink={ink} /> : null}
		</View>
	);
}

function Photo({
	view,
	width,
	ink
}: {
	view: CardView;
	width: number;
	ink: ReturnType<typeof inkFor>;
}) {
	const m = shellMetrics(width, view.style.shape);
	const shape = view.style.photo_shape;

	// The four photo silhouettes, carried over from the web card.
	const radius =
		shape === 'square'
			? m.u(1.33)
			: shape === 'circle'
				? m.u(49.33) / 2
				: shape === 'arch'
					? undefined
					: m.u(4.67);

	const box = {
		height: shape === 'circle' ? m.u(49.33) : m.u(47.33),
		width: shape === 'circle' ? m.u(49.33) : undefined,
		alignSelf: shape === 'circle' ? ('center' as const) : undefined,
		borderRadius: radius,
		// the arch: fully round at the top, gently rounded at the bottom
		borderTopLeftRadius: shape === 'arch' ? m.u(31.33) : radius,
		borderTopRightRadius: shape === 'arch' ? m.u(31.33) : radius,
		borderBottomLeftRadius: shape === 'arch' ? m.u(4.67) : radius,
		borderBottomRightRadius: shape === 'arch' ? m.u(4.67) : radius,
		overflow: 'hidden' as const,
		backgroundColor: ink.hatchA
	};

	if (!view.art_url) {
		// An empty photo well reads as intentional, not as a failed image: the web
		// card hatches it in two tints derived from the face colour.
		return (
			<View style={box}>
				<View
					style={[
						StyleSheet.absoluteFill,
						{
							experimental_backgroundImage: `linear-gradient(45deg, ${ink.hatchA} 0%, ${ink.hatchA} 48%, ${ink.hatchB} 50%, ${ink.hatchB} 100%)`
						}
					]}
				/>
			</View>
		);
	}

	return (
		<View style={box}>
			<Image
				source={{ uri: view.art_url }}
				style={StyleSheet.absoluteFill}
				contentFit="cover"
				// pan/zoom: the web card offsets background-position and scales
				contentPosition={{
					left: `${view.art_x * 100}%`,
					top: `${view.art_y * 100}%`
				}}
				transition={120}
			/>
		</View>
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
	const grid = view.style.link_layout === 'grid';
	const chipFont = Math.max(m.u(3.17), 7);

	// Rows leave a gutter for the fandom badge; the grid wraps into it instead.
	return (
		<View
			style={{
				flexDirection: 'row',
				flexWrap: 'wrap',
				gap: m.u(1.33),
				paddingRight: grid ? 0 : m.u(22)
			}}
		>
			{view.links.slice(0, grid ? 6 : 4).map((link, i) => (
				<View
					key={`${link.label}-${i}`}
					style={{
						backgroundColor: ink.wash,
						borderRadius: m.u(3),
						paddingVertical: m.u(1.33),
						paddingHorizontal: m.u(2.67),
						flexBasis: grid ? '31%' : undefined
					}}
				>
					<Text
						numberOfLines={1}
						style={{
							fontFamily: font.bodyMedium,
							fontSize: chipFont,
							lineHeight: chipFont * 1.2,
							color: ink.ink
						}}
					>
						{link.label}
					</Text>
				</View>
			))}
			{view.links.length > (grid ? 6 : 4) ? (
				<Text
					style={{
						fontFamily: font.bodyBold,
						fontSize: Math.max(m.u(2.67), 6.5),
						color: ink.mute,
						alignSelf: 'center'
					}}
				>
					+{view.links.length - (grid ? 6 : 4)} MORE
				</Text>
			) : null}
		</View>
	);
}

/** Exported so the foil lab can show a face colour swatch without importing BGS. */
export const faceColorFor = (style: CardStyle) => BGS[style.bg];
