import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { missingSupabaseEnv } from '@/lib/env';
import { Body, Heading, Panel } from '@/ui';
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';

/**
 * Shown when the app has no Supabase configuration, instead of letting every
 * screen fail separately. The web app does the same thing with its setup page:
 * name what is missing and how to fix it.
 */
export default function SetupScreen() {
	const insets = useSafeAreaInsets();
	const missing = missingSupabaseEnv();

	return (
		<ScrollView
			contentContainerStyle={[
				styles.page,
				{ paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl }
			]}
		>
			<Heading>Almost there</Heading>
			<Body>Concard needs to know which Supabase project to talk to.</Body>

			<Panel>
				<Text style={styles.label}>Not set</Text>
				{missing.map((name) => (
					<Text key={name} style={styles.code}>
						{name}
					</Text>
				))}
			</Panel>

			<Panel>
				<Text style={styles.label}>Fix</Text>
				<Body>
					Copy .env.example to .env, fill in the values from your Supabase project under Settings →
					API, then restart the dev server so Expo picks them up.
				</Body>
			</Panel>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	page: { paddingHorizontal: space.xl, gap: space.lg },
	label: { ...type.meta, color: palette.teal },
	code: { ...type.bodyStrong, color: palette.butter }
});
