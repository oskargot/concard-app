/**
 * The card's stickers, live under your fingers (HANDOFF §1.4).
 *
 * Drawn in the card's overlay in place of `CardOverlay` while editing: the
 * same renderer and the same card-space geometry, plus gestures — drag to
 * move, pinch to scale (clamped 0.5–2× of the base size), two fingers to
 * rotate, all at once. The sticker touched last comes to the top. A sticker
 * dropped onto the open drawer comes off the card and goes back into the
 * inventory. Its centre can't leave the card, though the rest of it may hang
 * over the edge. Each gesture saves when it ends; nothing saves mid-drag.
 */

import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	type SharedValue
} from 'react-native-reanimated';

import { baseSizeOf, STICKER_SCALE_MAX, STICKER_SCALE_MIN } from '../../stickers/constants';
import { definitionForPlacement } from '../../stickers/definitions';
import type { StickerOnCard } from '../../stickers/StickerFoil';
import { StickerRenderer, stickerBox } from '../../stickers/StickerRenderer';
import type { PlacementPatch } from '../../stickers/use-card-stickers';
import { stickerRotation } from '../card-style';
import { shellMetrics } from '../CardShell';
import type { PlacedSticker } from '../types';

export interface StickerEditHandlers {
	onChange: (id: string, patch: PlacementPatch) => void;
	onRaise: (id: string) => void;
	onRemove: (id: string) => void;
	/** Pauses the page's scroll while a sticker is held. */
	onInteraction?: (active: boolean) => void;
	/** Window y of the open drawer's top edge; Infinity while it's closed. */
	drawerTop: SharedValue<number>;
	/** True while a held sticker is over the drawer, so it can say "drop here". */
	overDrawer: SharedValue<boolean>;
}

export function StickerEditLayer({
	stickers,
	width,
	rx,
	ry,
	handlers
}: {
	stickers: PlacedSticker[];
	width: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	handlers: StickerEditHandlers;
}) {
	const sorted = useMemo(() => [...stickers].sort((a, b) => a.z_index - b.z_index), [stickers]);
	return (
		<>
			{sorted.map((s) => (
				<EditableSticker
					key={s.id ?? s.sticker_id}
					sticker={s}
					width={width}
					rx={rx}
					ry={ry}
					handlers={handlers}
				/>
			))}
		</>
	);
}

function EditableSticker({
	sticker,
	width,
	rx,
	ry,
	handlers
}: {
	sticker: PlacedSticker;
	width: number;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	handlers: StickerEditHandlers;
}) {
	const id = sticker.id ?? sticker.sticker_id;
	const m = shellMetrics(width);
	const cardW = m.width;
	const cardH = m.height;
	const definition = useMemo(() => definitionForPlacement(sticker), [sticker]);
	const size = baseSizeOf(sticker) * cardW;
	const box = stickerBox(definition, size);
	const wobble = sticker.is_affiliation ? 0 : stickerRotation(id);

	const x = useSharedValue(sticker.x * cardW);
	const y = useSharedValue(sticker.y * cardH);
	const scale = useSharedValue(sticker.scale);
	const rotation = useSharedValue(sticker.rotation);
	const start = useSharedValue({ x: 0, y: 0, scale: 1, rotation: 0 });
	const held = useSharedValue(0);

	const { onChange, onRaise, onRemove, onInteraction, drawerTop, overDrawer } = handlers;

	const grab = () => {
		'worklet';
		held.value += 1;
		if (held.value === 1) {
			start.value = { x: x.value, y: y.value, scale: scale.value, rotation: rotation.value };
			runOnJS(onRaise)(id);
			if (onInteraction) runOnJS(onInteraction)(true);
		}
	};
	const letGo = () => {
		'worklet';
		held.value = Math.max(0, held.value - 1);
		if (held.value === 0 && onInteraction) runOnJS(onInteraction)(false);
	};

	const pan = Gesture.Pan()
		.maxPointers(2)
		.onStart(grab)
		.onUpdate((e) => {
			x.value = start.value.x + e.translationX;
			y.value = start.value.y + e.translationY;
			overDrawer.set(e.absoluteY > drawerTop.value);
		})
		.onEnd((e) => {
			if (e.absoluteY > drawerTop.value) {
				overDrawer.set(false);
				runOnJS(onRemove)(id);
				return;
			}
			// the centre stays on the card
			const cx = Math.min(cardW, Math.max(0, x.value));
			const cy = Math.min(cardH, Math.max(0, y.value));
			x.value = withTiming(cx, { duration: 120 });
			y.value = withTiming(cy, { duration: 120 });
			runOnJS(onChange)(id, { x: cx / cardW, y: cy / cardH });
		})
		.onFinalize(letGo);

	const pinch = Gesture.Pinch()
		.onStart(grab)
		.onUpdate((e) => {
			scale.value = Math.min(
				STICKER_SCALE_MAX,
				Math.max(STICKER_SCALE_MIN, start.value.scale * e.scale)
			);
		})
		.onEnd(() => runOnJS(onChange)(id, { scale: scale.value }))
		.onFinalize(letGo);

	const rotate = Gesture.Rotation()
		.onStart(grab)
		.onUpdate((e) => {
			rotation.value = start.value.rotation + (e.rotation * 180) / Math.PI;
		})
		.onEnd(() => runOnJS(onChange)(id, { rotation: rotation.value }))
		.onFinalize(letGo);

	const gesture = Gesture.Simultaneous(pan, pinch, rotate);

	const animated = useAnimatedStyle(() => ({
		transform: [
			{ translateX: x.value - box.width / 2 },
			{ translateY: y.value - box.height / 2 },
			{ rotate: `${rotation.value + wobble}deg` },
			{ scale: scale.value * (held.value > 0 ? 1.04 : 1) }
		],
		opacity: held.value > 0 && overDrawer.value ? 0.6 : 1
	}));

	// Follow the saved placement whenever it changes from outside a gesture.
	useEffect(() => {
		x.value = sticker.x * cardW;
		y.value = sticker.y * cardH;
		scale.value = sticker.scale;
		rotation.value = sticker.rotation;
	}, [sticker.x, sticker.y, sticker.scale, sticker.rotation, cardW, cardH, x, y, scale, rotation]);

	// The foil's light field follows the saved placement; mid-drag it catches up on release.
	const card = useMemo<StickerOnCard>(
		() => ({
			width: cardW,
			height: cardH,
			cx: sticker.x * cardW,
			cy: sticker.y * cardH,
			rotation: sticker.rotation + wobble,
			scale: sticker.scale
		}),
		[cardW, cardH, sticker.x, sticker.y, sticker.rotation, sticker.scale, wobble]
	);
	const light = useMemo(() => ({ rx, ry, card }), [rx, ry, card]);

	return (
		<GestureDetector gesture={gesture}>
			<Animated.View
				accessibilityRole="adjustable"
				accessibilityLabel={`${definition.name} sticker. Drag to move, pinch to resize, twist to rotate.`}
				style={[
					styles.sticker,
					{ width: box.width, height: box.height, zIndex: sticker.z_index + 1 },
					animated
				]}
			>
				<StickerRenderer definition={definition} foil={sticker.foil} width={size} light={light} />
			</Animated.View>
		</GestureDetector>
	);
}

const styles = StyleSheet.create({
	sticker: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' }
});
