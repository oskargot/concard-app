/**
 * Username rules and QR payload parsing.
 *
 * Ported verbatim from the web app (`concard/src/lib/username.ts`): the rules
 * mirror a database check constraint, so the two clients must not disagree about
 * what is valid. `usernameFromScan` is what the Phase 5 scanner will use.
 */

/** Mirrors the profiles_username_format check constraint in the database. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_]{2,19}$/;

export function normalizeUsername(input: string): string {
	return input.trim().toLowerCase();
}

export function isValidUsername(input: string): boolean {
	return USERNAME_PATTERN.test(input);
}

/** Absolute URL that a user's QR code encodes. */
export function profileUrl(origin: string, username: string): string {
	return `${origin.replace(/\/$/, '')}/${username}`;
}

/**
 * Pull a username out of a scanned QR payload. Accepts full concard URLs on any
 * of the given hosts, and bare usernames as a convenience. Returns null when the
 * payload is not a concard code.
 */
export function usernameFromScan(payload: string, allowedHosts: string[]): string | null {
	const text = payload.trim();
	if (isValidUsername(text)) return text;

	let url: URL;
	try {
		url = new URL(text);
	} catch {
		return null;
	}
	const hosts = allowedHosts.map((h) => h.toLowerCase());
	if (!hosts.includes(url.hostname.toLowerCase())) return null;

	const segments = url.pathname.split('/').filter(Boolean);
	if (segments.length !== 1) return null;
	const candidate = normalizeUsername(decodeURIComponent(segments[0]));
	return isValidUsername(candidate) ? candidate : null;
}
