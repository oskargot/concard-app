/**
 * collect_card() raises with a machine-readable message and a human hint.
 *
 * Ported verbatim from the web app (`concard/src/lib/collect.ts`) so the two
 * clients agree on what each error code means and how long a cooldown lasts.
 */

export type CollectErrorCode =
	| 'not_authenticated'
	| 'profile_not_found'
	| 'cannot_collect_self'
	| 'no_active_card'
	| 'cooldown'
	| 'unknown';

export interface CollectError {
	code: CollectErrorCode;
	hint: string;
	/** ISO timestamp after which collecting is allowed again (cooldown only). */
	retryAt: string | null;
}

const KNOWN: CollectErrorCode[] = [
	'not_authenticated',
	'profile_not_found',
	'cannot_collect_self',
	'no_active_card',
	'cooldown'
];

export function parseCollectError(err: {
	message?: string;
	hint?: string | null;
	details?: string | null;
}): CollectError {
	const code = KNOWN.find((k) => k === err.message) ?? 'unknown';
	return {
		code,
		hint: err.hint || (code === 'unknown' ? 'Something went wrong. Try again.' : ''),
		retryAt: code === 'cooldown' && err.details ? new Date(err.details).toISOString() : null
	};
}

/** Milliseconds between two collects of the same person; mirrors collect_cooldown() in SQL. */
export const COLLECT_COOLDOWN_MS = 72 * 60 * 60 * 1000;

export function formatRetryIn(retryAt: string, now = Date.now()): string {
	const ms = new Date(retryAt).getTime() - now;
	if (ms <= 0) return 'now';
	const hours = Math.ceil(ms / (60 * 60 * 1000));
	if (hours < 1) return 'less than an hour';
	if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
	const days = Math.ceil(hours / 24);
	return `${days} day${days === 1 ? '' : 's'}`;
}
