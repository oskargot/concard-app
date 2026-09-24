/**
 * The photo/bio divider (card spec §6). Editor only — it never renders on a
 * card anywhere else, in snapshots, in the binder or on the web.
 *
 * Dragging moves H in 14-unit steps, one bio line per step, from 112 up to
 * H_max, where the photo takes all the room above the links and the bio hides.
 * Each step lands with a light selection tick. The visible pill is 28 × 6
 * units, but the touch target is a fixed 44 × 44 pt whatever the card's scale,
 * so it stays grabbable on a small phone.
 */

import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { GRAPHITE, type FaceInk } from '../card-style';
import { photoHeightStops, snapPhotoHeight, type FrontLayout } from '../layout/front';
import { CARD_W, DIVIDER } from '../layout/spec';

export function DividerHandle({
	layout,
	linkCount,
	width,
	ink,
	onChange,
	onInteraction
}: {
	layout: FrontLayout;
	linkCount: number;
	width: number;
	ink: FaceInk;
	onChange: (height: number) => void;
	onInteraction?: (active: boolean) => void;
}) {
	const s = width / CARD_W;
	// Gesture state lives in shared values: the callbacks below run on the JS
	// thread (`runOnJS(true)`), long after render.
	const startH = useSharedValue(layout.photo.height);
	const lastH = useSharedValue(layout.photo.height);
	const stops = photoHeightStops(linkCount);

	const drag = Gesture.Pan()
		.runOnJS(true)
		.minDistance(0)
		.onBegin(() => {
			startH.value = layout.photo.height;
			lastH.value = layout.photo.height;
			onInteraction?.(true);
		})
		.onUpdate((e) => {
			const next = snapPhotoHeight(startH.value + e.translationY / s, linkCount);
			if (next === lastH.value) return;
			lastH.value = next;
			void Haptics.selectionAsync();
			onChange(next);
		})
		.onFinalize(() => onInteraction?.(false));

	const i = stops.indexOf(layout.photo.height);
	const step = (dir: 1 | -1) => {
		const next = stops[Math.min(stops.length - 1, Math.max(0, i + dir))];
		if (next !== layout.photo.height) {
			void Haptics.selectionAsync();
			onChange(next);
		}
	};

	return (
		<GestureDetector gesture={drag}>
			<View
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel="Photo and bio divider"
				accessibilityValue={{ min: 0, max: stops.length - 1, now: Math.max(0, i) }}
				accessibilityHint="Drag up or down to trade photo height for bio lines"
				onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
				accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
				hitSlop={4}
				style={{
					position: 'absolute',
					left: layout.divider.x * s - DIVIDER.touch / 2,
					top: layout.divider.y * s - DIVIDER.touch / 2,
					width: DIVIDER.touch,
					height: DIVIDER.touch,
					alignItems: 'center',
					justifyContent: 'center'
				}}
			>
				<View
					style={{
						width: DIVIDER.width * s,
						height: DIVIDER.height * s,
						borderRadius: (DIVIDER.height / 2) * s,
						backgroundColor: GRAPHITE,
						borderWidth: Math.max(s, 1),
						borderColor: ink.line
					}}
				/>
			</View>
		</GestureDetector>
	);
}
