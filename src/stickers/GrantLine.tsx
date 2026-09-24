/**
 * What a collect gave you, said quietly (HANDOFF §2.5): the granted stickers
 * as small thumbnails, with a short line. The card reveal stays the main
 * event; this sits under it.
 */

import { StyleSheet, Text, View } from 'react-native';

import { STICKER_FOIL_LABELS } from '@/card/tiers';
import type { PlacedSticker } from '@/card/types';
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';
import { definitionForPlacement } from './definitions';
import { StickerRenderer } from './StickerRenderer';

export function GrantLine({
	granted,
	size = 22,
	compact = false
}: {
	granted: PlacedSticker[] | undefined;
	/** Thumbnail size, pt. */
	size?: number;
	/** Thumbnails only, for tight spots like the scan strip. */
	compact?: boolean;
}) {
	if (!granted?.length) return null;
	const names = granted.map((g) => {
		const def = definitionForPlacement(g);
		return g.foil === 'none' ? def.name : `${STICKER_FOIL_LABELS[g.foil]} ${def.name}`;
	});

	return (
		<View style={styles.row} accessible accessibilityLabel={`You got ${names.join(' and ')}`}>
			{granted.map((g, i) => (
				<StickerRenderer
					key={`${g.sticker_id}-${i}`}
					definition={definitionForPlacement(g)}
					foil={g.foil}
					width={size}
					art="thumb"
				/>
			))}
			{compact ? null : (
				<Text numberOfLines={1} style={styles.text}>
					You got {names.join(' + ')}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
	text: { ...type.small, color: palette.textDim, flexShrink: 1, marginLeft: 2 }
});
