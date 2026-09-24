/**
 * Fandoms as the affiliation picker sees them, and submitting new ones
 * (HANDOFF §1.2, §2.4).
 *
 * A submitted fandom is `pending` until Oskar approves it in the dashboard;
 * until then only its submitter sees it, as "In review", and it can't go on a
 * card. The database is what enforces every rule here — `submit_fandom()`
 * trims the name, caps it at 24 characters, refuses duplicates and a fourth
 * pending submission — so the client-side checks are for quick feedback only.
 */

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { LocalFandomSubmission } from '@/store/useConcardStore';
import { styleCategoryForFandom, slugifyFandomLabel } from './fandom-styles';
import { LOCAL_FANDOMS } from './local-catalog';
import { FANDOM_STYLE_CATEGORIES, type FandomStyleCategory } from './types';

export type FandomRow = Database['public']['Tables']['fandoms']['Row'];

/** Where the generative renderer stops holding its type size (see the
 *  `fandoms_name_shape` check in migration 20260924000002). */
export const FANDOM_NAME_MAX = 24;
/** Submissions one person may have waiting at once (`fandom_pending_cap()`). */
export const FANDOM_PENDING_MAX = 3;

/** Trimmed, with runs of spaces collapsed — exactly what the server stores. */
export function normalizeFandomName(name: string): string {
	return name.replace(/\s+/g, ' ').trim();
}

/** The fandom's own style category if it has one, else the renderer's guess. */
export function styleCategoryOf(fandom: {
	id: string;
	name: string;
	style_category?: string | null;
}): FandomStyleCategory {
	return FANDOM_STYLE_CATEGORIES.includes(fandom.style_category as FandomStyleCategory)
		? (fandom.style_category as FandomStyleCategory)
		: styleCategoryForFandom(fandom);
}

/** Rows from before the submissions migration have no status: all approved. */
export function fandomStatus(fandom: Partial<FandomRow>): 'pending' | 'approved' | 'rejected' {
	return (fandom.status as 'pending' | 'approved' | 'rejected' | undefined) ?? 'approved';
}

/** The picker's list on this device: the live fandoms, then local submissions. */
export function localFandomRows(submissions: LocalFandomSubmission[]): FandomRow[] {
	const row = (f: {
		id: string;
		name: string;
		style_category: FandomStyleCategory;
		sort_order: number;
	}): FandomRow => ({
		id: f.id,
		name: f.name,
		mark: f.name.slice(0, 3).toUpperCase(),
		color_a: '#b9c9ff',
		color_b: '#b9c9ff',
		sort_order: f.sort_order,
		is_active: true,
		status: 'approved',
		submitted_by: null,
		style_category: f.style_category,
		created_at: '',
		reviewed_at: null
	});
	return [
		...LOCAL_FANDOMS.map(row),
		...submissions.map((s) => ({ ...row({ ...s, sort_order: 1000 }), status: 'pending' as const }))
	];
}

export interface SubmittedFandom {
	id: string;
	name: string;
	style_category: FandomStyleCategory;
}

/** Sends a new fandom for review. Throws with a sentence a person can read. */
export async function submitFandom(rawName: string): Promise<SubmittedFandom> {
	const name = normalizeFandomName(rawName);
	if (!name) throw new Error('Type the fandom’s name first.');
	if (name.length > FANDOM_NAME_MAX) {
		throw new Error(`Fandom names are ${FANDOM_NAME_MAX} characters at most.`);
	}
	const style = styleCategoryForFandom({ id: slugifyFandomLabel(name), name });
	if (!supabase) throw new Error('offline');
	const { data, error } = await supabase.rpc('submit_fandom', {
		p_name: name,
		p_style_category: style
	});
	if (error) throw new Error(error.hint ?? error.message);
	const result = data as { id: string; name: string; style_category?: string };
	return { id: result.id, name: result.name, style_category: styleCategoryOf(result) };
}
