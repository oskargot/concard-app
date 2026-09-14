import { useState } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Body, Button, Field, FormError, Meta } from '@/ui';
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';

/** Email and password, per design bible §10. The same screen does both, because
 *  at a con someone is being handed a phone and told "make one" — a separate
 *  sign-up page is one more thing to find. */
export default function LoginScreen() {
	const { signIn, signUp } = useAuth();
	const insets = useSafeAreaInsets();

	const [mode, setMode] = useState<'in' | 'up'>('in');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const signingUp = mode === 'up';

	// Supabase enforces this too, but a message under the field beats a round trip.
	const passwordTooShort = signingUp && password.length > 0 && password.length < 6;
	const canSubmit = email.includes('@') && password.length >= 6 && !busy;

	async function submit() {
		if (!canSubmit) return;
		setBusy(true);
		setError(null);
		setNotice(null);
		try {
			if (signingUp) {
				const { needsConfirmation } = await signUp(email, password);
				if (needsConfirmation) {
					setNotice('Check your email for a confirmation link, then come back and sign in.');
					setMode('in');
				}
				// with confirmation off, the session arrives and the gate moves us on
			} else {
				await signIn(email, password);
			}
		} catch (e) {
			setError(messageFor(e, signingUp));
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
					<Text style={styles.wordmark}>Concard</Text>
					<Body>
						{signingUp
							? 'Make a card, then collect everyone you meet.'
							: 'Welcome back. Your binder is waiting.'}
					</Body>
				</View>

				<FormError message={error} />
				{notice ? (
					<View style={styles.notice} accessibilityLiveRegion="polite">
						<Text style={styles.noticeText}>{notice}</Text>
					</View>
				) : null}

				<Field
					label="Email"
					value={email}
					onChangeText={setEmail}
					autoCapitalize="none"
					autoComplete="email"
					keyboardType="email-address"
					textContentType="emailAddress"
					placeholder="you@example.com"
					returnKeyType="next"
				/>

				<Field
					label="Password"
					value={password}
					onChangeText={setPassword}
					secureTextEntry
					autoCapitalize="none"
					autoComplete={signingUp ? 'new-password' : 'current-password'}
					textContentType={signingUp ? 'newPassword' : 'password'}
					placeholder="••••••••"
					returnKeyType="go"
					onSubmitEditing={submit}
					error={passwordTooShort ? 'At least 6 characters.' : null}
					hint={signingUp && !passwordTooShort ? 'At least 6 characters.' : null}
				/>

				<Button
					label={signingUp ? 'Create account' : 'Sign in'}
					onPress={submit}
					disabled={!canSubmit}
					busy={busy}
				/>

				<Pressable
					onPress={() => {
						setMode(signingUp ? 'in' : 'up');
						setError(null);
						setNotice(null);
					}}
					style={styles.switch}
					accessibilityRole="button"
				>
					<Text style={styles.switchText}>
						{signingUp ? 'Already have an account? Sign in' : 'New here? Make an account'}
					</Text>
				</Pressable>

				<Meta>Concard · concard.me</Meta>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

/** Supabase's auth errors are terse and sometimes misleading; say the useful thing. */
function messageFor(e: unknown, signingUp: boolean): string {
	const raw = e instanceof Error ? e.message : String(e);
	const lower = raw.toLowerCase();
	if (lower.includes('invalid login credentials')) {
		return 'That email and password do not match an account.';
	}
	if (lower.includes('already registered') || lower.includes('already been registered')) {
		return 'There is already an account with that email. Try signing in.';
	}
	if (lower.includes('email not confirmed')) {
		return 'Confirm your email first — check for the link we sent.';
	}
	if (lower.includes('network') || lower.includes('fetch')) {
		return 'Could not reach Concard. Check your connection and try again.';
	}
	return signingUp ? `Could not create the account: ${raw}` : raw;
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	page: { paddingHorizontal: space.xl, gap: space.lg, justifyContent: 'center', flexGrow: 1 },
	header: { gap: space.sm, paddingBottom: space.sm },
	wordmark: { ...type.hero, color: palette.rose },
	switch: { alignItems: 'center', paddingVertical: space.sm },
	switchText: { ...type.small, color: palette.teal },
	notice: {
		backgroundColor: 'rgba(69, 229, 213, 0.12)',
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.teal,
		padding: space.md
	},
	noticeText: { ...type.small, color: palette.cream }
});
