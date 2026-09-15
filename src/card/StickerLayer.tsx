import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { STICKER_BY_ID } from '@/stickers/catalog';
import { palette } from '@/theme/palette';
import { font } from '@/theme/tokens';
import type { PlacedSticker } from './types';

interface StickerLayerProps {
	stickers: PlacedSticker[];
	width: number;
	selectedId?: string | null;
	editable?: boolean;
	onSelect?: (id: string) => void;
	onChange?: (id: string, patch: Partial<PlacedSticker>) => void;
	onDelete?: (id: string) => void;
}

export function StickerLayer({
	stickers,
	width,
	selectedId,
	editable,
	onSelect,
	onChange,
	onDelete
}: StickerLayerProps) {
	const height = width * 1.4;
	return (
		<View style={StyleSheet.absoluteFill} pointerEvents={editable ? 'box-none' : 'none'}>
			{stickers.map((sticker) => (
				<PlacedStickerView
					key={sticker.id ?? sticker.sticker_id}
					sticker={sticker}
					width={width}
					height={height}
					selected={selectedId === sticker.id}
					editable={editable}
					onSelect={onSelect}
					onChange={onChange}
					onDelete={onDelete}
				/>
			))}
		</View>
	);
}

function PlacedStickerView({
	sticker,
	width,
	height,
	selected,
	editable,
	onSelect,
	onChange,
	onDelete
}: {
	sticker: PlacedSticker;
	width: number;
	height: number;
	selected: boolean;
	editable?: boolean;
	onSelect?: (id: string) => void;
	onChange?: (id: string, patch: Partial<PlacedSticker>) => void;
	onDelete?: (id: string) => void;
}) {
	const definition = STICKER_BY_ID[sticker.sticker_id] ?? {
		id: sticker.sticker_id,
		name: 'Sticker',
		glyph: '✦',
		foil: 'none' as const,
		color: palette.butter,
		unlocked: true
	};

	const id = sticker.id ?? sticker.sticker_id;
	const baseSize = width * 0.16;
	const x = useSharedValue(sticker.x * width);
	const y = useSharedValue(sticker.y * height);
	const scale = useSharedValue(sticker.scale);
	const rotation = useSharedValue(sticker.rotation);
	const startX = useSharedValue(0);
	const startY = useSharedValue(0);
	const startScale = useSharedValue(1);
	const startRotation = useSharedValue(0);

	const drag = Gesture.Pan()
		.enabled(!!editable)
		.onBegin(() => {
			startX.value = x.value;
			startY.value = y.value;
			if (onSelect) runOnJS(onSelect)(id);
		})
		.onUpdate((event) => {
			x.value = startX.value + event.translationX;
			y.value = startY.value + event.translationY;
		})
		.onEnd(() => {
			if (onChange) runOnJS(onChange)(id, { x: x.value / width, y: y.value / height });
		});

	const transform = Gesture.Pan()
		.enabled(!!editable && selected)
		.onBegin(() => {
			startScale.value = scale.value;
			startRotation.value = rotation.value;
		})
		.onUpdate((event) => {
			scale.value = Math.max(0.55, Math.min(2.2, startScale.value + event.translationX / 80));
			rotation.value = startRotation.value + event.translationY * 0.7;
		})
		.onEnd(() => {
			if (onChange) {
				runOnJS(onChange)(id, { scale: scale.value, rotation: rotation.value });
			}
		});

	const animated = useAnimatedStyle(() => ({
		transform: [
			{ translateX: x.value - baseSize / 2 },
			{ translateY: y.value - baseSize / 2 },
			{ rotate: `${rotation.value}deg` },
			{ scale: scale.value }
		]
	}));

	return (
		<GestureDetector gesture={drag}>
			<Animated.View
				style={[
					styles.sticker,
					{ width: baseSize, height: baseSize, zIndex: sticker.z_index },
					animated,
					selected && styles.selected
				]}
			>
				<Pressable
					style={[styles.disc, { backgroundColor: definition.color }]}
					onPress={() => onSelect?.(id)}
				>
					<Text style={[styles.glyph, { fontSize: baseSize * 0.58 }]}>{definition.glyph}</Text>
				</Pressable>

				{editable && selected ? (
					<>
						<Pressable
							hitSlop={10}
							onPress={() => onDelete?.(id)}
							style={[styles.control, styles.delete]}
						>
							<Text style={styles.controlText}>×</Text>
						</Pressable>
						<GestureDetector gesture={transform}>
							<Animated.View style={[styles.control, styles.resize]}>
								<Text style={styles.controlText}>↗</Text>
							</Animated.View>
						</GestureDetector>
					</>
				) : null}
			</Animated.View>
		</GestureDetector>
	);
}

const styles = StyleSheet.create({
	sticker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
	disc: {
		width: '100%',
		height: '100%',
		borderRadius: 999,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: 'rgba(255,255,255,0.78)',
		boxShadow: '0 3px 8px rgba(18,7,32,0.42)'
	},
	glyph: {
		fontFamily: font.display,
		color: '#241340',
		textAlign: 'center',
		includeFontPadding: false
	},
	selected: {
		borderWidth: 1.5,
		borderColor: palette.teal,
		borderStyle: 'dashed'
	},
	control: {
		position: 'absolute',
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: palette.teal,
		borderWidth: 2,
		borderColor: palette.void
	},
	delete: { left: -15, top: -15, backgroundColor: palette.rose },
	resize: { right: -15, bottom: -15 },
	controlText: { color: palette.void, fontFamily: font.bodyBold, fontSize: 15 }
});
