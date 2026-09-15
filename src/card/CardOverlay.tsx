/**
 * Everything that sits outside the face clip: the fandom badge and stickers.
 *
 * Ported from the overlay snippet in the web app's `Card.svelte`. These hang
 * over the metal frame, so they live in CardShell's `overlay` slot rather than
 * inside the face.
 */

import { Text, View } from 'react-native';

import { font } from '../theme/tokens';
import { BADGE_HOME, stickerRotation } from './card-style';
import { shellMetrics } from './CardShell';
import { DEMO_STICKER_GLYPHS } from './demo-card';
import type { CardView, PlacedSticker } from './types';

export function CardOverlay({
	view,
	width,
	glyphs = DEMO_STICKER_GLYPHS,
	stickers: drawStickers = true
}: {
	view: CardView;
	width: number;
	/** sticker_id → glyph fallback when baked art is not available yet. */
	glyphs?: Record<string, string>;
	/**
	 * Draw the card's stickers. The editor turns this off because `StickerLayer`
	 * is drawing the same stickers on top, as draggable objects — left on, every
	 * sticker would appear twice, once movable and once not.
	 */
	stickers?: boolean;
}) {
	const stickers = drawStickers ? [...view.stickers].sort((a, b) => a.z_index - b.z_index) : [];

	return (
		<>
			{view.affiliation ? (
				<Badge
					mark={view.affiliation.mark}
					name={view.affiliation.name}
					colorA={view.affiliation.color_a}
					colorB={view.affiliation.color_b}
					x={view.affiliation.x ?? BADGE_HOME.x}
					y={view.affiliation.y ?? BADGE_HOME.y}
					width={width}
				/>
			) : null}

			{stickers.map((s) => (
				<StickerMark
					key={s.id ?? `${s.sticker_id}-${s.x}-${s.y}`}
					sticker={s}
					glyph={glyphs[s.sticker_id] ?? '★'}
					width={width}
				/>
			))}
		</>
	);
}

function Badge({
	mark,
	name,
	colorA,
	colorB,
	x,
	y,
	width
}: {
	mark: string;
	name: string;
	colorA: string;
	colorB: string;
	x: number;
	y: number;
	width: number;
}) {
	const m = shellMetrics(width, 'rounded');
	const size = m.u(20);

	return (
		<View
			pointerEvents="none"
			style={{
				position: 'absolute',
				// Pixel positions (not %) stay sharp under the card's 3D tilt.
				left: m.width * x - size / 2,
				top: m.height * y - size / 2,
				width: size,
				height: size,
				borderRadius: m.u(4.67),
				experimental_backgroundImage: `linear-gradient(150deg, ${colorA}, ${colorB})`,
				alignItems: 'center',
				justifyContent: 'center',
				gap: m.u(1),
				padding: m.u(1)
			}}
		>
			<Text
				style={{
					fontFamily: font.bodyBold,
					fontSize: m.u(5),
					lineHeight: m.u(5),
					color: '#fbf9f3'
				}}
			>
				{mark}
			</Text>
			<Text
				numberOfLines={1}
				style={{
					fontFamily: font.bodyBold,
					fontSize: m.u(1.83),
					lineHeight: m.u(1.83) * 1.1,
					letterSpacing: 0.6,
					textTransform: 'uppercase',
					color: '#fbf9f3',
					maxWidth: '100%'
				}}
			>
				{name}
			</Text>
		</View>
	);
}

function StickerMark({
	sticker,
	glyph,
	width
}: {
	sticker: PlacedSticker;
	glyph: string;
	width: number;
}) {
	const m = shellMetrics(width, 'rounded');
	const size = m.u(15.33);
	const wobble = stickerRotation(sticker.id ?? sticker.sticker_id);
	const rotation = sticker.rotation + wobble;

	return (
		<View
			pointerEvents="none"
			style={{
				position: 'absolute',
				left: m.width * sticker.x - size / 2,
				top: m.height * sticker.y - size / 2,
				width: size,
				height: size,
				zIndex: sticker.z_index + 1,
				transform: [{ rotate: `${rotation}deg` }, { scale: sticker.scale }],
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			{/* Die-cut rim approximation: soft paper outline behind the glyph. */}
			<Text
				style={{
					position: 'absolute',
					fontSize: m.u(11),
					lineHeight: m.u(11),
					color: '#fbf9f3',
					textShadowColor: '#fbf9f3',
					textShadowOffset: { width: 0, height: 0 },
					textShadowRadius: m.u(2.2),
					opacity: 0.95
				}}
			>
				{glyph}
			</Text>
			<Text style={{ fontSize: m.u(11), lineHeight: m.u(11) }}>{glyph}</Text>
		</View>
	);
}
