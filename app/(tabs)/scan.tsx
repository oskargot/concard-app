import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';

/** Scan — Phase 5. Camera, offline scan queue, and the card-back animation
 *  sliding down into the binder (design bible §7). */
export default function ScanScreen() {
	return (
		<View style={styles.page}>
			<Text style={styles.title}>Scan</Text>
			<Text style={styles.body}>
				Phase 5: camera, the offline scan queue, and the card back sliding into the binder.
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	page: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: space.xl,
		gap: space.sm
	},
	title: { ...type.title, color: palette.cream },
	body: { ...type.small, color: palette.creamMute, textAlign: 'center' }
});
