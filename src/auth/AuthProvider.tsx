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

export function AuthProvider({ children }: { children: ReactNode }) {
	// With no client there is nothing to load, so this starts settled rather than
	// having an effect immediately switch it off.
	const [loading, setLoading] = useState(() => !!supabase);
	const [session, setSession] = useState<Session | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	// Guards against a late response from a previous user overwriting the current
	// one — sign out and straight back in as someone else would otherwise race.
	const loadedFor = useRef<string | null>(null);

	const loadProfile = useCallback(async (userId: string | null) => {
		if (!supabase || !userId) {
			setProfile(null);
			loadedFor.current = null;
			return;
		}
		loadedFor.current = userId;
		const { data, error } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', userId)
			.maybeSingle();
		// a profile that does not exist yet is the expected "needs-username" case,
		// not a failure worth surfacing
		if (error) console.warn('concard: could not load profile', error.message);
		if (loadedFor.current === userId) setProfile(data ?? null);
	}, []);

	useEffect(() => {
		if (!supabase) return;
		bindAutoRefresh();

		let active = true;
		supabase.auth.getSession().then(async ({ data }) => {
			if (!active) return;
			setSession(data.session);
			await loadProfile(data.session?.user.id ?? null);
			if (active) setLoading(false);
		});

		const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
			setSession(next);
			await loadProfile(next?.user.id ?? null);
			setLoading(false);
		});

		return () => {
			active = false;
			sub.subscription.unsubscribe();
		};
	}, [loadProfile]);

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
		await supabase.auth.signOut();
	}, []);

	const status: AuthStatus = useMemo(() => {
		// The prototype is deliberately explorable without credentials. Screens
		// use persisted fixture data and swap to this same API when configured.
		if (!supabase) return 'ready';
		if (!session) return 'signed-out';
		if (!profile) return 'needs-username';
		if (!profile.active_card_id) return 'needs-card';
		return 'ready';
	}, [session, profile]);

	const value = useMemo<AuthState>(
		() => ({ loading, status, session, profile, signIn, signUp, signOut, refresh }),
		[loading, status, session, profile, signIn, signUp, signOut, refresh]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
	return ctx;
}
