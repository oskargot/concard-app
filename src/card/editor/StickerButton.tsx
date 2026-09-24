/**
 * The editor's sticker button (HANDOFF §2.1): floating, pinned bottom-right
 * in thumb reach, and staying put while the page scrolls.
 *
 * Its glyph is drawn *as a sticker* — the four-point sparkle run through the
 * same die-cut pipeline as every deco sticker (scripts/stickers/
 * make-button-icon.ts), so its white outline is the stickers' outline. The
 * button itself is chrome: graphite, a lit top bevel and a soft drop shadow
 * at rest; pressed (or while the drawer is open) it sinks in — the shadow goes
 * inside and it drops a point.
 *
 * It rides up above the drawer when the drawer opens, so the same thumb that
 * opened it closes it.
 */

import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { palette } from '../../theme/palette';

export const STICKER_BUTTON_SIZE = 56;
export const STICKER_BUTTON_MARGIN = 16;

const ICON = require('../../../assets/stickers/button-icon.webp');

export function StickerButton({
	open,
	bottom,
	onPress
}: {
	open: boolean;
	/** Distance from the screen's bottom edge, in pt. */
	bottom: number;
	onPress: () => void;
}) {
	const lift = useAnimatedStyle(() => ({
		bottom: withTiming(bottom, { duration: 220 })
	}));

	return (
		<Animated.View style={[styles.anchor, lift]}>
			<Pressable
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={open ? 'Close stickers' : 'Stickers'}
				accessibilityState={{ expanded: open }}
				hitSlop={8}
				style={({ pressed }) => [styles.button, (pressed || open) && styles.pressed]}
			>
				{({ pressed }) => (
					<Image
						source={ICON}
						style={[styles.icon, (pressed || open) && styles.iconPressed]}
						contentFit="contain"
						transition={0}
					/>
				)}
			</Pressable>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	anchor: {
		position: 'absolute',
		right: STICKER_BUTTON_MARGIN,
		zIndex: 40
	},
	button: {
		width: STICKER_BUTTON_SIZE,
		height: STICKER_BUTTON_SIZE,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		// lit top bevel, darker bottom lip, and a drop shadow onto the page
		boxShadow: [
			'inset 0 1px 0 rgba(255,255,255,0.14)',
			'inset 0 -2px 0 rgba(0,0,0,0.28)',
			'0 6px 16px rgba(0,0,0,0.45)'
		].join(', ')
	},
	pressed: {
		backgroundColor: palette.surface,
		transform: [{ translateY: 1 }],
		boxShadow: ['inset 0 2px 6px rgba(0,0,0,0.55)', '0 1px 2px rgba(0,0,0,0.35)'].join(', ')
	},
	icon: { width: 34, height: 34 },
	iconPressed: { transform: [{ scale: 0.94 }] }
});
