import { useMemo, useState } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Card } from '@/card/Card';
import { StaticCard } from '@/card/FlipCard';
import {
	BGS,
	BG_KEYS,
	FRAMES,
	FRAME_KEYS,
	PHOTO_SHAPES,
	PHOTO_SHAPE_LABEL,
	randomStyle,
	styleToJson,
	type BgKey,
	type FrameKey,
	type PhotoShape
} from '@/card/card-style';
import { foilForTier } from '@/card/tiers';
import { BIO_MAX, type CardView } from '@/card/types';
import { requireSupabase } from '@/lib/supabase';
import { Body, Button, Field, FormError, Heading, Meta } from '@/ui';
import { palette } from '@/theme/palette';
import { radius, space, type } from '@/theme/tokens';

/**
 * The forced first card (design bible §10 step 2).
 *
 * Bio and pronouns are written to the *profile*, not the card: they become the
 * default every later card inherits, and a card only overrides them when the
 * user deliberately makes it say something else.
 *
 * No photo yet — that needs the image picker and a Storage upload, which arrive
 * with the card editor. The empty photo well is drawn hatched rather than blank,
 * so a card without one still reads as finished.
 */
export default function FirstCardScreen() {
	const { session, profile, refresh } = useAuth();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const cardWidth = Math.min(width - space.xl * 2, 300);

	// A fresh card should never look unfinished, so it starts somewhere pleasant
	// rather than on the first value of every enum.
	const [style, setStyle] = useState(() => randomStyle());
	const [pronouns, setPronouns] = useState('');
	const [bio, setBio] = useState('');
	const [label, setLabel] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const view = useMemo<CardView>(
		() => ({
			title: profile?.display_name ?? 'Your name',
			handle: profile?.username ?? 'you',
			pronouns: pronouns.trim() || null,
			bio: bio.trim(),
			label: label.trim() || null,
			art_url: null,
			art_x: 0.5,
			art_y: 0.5,
			art_scale: 1,
			style,
			affiliation: null,
			links: [],
			stickers: []
		}),
		[profile, pronouns, bio, label, style]
	);

	async function create() {
		if (busy || !session) return;
		setBusy(true);
		setError(null);
		try {
			const client = requireSupabase();

			// Profile first: these are the defaults the card will read through.
			const { error: profileError } = await client
				.from('profiles')
				.update({ bio: bio.trim(), pronouns: pronouns.trim() || null })
				.eq('id', session.user.id);
			if (profileError) {
				setError(profileError.hint ?? profileError.message);
				return;
			}

			// cards_autoactivate puts the first card on display, so there is no
			// separate "make this active" step here.
			const { error: cardError } = await client.from('cards').insert({
				owner_id: session.user.id,
				style: styleToJson(style),
				label: label.trim() || null
			});
			if (cardError) {
				setError(cardError.hint ?? cardError.message);
				return;
			}

			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={[
					styles.page,
					{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }
				]}
				keyboardShouldPersistTaps="handled"
			>
				<Heading>Make your card</Heading>
				<Body>This is what people get when they scan you. You can change all of it later.</Body>

				<View style={styles.stage}>
					<StaticCard
						width={cardWidth}
						render={(rx, ry) => (
							<Card
								view={view}
								width={cardWidth}
								foil={foilForTier(0)}
								seed={profile?.username ?? 'new'}
								rx={rx}
								ry={ry}
							/>
						)}
					/>
				</View>

				<FormError message={error} />

				<Field
					label="Pronouns"
					value={pronouns}
					onChangeText={setPronouns}
					placeholder="she/her"
					maxLength={30}
					autoCapitalize="none"
					hint="Optional."
				/>

				<Field
					label="Bio"
					value={bio}
					onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
					placeholder="Seamstress, armour builder, professional gremlin."
					multiline
					numberOfLines={3}
					maxLength={BIO_MAX}
					style={styles.bioInput}
					hint="Optional."
					status={<Text style={styles.count}>{BIO_MAX - bio.length}</Text>}
				/>

				<Field
					label="Card name"
					value={label}
					onChangeText={setLabel}
					placeholder="Cosplay"
					maxLength={24}
					hint="Only you see this — it names the card when you have more than one."
				/>

				<Picker
					label="Edge"
					options={FRAME_KEYS}
					value={style.frame}
					onChange={(frame: FrameKey) => setStyle((s) => ({ ...s, frame }))}
					swatch={(k) => ({ experimental_backgroundImage: FRAMES[k] })}
				/>

				<Picker
					label="Face"
					options={BG_KEYS}
					value={style.bg}
					onChange={(bg: BgKey) => setStyle((s) => ({ ...s, bg }))}
					swatch={(k) => ({ backgroundColor: BGS[k] })}
				/>

				<Picker
					label="Photo shape"
					options={PHOTO_SHAPES}
					value={style.photo_shape}
					onChange={(photo_shape: PhotoShape) => setStyle((s) => ({ ...s, photo_shape }))}
					labelFor={(k) => PHOTO_SHAPE_LABEL[k]}
				/>

				<Button label="That's my card" onPress={create} busy={busy} />
				<Meta>Step 2 of 2 · a photo comes with the card editor</Meta>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

/** A labelled row of choices. Colour axes show a swatch; the rest show words. */
function Picker<T extends string>({
	label,
	options,
	value,
	onChange,
	swatch,
	labelFor
}: {
	label: string;
	options: readonly T[];
	value: T;
	onChange: (next: T) => void;
	swatch?: (key: T) => object;
	labelFor?: (key: T) => string;
}) {
	return (
		<View style={styles.picker}>
			<Text style={styles.pickerLabel}>{label}</Text>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.pickerRow}>
					{options.map((opt) => {
						const on = opt === value;
						return (
							<Pressable
								key={opt}
								onPress={() => onChange(opt)}
								accessibilityRole="radio"
								accessibilityState={{ selected: on }}
								accessibilityLabel={labelFor?.(opt) ?? opt}
								style={[
									swatch ? styles.swatch : styles.word,
									on && (swatch ? styles.swatchOn : styles.wordOn)
								]}
							>
								{swatch ? (
									<View style={[styles.swatchFill, swatch(opt)]} />
								) : (
									<Text style={[styles.wordText, on && styles.wordTextOn]}>
										{labelFor?.(opt) ?? opt}
									</Text>
								)}
							</Pressable>
						);
					})}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	page: { paddingHorizontal: space.xl, gap: space.md },
	stage: { alignItems: 'center', paddingVertical: space.md },
	bioInput: { minHeight: 84, paddingTop: space.md, textAlignVertical: 'top' },
	count: { ...type.meta, color: palette.creamFaint },
	picker: { gap: space.xs },
	pickerLabel: { ...type.meta, color: palette.creamMute },
	pickerRow: { flexDirection: 'row', gap: space.sm, paddingVertical: 2 },
	swatch: {
		width: 40,
		height: 40,
		borderRadius: radius.sm,
		padding: 3,
		borderWidth: 2,
		borderColor: 'transparent'
	},
	swatchOn: { borderColor: palette.teal },
	swatchFill: { flex: 1, borderRadius: radius.sm - 3 },
	word: {
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		backgroundColor: palette.raisedHigh,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line
	},
	wordOn: { backgroundColor: palette.teal, borderColor: palette.teal },
	wordText: { ...type.small, color: palette.creamMute },
	wordTextOn: { color: palette.void, fontFamily: 'SpaceGrotesk-Bold' }
});
