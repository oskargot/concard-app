/**
 * The fandom badge picker at the foot of the editor.
 *
 * Each option is drawn as the badge itself rather than as its name, because the
 * badge is what ends up on the card — picking from a list of words would mean
 * choosing something you can't see until afterwards. `CardOverlay` draws the
 * real thing at `m.u(20)`; these are the same two-tone gradient at a fixed size.
 *
 * "None" leads, since a card without a fandom is the default and getting back to
 * it should not be the hard part.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette } from '../../theme/palette';
import { radius, space, type } from '../../theme/tokens';
import type { Database } from '../../lib/database.types';

type Fandom = Database['public']['Tables']['fandoms']['Row'];

export function AffiliationRow({
	fandoms,
	value,
	onChange
}: {
	fandoms: Fandom[];
	value: string | null;
	onChange: (next: string | null) => void;
}) {
	if (!fandoms.length) return null;

	return (
		<View style={styles.section}>
			<Text style={styles.sectionLabel}>Affiliation</Text>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.row}>
					<Pressable
						onPress={() => onChange(null)}
						accessibilityRole="radio"
						accessibilityState={{ selected: value === null }}
						accessibilityLabel="No affiliation"
						style={({ pressed }) => [
							styles.option,
							styles.none,
							value === null && styles.optionOn,
							pressed && { opacity: 0.7 }
						]}
					>
						<Text style={styles.noneText}>None</Text>
					</Pressable>

					{fandoms.map((fandom) => {
						const on = fandom.id === value;
						return (
							<Pressable
								key={fandom.id}
								onPress={() => onChange(fandom.id)}
								accessibilityRole="radio"
								accessibilityState={{ selected: on }}
								accessibilityLabel={fandom.name}
								style={({ pressed }) => [
									styles.option,
									on && styles.optionOn,
									pressed && { opacity: 0.7 }
								]}
							>
								<View
									style={[
										styles.badge,
										{
											experimental_backgroundImage: `linear-gradient(150deg, ${fandom.color_a}, ${fandom.color_b})`
										}
									]}
								>
									<Text style={styles.mark}>{fandom.mark}</Text>
								</View>
								<Text numberOfLines={1} style={styles.name}>
									{fandom.name}
								</Text>
							</Pressable>
						);
					})}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: space.sm },
	sectionLabel: { ...type.meta, color: palette.creamMute },
	row: { flexDirection: 'row', gap: space.sm, paddingVertical: 2 },
	option: {
		width: 72,
		alignItems: 'center',
		gap: space.xs,
		paddingVertical: space.sm,
		paddingHorizontal: space.xs,
		borderRadius: radius.md,
		borderWidth: 2,
		borderColor: 'transparent'
	},
	optionOn: { borderColor: palette.teal, backgroundColor: palette.raisedHigh },
	badge: {
		width: 40,
		height: 40,
		borderRadius: radius.sm,
		alignItems: 'center',
		justifyContent: 'center'
	},
	mark: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: '#fbf9f3' },
	name: { ...type.meta, color: palette.creamMute, maxWidth: '100%' },
	none: { justifyContent: 'center', minHeight: 40 + space.xs + 14 },
	noneText: { ...type.small, color: palette.creamMute }
});
