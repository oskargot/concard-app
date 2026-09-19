/**
 * Session and profile state for the whole app.
 *
 * Signing up leaves a user in one of three states, and the difference drives
 * every route guard (design bible §10 makes the last two mandatory before the
 * app is usable):
 *
 *   1. no session                      → sign in
 *   2. session, no profile row         → claim a username
 *   3. session, profile, no card       → make the first card
 *
 * `status` collapses those into one value so guards never have to reason about
 * three nullable fields, and `loading` is separate so a cold start does not flash
 * the sign-in screen at someone who is already signed in.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react';
import type { Session } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import { bindAutoRefresh, supabase } from '../lib/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

export type AuthStatus = 'unconfigured' | 'signed-out' | 'needs-username' | 'needs-card' | 'ready';

export interface AuthState {
	loading: boolean;
	status: AuthStatus;
	session: Session | null;
	profile: Profile | null;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
	signOut: () => Promise<void>;
	/** Re-read the profile after claiming a username or creating a card. */
	refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string | null): Promise<Profile | null> {
	if (!supabase || !userId) return null;
	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', userId)
		.maybeSingle();
	// A profile that does not exist yet is the expected "needs-username" case,
	// not a failure worth surfacing.
	if (error) console.warn('concard: could not load profile', error.message);
	return data ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
	// With no client there is nothing to load, so this starts settled rather than
	// having an effect immediately switch it off.
	const [loading, setLoading] = useState(() => !!supabase);
	const [session, setSession] = useState<Session | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	// Identifies the user whose profile request has settled. This keeps the gate
	// on its loading screen between receiving a session and loading that user's
	// profile, without making a Supabase call inside onAuthStateChange.
	const [profileFor, setProfileFor] = useState<string | null>(null);
	const profileRequest = useRef(0);

	const loadProfile = useCallback(async (userId: string | null) => {
		const request = ++profileRequest.current;
		const nextProfile = await fetchProfile(userId);
		if (request !== profileRequest.current) return;
		setProfileFor(userId);
		setProfile(nextProfile);
	}, []);

	useEffect(() => {
		if (!supabase) return;
		bindAutoRefresh();

		let active = true;
		supabase.auth.getSession().then(({ data, error }) => {
			if (!active) return;
			if (error) console.warn('concard: could not restore session', error.message);
			setSession(data.session);
			setLoading(false);
		});

		const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
			if (!active) return;
			// Supabase warns that awaiting another client call in this callback can
			// deadlock. Profile loading happens in the effect below instead.
			setSession(next);
			setLoading(false);
		});

		return () => {
			active = false;
			sub.subscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		const userId = session?.user.id ?? null;
		const request = ++profileRequest.current;
		void fetchProfile(userId).then((nextProfile) => {
			if (request !== profileRequest.current) return;
			setProfileFor(userId);
			setProfile(nextProfile);
		});
	}, [session?.user.id]);

	const refresh = useCallback(() => loadProfile(session?.user.id ?? null), [loadProfile, session]);

	const signIn = useCallback(async (email: string, password: string) => {
		const client = supabase;
		if (!client) throw new Error('Supabase is not configured.');
		const { error } = await client.auth.signInWithPassword({
			email: email.trim(),
			password
		});
		if (error) throw error;
	}, []);

	const signUp = useCallback(async (email: string, password: string) => {
		const client = supabase;
		if (!client) throw new Error('Supabase is not configured.');
		const { data, error } = await client.auth.signUp({ email: email.trim(), password });
		if (error) throw error;
		// With email confirmation on, signUp returns a user but no session, and
		// nothing more can happen until they click the link.
		return { needsConfirmation: !data.session };
	}, []);

	const signOut = useCallback(async () => {
		if (!supabase) return;
		const { error } = await supabase.auth.signOut();
		if (error) throw error;
	}, []);

	const status: AuthStatus = useMemo(() => {
		if (!supabase) return 'unconfigured';
		if (!session) return 'signed-out';
		if (!profile) return 'needs-username';
		if (!profile.active_card_id) return 'needs-card';
		return 'ready';
	}, [session, profile]);

	const isLoading = loading || (!!session && profileFor !== session.user.id);

	const value = useMemo<AuthState>(
		() => ({ loading: isLoading, status, session, profile, signIn, signUp, signOut, refresh }),
		[isLoading, status, session, profile, signIn, signUp, signOut, refresh]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
	return ctx;
}
