/**
 * The link editor that sits under the card.
 *
 * One row per link — label, url, remove — because that is the whole of a link
 * and a row of three controls needs no explaining. The first three rows are the
 * chips drawn on the card face; anything past that becomes "+N more" there, and
 * the divider here says so rather than leaving someone to wonder why their
 * fourth link never appeared.
 *
 * Rows are kept even while empty: an empty row is somewhere to type, and
 * `linksToJson` drops them on the way to the database, so a half-filled row is
 * never a half-saved link.
 */

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '../../theme/palette';
import { radius, space, type } from '../../theme/tokens';
import { LINK_LABEL_MAX, LINK_URL_MAX, MAX_LINKS, blankLink, displayUrl } from '../links';
import type { CardLink } from '../types';

/** Matches `MAX_CHIPS` in CardFace — the number of links the card itself shows. */
const SHOWN_ON_CARD = 3;

export function LinkRows({
	links,
	onChange
}: {
	links: CardLink[];
	onChange: (next: CardLink[]) => void;
}) {
	const update = (index: number, patch: Partial<CardLink>) => {
		onChange(links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
	};
	const remove = (index: number) => onChange(links.filter((_, i) => i !== index));
	const add = () => onChange([...links, blankLink()]);

	return (
		<View style={styles.section}>
			<Text style={styles.sectionLabel}>Links</Text>

			{links.map((link, i) => (
				<View key={i}>
					{i === SHOWN_ON_CARD ? (
						<View style={styles.cutoff}>
							<View style={styles.cutoffRule} />
							<Text style={styles.cutoffText}>shown as “+more”</Text>
							<View style={styles.cutoffRule} />
						</View>
					) : null}

					<View style={styles.row}>
						<TextInput
							value={link.label}
							onChangeText={(label) => update(i, { label })}
							placeholder="Label"
							placeholderTextColor={palette.creamFaint}
							selectionColor={palette.teal}
							maxLength={LINK_LABEL_MAX}
							accessibilityLabel={`Label for link ${i + 1}`}
							style={[styles.input, styles.labelInput]}
						/>
						<TextInput
							value={link.url}
							onChangeText={(url) => update(i, { url })}
							placeholder="instagram.com/you"
							placeholderTextColor={palette.creamFaint}
							selectionColor={palette.teal}
							maxLength={LINK_URL_MAX}
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="url"
							inputMode="url"
							accessibilityLabel={`Address for link ${i + 1}`}
							style={[styles.input, styles.urlInput]}
						/>
						<Pressable
							onPress={() => remove(i)}
							accessibilityRole="button"
							accessibilityLabel={`Remove ${link.label || displayUrl(link.url) || `link ${i + 1}`}`}
							hitSlop={6}
							style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
						>
							<Text style={styles.removeGlyph}>✕</Text>
						</Pressable>
					</View>
				</View>
			))}

			{links.length < MAX_LINKS ? (
				<Pressable
					onPress={add}
					accessibilityRole="button"
					style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
				>
					<Text style={styles.addText}>+ Add link</Text>
				</Pressable>
			) : (
				<Text style={styles.hint}>{MAX_LINKS} links is the most a card can carry.</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: space.sm },
	sectionLabel: { ...type.meta, color: palette.creamMute },
	row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
	input: {
		minHeight: 44,
		backgroundColor: palette.raisedHigh,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		paddingHorizontal: space.md,
		...type.small,
		color: palette.cream
	},
	labelInput: { flex: 1 },
	// The address is the longer of the two and the one worth reading back.
	urlInput: { flex: 1.5 },
	remove: {
		width: 36,
		height: 36,
		borderRadius: radius.pill,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	removePressed: { backgroundColor: palette.danger, borderColor: palette.danger },
	removeGlyph: { ...type.small, color: palette.creamMute },
	add: {
		minHeight: 44,
		borderRadius: radius.md,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		borderStyle: 'dashed',
		borderColor: palette.lineStrong
	},
	addPressed: { backgroundColor: palette.raisedHigh },
	addText: { ...type.bodyStrong, color: palette.teal },
	hint: { ...type.small, color: palette.creamFaint },
	cutoff: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
	cutoffRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.line },
	cutoffText: { ...type.meta, color: palette.creamFaint }
});
