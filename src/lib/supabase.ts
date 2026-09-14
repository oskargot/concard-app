/**
 * The Supabase client.
 *
 * Three settings matter on React Native and none of them are the default:
 *
 *  - `storage: AsyncStorage` — there is no browser to hold a cookie, so the
 *    session is persisted to the device instead.
 *  - `detectSessionInUrl: false` — that option exists for OAuth redirects
 *    landing back on a web page. There is no URL bar here, and leaving it on
 *    makes the client parse deep links it has no business touching, which
 *    matters because Concard's deep links are `/username` collection links.
 *  - an AppState listener for `autoRefreshToken` — a backgrounded app has its
 *    timers suspended, so without this a token quietly expires while the phone
 *    is in someone's pocket and the next request 401s.
 *
 * `react-native-url-polyfill` has to be imported before the client: supabase-js
 * builds request URLs with `URL`, which Hermes does not implement completely.
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';
import { SUPABASE_KEY, SUPABASE_URL, isConfigured } from './env';

export type Client = SupabaseClient<Database>;

/**
 * Null when the app has no Supabase configuration. Every caller has to handle
 * that anyway — the alternative is throwing at module load, which would blank
 * the app before it can say what is wrong.
 */
export const supabase: Client | null = isConfigured()
	? createClient<Database>(SUPABASE_URL!, SUPABASE_KEY!, {
			auth: {
				storage: AsyncStorage,
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: false
			}
		})
	: null;

/** Throws rather than returning null, for call sites already behind the guard. */
export function requireSupabase(): Client {
	if (!supabase) {
		throw new Error(
			'Supabase is not configured. Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
		);
	}
	return supabase;
}

let appStateBound = false;

/** Keep tokens fresh across backgrounding. Safe to call more than once. */
export function bindAutoRefresh() {
	if (appStateBound || !supabase) return;
	appStateBound = true;
	AppState.addEventListener('change', (state) => {
		if (state === 'active') supabase.auth.startAutoRefresh();
		else supabase.auth.stopAutoRefresh();
	});
}
