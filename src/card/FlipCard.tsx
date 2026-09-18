/**
 * Owns the card's tilt and its flip, and hands the tilt down to both faces.
 *
 * Ported from the web app's `FlipCard.svelte`: one shared `rx`/`ry` so the
 * front's highlight and the back's sheen can never desync mid-flip.
 *
 * Drag tilts the card in 3D. Tap flips it.
 *
 * RN quality path (why this isn't a straight port of the web transforms):
 *
 *  1. At rest the card is a flat view — no `perspective` layer — so scrolling
 *     stays sharp.
 *  2. On drag we promote a hardware texture (`shouldRasterizeIOS` /
 *     `renderToHardwareTextureAndroid`) and *then* apply rotateX/Y. The GPU
 *     warps one bitmap instead of re-compositing text/gradients/stickers under
 *     perspective, which was the glassy pixelation.
 *  3. Foil layer parallax stays frozen while the body tilts (see `Foil.tsx`) so
 *     that bitmap isn't invalidated every frame. The physical tilt *is* the
 *     light cue.
 */

import { type ReactNode, useCallback, useEffect, useState } from 'react';
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

/** Below this, treat the card as flat and drop the 3D transform entirely. */
const REST_EPS = 0.15;

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

	const rx = useSharedValue(0);
	const ry = useSharedValue(0);
	/** 0 = front, 1 = back — drives the in-flight flip only. */
	const flip = useSharedValue(0);
	/** 1 while dragging or the settle spring is running. */
	const live = useSharedValue(0);

	const [showingBack, setShowingBack] = useState(false);
	/** Non-null while a flip is staged/running: the face we're animating toward. */
	const [flipTarget, setFlipTarget] = useState<0 | 1 | null>(null);
	/** Promotes the hardware-texture path only while the card is in motion. */
	const [tilting, setTilting] = useState(false);

	const finishFlip = useCallback(
		(next: boolean) => {
			setShowingBack(next);
			setFlipTarget(null);
			onFlipChange?.(next);
		},
		[onFlipChange]
	);

	const endTilt = useCallback(() => {
		setTilting(false);
	}, []);

	const beginTilt = useCallback(() => {
		setTilting(true);
	}, []);

	// Mount the 3D faces first, then run the timing so the animation isn't lost.
	useEffect(() => {
		if (flipTarget == null) return;
		const from: 0 | 1 = flipTarget === 1 ? 0 : 1;
		flip.value = from;
		flip.value = withTiming(flipTarget, { duration: 520 }, (finished) => {
			if (finished) runOnJS(finishFlip)(flipTarget === 1);
		});
	}, [flipTarget, finishFlip, flip]);

	const pan = Gesture.Pan()
		.onBegin(() => {
			live.value = 1;
			runOnJS(beginTilt)();
		})
		.onChange((e) => {
			const span = width * DRAG_TO_FULL;
			ry.value = clamp((e.translationX / span) * TILT_RANGE, -TILT_RANGE, TILT_RANGE);
			rx.value = clamp((-e.translationY / span) * TILT_RANGE, -TILT_RANGE, TILT_RANGE);
		})
		.onFinalize(() => {
			rx.value = withSpring(0, { damping: 16, stiffness: 140 }, (finished) => {
				if (finished) {
					live.value = 0;
					runOnJS(endTilt)();
				}
			});
			ry.value = withSpring(0, { damping: 16, stiffness: 140 });
		});

	const requestFlip = useCallback(() => {
		setFlipTarget(showingBack ? 0 : 1);
	}, [showingBack]);

	const tap = Gesture.Tap()
		.enabled(flippable && !!renderBack && flipTarget == null)
		.onEnd(() => {
			runOnJS(requestFlip)();
		});

	const gesture = Gesture.Simultaneous(pan, tap);

	// One perspective, applied only while live. At rest we return no transform
	// so the view demotes out of the 3D compositing path (keeps scroll sharp).
	const stageStyle = useAnimatedStyle(() => {
		if (live.value === 0 && Math.abs(rx.value) < REST_EPS && Math.abs(ry.value) < REST_EPS) {
			return {};
		}

		return {
			transform: [
				{ perspective: 1400 },
				{ rotateY: `${ry.value}deg` },
				{ rotateX: `${rx.value}deg` }
			]
		};
	});

	const frontStyle = useAnimatedStyle(() => ({
		transform: [
			{ perspective: 1400 },
			{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }
		],
		backfaceVisibility: 'hidden' as const
	}));

	const backStyle = useAnimatedStyle(() => ({
		transform: [
			{ perspective: 1400 },
			{ rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }
		],
		backfaceVisibility: 'hidden' as const
	}));

	const flipping = flipTarget != null && !!renderBack;

	const face = flipping ? (
		<>
			<Animated.View style={[StyleSheet.absoluteFill, frontStyle]} collapsable={false}>
				{renderFront(rx, ry)}
			</Animated.View>
			<Animated.View style={[StyleSheet.absoluteFill, backStyle]} collapsable={false}>
				{renderBack!(rx, ry)}
			</Animated.View>
		</>
	) : (
		<View style={StyleSheet.absoluteFill} collapsable={false}>
			{showingBack && renderBack ? renderBack(rx, ry) : renderFront(rx, ry)}
		</View>
	);

	return (
		<GestureDetector gesture={gesture}>
			<Animated.View
				style={[{ width, height }, stageStyle]}
				// Flatten to a texture while tilting so perspective warps a bitmap
				// instead of live text. Off at rest so scroll stays crisp.
				shouldRasterizeIOS={tilting || flipping}
				renderToHardwareTextureAndroid={tilting || flipping}
				collapsable={false}
			>
				{face}
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
