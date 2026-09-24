/**
 * Anything on the card that doesn't fully fit, said in words under it (card
 * spec §3.1, §3.4, §6) — the editor never lets the card clip silently.
 */

import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../../theme/palette';
import { space, type } from '../../theme/tokens';
import { useFrontLayout } from '../CardFace';
import { normalizeLinks } from '../links';
import type { CardView } from '../types';
import { fitNotices } from './fit-notices';

export function FitNotes({ view }: { view: CardView }) {
	const { layout } = useFrontLayout(view);
	const notes = fitNotices(layout, normalizeLinks(view.links).length > 0);
	if (!notes.length) return null;
	return (
		<View style={styles.notes} accessibilityLiveRegion="polite">
			{notes.map((n) => (
				<Text key={n.key} style={styles.note}>
					{n.text}
				</Text>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	notes: { gap: space.xs },
	note: { ...type.small, color: palette.butter, textAlign: 'center' }
});
