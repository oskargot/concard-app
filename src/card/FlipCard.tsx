/**
 * Owns the card's tilt and its flip, and hands the tilt down to both faces.
 *
 * Ported from the web app's `FlipCard.svelte`, and for the same reason it exists
 * there: if each face tracked its own light, the front's highlight and the
 * back's sheen would drift apart mid-flip. One pair of shared values, passed to
 * everything that draws light.
 *
 * Drag to tilt, tap to flip. Released tilt springs back to rest, so a card left
 * alone always settles flat.
 */

import { type ReactNode, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
	type SharedValue
} from 'react-native-reanimated';

import { CARD_ASPECT } from '../theme/tokens';

/** Maximum tilt in degrees. Matches the range Foil maps its parallax across. */
const TILT_RANGE = 10;

/** How much of the card you have to drag across to reach full tilt. */
const DRAG_TO_FULL = 0.55;

export interface FlipCardProps {
	width: number;
	/** Both faces receive the same tilt, so their light can never desync. */
	renderFront: (rx: SharedValue<number>, ry: SharedValue<number>) => ReactNode;
	renderBack?: (rx: SharedValue<number>, ry: SharedValue<number>) => ReactNode;
	/** Disable the flip but keep the tilt — binder thumbnails, pickers. */
	flippable?: boolean;
	onFlipChange?: (showingBack: boolean) => void;
}

export function FlipCard({
	width,
	renderFront,
	renderBack,
	flippable = true,
	onFlipChange
}: FlipCardProps) {
	const height = width / CARD_ASPECT;

	// tilt in degrees: rx from vertical drag, ry from horizontal
	const rx = useSharedValue(0);
	const ry = useSharedValue(0);
	/** 0 = front, 1 = back. */
	const flip = useSharedValue(0);

	const notify = useCallback((showingBack: boolean) => onFlipChange?.(showingBack), [onFlipChange]);

	const pan = Gesture.Pan()
		.onChange((e) => {
			const span = width * DRAG_TO_FULL;
			ry.value = clamp((e.translationX / span) * TILT_RANGE, -TILT_RANGE, TILT_RANGE);
			rx.value = clamp((-e.translationY / span) * TILT_RANGE, -TILT_RANGE, TILT_RANGE);
		})
		.onFinalize(() => {
			// settle flat; a card left alone is never left askew
			rx.value = withSpring(0, { damping: 14, stiffness: 110 });
			ry.value = withSpring(0, { damping: 14, stiffness: 110 });
		});

	const tap = Gesture.Tap()
		.enabled(flippable && !!renderBack)
		.onEnd(() => {
			const next = flip.value > 0.5 ? 0 : 1;
			flip.value = withTiming(next, { duration: 520 });
			runOnJS(notify)(next === 1);
		});

	const gesture = Gesture.Simultaneous(pan, tap);

	const frontStyle = useAnimatedStyle(() => ({
		transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
		backfaceVisibility: 'hidden' as const
	}));

	const backStyle = useAnimatedStyle(() => ({
		transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
		backfaceVisibility: 'hidden' as const
	}));

	// Perspective and tilt live on one layer. Applying perspective again to each
	// face made iOS resample text through nested 3D textures while dragging.
	const wrapperStyle = useAnimatedStyle(() => ({
		transform: [{ perspective: 1200 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }]
	}));

	return (
		<GestureDetector gesture={gesture}>
			<Animated.View style={[{ width, height }, wrapperStyle]}>
				<Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
					{renderFront(rx, ry)}
				</Animated.View>
				{renderBack ? (
					<Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
						{renderBack(rx, ry)}
					</Animated.View>
				) : null}
			</Animated.View>
		</GestureDetector>
	);
}

/** A tilt-only card: no gestures, no flip. For grids and pickers. */
export function StaticCard({
	width,
	render
}: {
	width: number;
	render: (rx: SharedValue<number>, ry: SharedValue<number>) => ReactNode;
}) {
	const rx = useSharedValue(0);
	const ry = useSharedValue(0);
	return <View style={{ width, height: width / CARD_ASPECT }}>{render(rx, ry)}</View>;
}

function clamp(n: number, lo: number, hi: number): number {
	'worklet';
	return Math.min(hi, Math.max(lo, n));
}
