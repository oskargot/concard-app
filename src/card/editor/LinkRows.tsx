/**
 * The link editor that sits under the card (card spec §3.5).
 *
 * Pasting a url is the only required step. The domain picks the icon, so there
 * is no "choose your platform" control, and for a known platform the handle is
 * read out of the url and pre-filled into an editable field below it. The
 * handle keeps following the url for as long as it still holds the value the
 * url suggested; once someone types their own, it stays theirs.
 *
 * Each row previews its pill's cut: when a handle is too wide for the 73-unit
 * text area it says what the card will show instead. Links fill the left
 * column first; rows 5–8 are the right column, which is where the fandom
 * sticker sits by default, so they are labelled as such.
 *
 * Adding a link that opens a new row takes that height from the bio, never
 * the photo. When the photo already reaches too far down for a new row,
 * adding is blocked until the divider moves up, and the button says why.
 *
 * Rows are kept even while empty: an empty row is somewhere to type, and
 * `linksToJson` drops them on the way to the database.
 */

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '../../theme/palette';
import { radius, space, type } from '../../theme/tokens';
import { ellipsize } from '../layout/measure';
import { canAddLink, LINK_FONT, linkRows } from '../layout/front';
import { LINKS } from '../layout/spec';
import { LinkIcon } from '../LinkIcon';
import { linkInfo } from '../link-platforms';
import {
	LINK_HANDLE_MAX,
	LINK_URL_MAX,
	MAX_LINKS,
	blankLink,
	displayHandle,
	displayUrl
} from '../links';
import type { CardLink } from '../types';

export function LinkRows({
	links,
	onChange,
	photoHeight,
	stickerOverRightColumn
}: {
	links: CardLink[];
	onChange: (next: CardLink[]) => void;
	/** The current H, which decides whether one more row still fits. */
	photoHeight: number;
	/** True when the fandom sticker is on the card at its default spot. */
	stickerOverRightColumn: boolean;
}) {
	// Only rows with a url count toward the card; a blank draft row takes no room.
	const filled = links.filter((l) => l.url.trim()).length;
	const hasDraft = links.some((l) => !l.url.trim());
	const addable = !hasDraft && canAddLink(photoHeight, filled);

	const update = (index: number, patch: Partial<CardLink>) => {
		onChange(links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
	};

	const changeUrl = (index: number, url: string) => {
		const old = links[index];
		const suggestedBefore = linkInfo(old.url)?.handle ?? '';
		// Keep following the url while the handle is still the one it suggested.
		const following = !old.handle.trim() || old.handle === suggestedBefore;
		update(index, following ? { url, handle: linkInfo(url)?.handle ?? '' } : { url });
	};

	const remove = (index: number) => onChange(links.filter((_, i) => i !== index));
	const add = () => onChange([...links, blankLink()]);

	let blockedReason: string | null = null;
	if (links.length >= MAX_LINKS) blockedReason = `${MAX_LINKS} links is the most a card can carry.`;
	else if (!hasDraft && !addable) {
		blockedReason =
			'Another link needs a new row, and the photo is using that space. Drag the divider up to make room.';
	}

	return (
		<View style={styles.section}>
			<Text style={styles.sectionLabel}>Links</Text>

			{links.map((link, i) => {
				const info = link.url.trim() ? linkInfo(link.url) : null;
				const shown = link.url.trim() ? displayHandle(link) : '';
				const cut = shown ? ellipsize(shown, LINKS.textWidth, LINK_FONT) : null;
				return (
					<View key={i}>
						{i === LINKS.perColumn ? (
							<View style={styles.cutoff}>
								<View style={styles.cutoffRule} />
								<Text style={styles.cutoffText}>
									{stickerOverRightColumn ? 'right column · under the sticker' : 'right column'}
								</Text>
								<View style={styles.cutoffRule} />
							</View>
						) : null}

						<View style={styles.link}>
							<View style={styles.row}>
								<View
									style={styles.icon}
									accessibilityElementsHidden
									importantForAccessibility="no"
								>
									<LinkIcon url={link.url} size={16} color={palette.creamMute} />
								</View>
								<TextInput
									value={link.url}
									onChangeText={(url) => changeUrl(i, url)}
									placeholder="Paste a link"
									placeholderTextColor={palette.creamFaint}
									selectionColor={palette.teal}
									maxLength={LINK_URL_MAX}
									autoCapitalize="none"
									autoCorrect={false}
									keyboardType="url"
									inputMode="url"
									accessibilityLabel={`Link ${i + 1} address`}
									style={[styles.input, styles.urlInput]}
								/>
								<Pressable
									onPress={() => remove(i)}
									accessibilityRole="button"
									accessibilityLabel={`Remove ${shown || displayUrl(link.url) || `link ${i + 1}`}`}
									hitSlop={6}
									style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
								>
									<Text style={styles.removeGlyph}>✕</Text>
								</Pressable>
							</View>

							{link.url.trim() ? (
								<View style={styles.row}>
									<View style={styles.icon} />
									<TextInput
										value={link.handle}
										onChangeText={(handle) => update(i, { handle })}
										placeholder={info?.handle ?? 'Handle'}
										placeholderTextColor={palette.creamFaint}
										selectionColor={palette.teal}
										maxLength={LINK_HANDLE_MAX}
										autoCapitalize="none"
										autoCorrect={false}
										accessibilityLabel={`Link ${i + 1} handle, shown on the card`}
										style={[styles.input, styles.handleInput]}
									/>
								</View>
							) : null}

							{cut?.truncated ? (
								<Text style={styles.note}>Shows as “{cut.text}” on the card.</Text>
							) : null}
						</View>
					</View>
				);
			})}

			{blockedReason ? (
				<Text style={styles.hint}>{blockedReason}</Text>
			) : !hasDraft ? (
				<Pressable
					onPress={add}
					accessibilityRole="button"
					accessibilityHint={
						linkRows(filled + 1) > linkRows(filled)
							? 'Adds a row of links, taking its height from the bio'
							: undefined
					}
					style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
				>
					<Text style={styles.addText}>+ Add link</Text>
				</Pressable>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: space.sm },
	sectionLabel: { ...type.meta, color: palette.creamMute },
	link: { gap: space.xs },
	row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
	icon: { width: 20, alignItems: 'center' },
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
	urlInput: { flex: 1 },
	handleInput: { flex: 1, marginRight: 36 + space.sm },
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
	note: { ...type.small, color: palette.butter, marginLeft: 20 + space.sm },
	cutoff: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
	cutoffRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.line },
	cutoffText: { ...type.meta, color: palette.creamFaint }
});
