import { useEffect, useRef, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { SITE_ORIGIN } from '@/lib/env';
import { requireSupabase } from '@/lib/supabase';
import { isValidUsername, normalizeUsername, profileUrl } from '@/lib/username';
import { Body, Button, Field, FormError, Heading, Meta } from '@/ui';
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid';

/** How long to wait after the last keystroke before asking the server. */
const DEBOUNCE_MS = 350;

/**
 * Claim a username (design bible §10 step 2).
 *
 * The username is per user rather than per card, globally unique, and is what
 * the QR encodes — so it is worth showing the resulting `concard.me/name` while
 * they type, and worth checking availability live rather than failing on submit.
 */
export default function OnboardingScreen() {
	const { session, refresh } = useAuth();
	const insets = useSafeAreaInsets();

	const [username, setUsername] = useState('');
	const [displayName, setDisplayName] = useState('');
	/** The last verdict the server gave, tagged with the name it was about. */
	const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const normalized = normalizeUsername(username);
	const valid = isValidUsername(normalized);

	/**
	 * Everything except the server's answer is derived rather than stored, so
	 * typing can never leave the mark showing a verdict about an older name.
	 */
	const availability: Availability = !normalized
		? 'idle'
		: !valid
			? 'invalid'
			: checked?.name === normalized
				? checked.free
					? 'free'
					: 'taken'
				: 'checking';

	// Only the newest check may write state: a slow response for an old value
	// would otherwise land after a newer one and show the wrong verdict.
	const checkId = useRef(0);

	useEffect(() => {
		if (!normalized || !valid) return;

		const id = ++checkId.current;
		const timer = setTimeout(async () => {
			try {
				const { data, error: rpcError } = await requireSupabase().rpc('is_username_available', {
					candidate: normalized
				});
				if (checkId.current !== id) return;
				// A failed check must not read as "taken": leaving the verdict unset
				// keeps the mark on "checking" and still lets them submit, where the
				// unique constraint is the real arbiter.
				if (rpcError) return;
				setChecked({ name: normalized, free: !!data });
			} catch {
				/* offline or unreachable — as above, submitting decides */
			}
		}, DEBOUNCE_MS);

		return () => clearTimeout(timer);
	}, [normalized, valid]);

	const canSubmit = valid && availability !== 'taken' && availability !== 'checking' && !busy;

	async function claim() {
		if (!canSubmit || !session) return;
		setBusy(true);
		setError(null);
		try {
			const { error: insertError } = await requireSupabase()
				.from('profiles')
				.insert({
					id: session.user.id,
					username: normalized,
					// the database requires a display name; the username is a
					// reasonable stand-in and the card editor can change it
					display_name: displayName.trim() || normalized
				});
			if (insertError) {
				// 23505 is a unique violation: someone claimed it in the gap
				setError(
					insertError.code === '23505'
						? 'That username was just taken. Try another.'
						: (insertError.hint ?? insertError.message)
				);
				setChecked({ name: normalized, free: false });
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
					{ paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl }
				]}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.header}>
					<Heading>Pick your handle</Heading>
					<Body>
						This is what your QR code points at, and it cannot be changed later. Choose something
						you will still like on a badge.
					</Body>
				</View>

				<FormError message={error} />

				<Field
					label="Username"
					value={username}
					onChangeText={setUsername}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="username"
					placeholder="jadeo"
					maxLength={20}
					returnKeyType="next"
					error={availability === 'invalid' && normalized.length >= 3 ? INVALID_HINT : null}
					hint={availability === 'invalid' ? null : INVALID_HINT}
					status={<AvailabilityMark state={availability} />}
				/>

				{valid ? (
					<Text style={styles.preview} numberOfLines={1}>
						{profileUrl(SITE_ORIGIN, normalized).replace(/^https?:\/\//, '')}
					</Text>
				) : null}

				<Field
					label="Display name"
					value={displayName}
					onChangeText={setDisplayName}
					placeholder={normalized || 'Jade Okonkwo'}
					maxLength={40}
					returnKeyType="go"
					onSubmitEditing={claim}
					hint="The name on your card. You can change this any time."
				/>

				<Button label="Claim it" onPress={claim} disabled={!canSubmit} busy={busy} />
				<Meta>Step 1 of 2</Meta>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const INVALID_HINT = '3–20 characters: lowercase letters, numbers and underscores.';

function AvailabilityMark({ state }: { state: Availability }) {
	if (state === 'checking') return <ActivityIndicator size="small" color={palette.creamFaint} />;
	if (state === 'free') return <Text style={[styles.mark, styles.markFree]}>available</Text>;
	if (state === 'taken') return <Text style={[styles.mark, styles.markTaken]}>taken</Text>;
	return null;
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	page: { paddingHorizontal: space.xl, gap: space.lg, justifyContent: 'center', flexGrow: 1 },
	header: { gap: space.sm },
	preview: { ...type.small, color: palette.teal, marginTop: -space.sm },
	mark: { ...type.meta },
	markFree: { color: palette.success },
	markTaken: { color: palette.danger }
});
