/**
 * The fandom affiliation picker at the foot of the editor.
 *
 * Each option is drawn as the generative sticker itself rather than as a
 * square badge or a list of words — picking from a preview of what lands on
 * the card. `CardOverlay` draws the same renderer on the face.
 *
 * "None" leads, since a card without a fandom is the default and getting back
 * to it should not be the hard part. "Submit a fandom" ends the row
 * (HANDOFF §2.4): type a name, see it drawn by the real renderer as you type,
 * send it for review. Your own submissions wait in the row as "In review" and
 * can't be picked until they're approved; nobody else sees them.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
	FANDOM_NAME_MAX,
	FANDOM_PENDING_MAX,
	fandomNameLength,
	fandomStatus,
	normalizeFandomName,
	styleCategoryOf,
	type FandomRow
} from '../../stickers/fandoms';
import {
	definitionFromAffiliation,
	makeFandomDefinition,
	slugifyFandomLabel,
	styleCategoryForFandom
} from '../../stickers/fandom-styles';
import { StickerRenderer } from '../../stickers/StickerRenderer';
import { palette } from '../../theme/palette';
import { radius, space, type } from '../../theme/tokens';
import { Button, Field, FormError } from '../../ui';
import { AFFILIATION_DEFAULTS } from '../card-view';

const PICKER_STICKER_WIDTH = 72;
const PREVIEW_WIDTH = 150;

export function AffiliationRow({
	fandoms,
	value,
	onChange,
	onSubmit
}: {
	fandoms: FandomRow[];
	value: string | null;
	onChange: (next: string | null) => void;
	/** Sends a new fandom for review; throws with a readable reason. */
	onSubmit?: (name: string) => Promise<void>;
}) {
	const [composing, setComposing] = useState(false);
	const visible = useMemo(() => fandoms.filter((f) => fandomStatus(f) !== 'rejected'), [fandoms]);
	const pendingCount = visible.filter((f) => fandomStatus(f) === 'pending').length;

	if (!visible.length && !onSubmit) return null;

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

					{visible.map((fandom) => {
						const pending = fandomStatus(fandom) === 'pending';
						const on = fandom.id === value;
						const definition = definitionFromAffiliation({
							id: fandom.id,
							name: fandom.name,
							style_category: styleCategoryOf(fandom)
						});
						return (
							<Pressable
								key={fandom.id}
								onPress={() => (pending ? null : onChange(fandom.id))}
								disabled={pending}
								accessibilityRole="radio"
								accessibilityState={{ selected: on, disabled: pending }}
								accessibilityLabel={pending ? `${fandom.name}, in review` : fandom.name}
								style={({ pressed }) => [
									styles.option,
									on && styles.optionOn,
									pending && styles.optionPending,
									pressed && !pending && { opacity: 0.7 }
								]}
							>
								<View style={[styles.stickerSlot, pending && styles.pendingArt]}>
									<StickerRenderer
										definition={definition}
										foil={AFFILIATION_DEFAULTS.foil}
										width={PICKER_STICKER_WIDTH}
									/>
								</View>
								{pending ? <Text style={styles.review}>In review</Text> : null}
							</Pressable>
						);
					})}

					{onSubmit ? (
						<Pressable
							onPress={() => setComposing((c) => !c)}
							accessibilityRole="button"
							accessibilityState={{ expanded: composing }}
							accessibilityLabel="Submit a fandom"
							style={({ pressed }) => [
								styles.option,
								styles.submit,
								composing && styles.optionOn,
								pressed && { opacity: 0.7 }
							]}
						>
							<Text style={styles.plus}>+</Text>
							<Text style={styles.submitText}>Submit a fandom</Text>
						</Pressable>
					) : null}
				</View>
			</ScrollView>

			{composing && onSubmit ? (
				<SubmitFandom
					atCap={pendingCount >= FANDOM_PENDING_MAX}
					onSubmit={async (name) => {
						await onSubmit(name);
						setComposing(false);
					}}
				/>
			) : null}
		</View>
	);
}

function SubmitFandom({
	atCap,
	onSubmit
}: {
	atCap: boolean;
	onSubmit: (name: string) => Promise<void>;
}) {
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const clean = normalizeFandomName(name);
	const length = fandomNameLength(clean);
	const preview = useMemo(
		() =>
			makeFandomDefinition(
				clean || 'Your fandom',
				styleCategoryForFandom({ id: slugifyFandomLabel(clean), name: clean })
			),
		[clean]
	);

	const send = async () => {
		setBusy(true);
		setError(null);
		try {
			await onSubmit(clean);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<View style={styles.form}>
			<View style={styles.preview}>
				<StickerRenderer definition={preview} width={PREVIEW_WIDTH} />
			</View>
			<Field
				label="Fandom name"
				value={name}
				// cut in characters, as the server counts; maxLength counts UTF-16 units
				onChangeText={(t) => setName([...t].slice(0, FANDOM_NAME_MAX + 4).join(''))}
				maxLength={(FANDOM_NAME_MAX + 4) * 2}
				placeholder="e.g. Dungeon Meshi"
				autoCapitalize="words"
				autoCorrect={false}
				hint={`${length}/${FANDOM_NAME_MAX} · Oskar reviews every fandom before it goes live.`}
			/>
			<FormError
				message={
					error ??
					(atCap
						? `You have ${FANDOM_PENDING_MAX} fandoms waiting for review already.`
						: length > FANDOM_NAME_MAX
							? `That's ${length} characters — ${FANDOM_NAME_MAX} is the most a sticker can hold.`
							: null)
				}
			/>
			<Button
				label="Submit for review"
				onPress={send}
				busy={busy}
				disabled={atCap || !clean || length > FANDOM_NAME_MAX}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: space.sm },
	sectionLabel: { ...type.meta, color: palette.textDim },
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
	optionOn: { borderColor: palette.holo, backgroundColor: palette.surface },
	optionPending: { borderStyle: 'dashed', borderColor: palette.mutedUi },
	pendingArt: { opacity: 0.55 },
	stickerSlot: {
		width: PICKER_STICKER_WIDTH,
		minHeight: 44,
		alignItems: 'center',
		justifyContent: 'center'
	},
	review: { ...type.small, fontSize: 11, color: palette.textFaint, marginTop: 2 },
	none: { justifyContent: 'center', minHeight: 72 },
	noneText: { ...type.small, color: palette.textDim },
	submit: { gap: 2 },
	plus: { ...type.title, color: palette.textDim },
	submitText: { ...type.small, fontSize: 11, color: palette.textDim, textAlign: 'center' },
	form: {
		gap: space.sm,
		padding: space.md,
		borderRadius: radius.lg,
		backgroundColor: palette.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	preview: { alignItems: 'center', justifyContent: 'center', minHeight: 96 }
});
