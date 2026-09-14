import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';

/** Binder — Phase 6. The 3-wide grid, sort/filter, and the tier reveal flip. */
export default function BinderScreen() {
	return (
		<View style={styles.page}>
			<Text style={styles.title}>Binder</Text>
			<Text style={styles.body}>
				Phase 6: the 3-wide grid, sort and filter, and the flip that reveals a new tier.
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
