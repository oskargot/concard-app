/**
 * The fandom affiliation picker at the foot of the editor.
 *
 * Each option is drawn as the generative sticker itself rather than as a
 * square badge or a list of words — picking from a preview of what lands on
 * the card. `CardOverlay` draws the same renderer on the face.
 *
 * "None" leads, since a card without a fandom is the default and getting back
 * to it should not be the hard part.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Database } from '../../lib/database.types';
import { definitionFromAffiliation, styleCategoryForFandom } from '../../stickers/fandom-styles';
import { StickerRenderer } from '../../stickers/StickerRenderer';
import { palette } from '../../theme/palette';
import { radius, space, type } from '../../theme/tokens';
import { AFFILIATION_DEFAULTS } from '../card-view';

type Fandom = Database['public']['Tables']['fandoms']['Row'];

const PICKER_STICKER_WIDTH = 72;

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
						const styleCategory = styleCategoryForFandom(fandom);
						const definition = definitionFromAffiliation({
							id: fandom.id,
							name: fandom.name,
							style_category: styleCategory
						});
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
								<View style={styles.stickerSlot}>
									<StickerRenderer
										definition={definition}
										foil={AFFILIATION_DEFAULTS.foil}
										width={PICKER_STICKER_WIDTH}
										seed={fandom.id}
									/>
								</View>
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
	row: { flexDirection: 'row', gap: space.sm, paddingVertical: 2, alignItems: 'stretch' },
	option: {
		width: 96,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: space.sm,
		paddingHorizontal: space.xs,
		borderRadius: radius.md,
		borderWidth: 2,
		borderColor: 'transparent',
		backgroundColor: palette.raised
	},
	optionOn: { borderColor: palette.teal, backgroundColor: palette.raisedHigh },
	stickerSlot: {
		width: PICKER_STICKER_WIDTH,
		minHeight: 44,
		alignItems: 'center',
		justifyContent: 'center'
	},
	none: { justifyContent: 'center', minHeight: 72 },
	noneText: { ...type.small, color: palette.creamMute }
});
