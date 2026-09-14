/**
 * Supabase connection settings.
 *
 * Mirrors the web app's `src/lib/supabase/env.ts`, including its behaviour when
 * nothing is configured: name what is missing rather than crashing on every
 * screen. `EXPO_PUBLIC_` is the prefix Expo inlines into the bundle.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Public origin for QR codes and share links. The QR encodes
 * `<origin>/<username>` (design bible §4), so this has to match the deployed
 * site or scanning a code would open the wrong host.
 */
export const SITE_ORIGIN = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://concard.me').replace(
	/\/$/,
	''
);

/** Hosts a scanned QR may point at. localhost is here so a dev build can scan
 *  codes produced by a local web app. */
export const ALLOWED_QR_HOSTS = [
	new URL(SITE_ORIGIN).hostname,
	'concard.me',
	'www.concard.me',
	'localhost'
];

/** Names of the required public variables that are not set. */
export function missingSupabaseEnv(): string[] {
	const missing: string[] = [];
	if (!SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
	if (!SUPABASE_KEY) missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
	return missing;
}

export const isConfigured = () => missingSupabaseEnv().length === 0;
