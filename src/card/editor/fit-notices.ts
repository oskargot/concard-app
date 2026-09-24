/**
 * What the editor should say about text that doesn't fully fit on the card.
 *
 * The card never clips silently (spec §3.1, §3.4, §6): a cut name, a truncated
 * pronoun pill, a hidden bio or a bio's hidden last lines all come back here as
 * a sentence the editor shows under the card. Link handles are reported beside
 * their own rows in `LinkRows` instead.
 *
 * Everything is read off the same `FrontLayout` the card draws, so a notice can
 * never disagree with what is on the card.
 */

import type { FrontLayout } from '../layout/front';

export interface FitNotice {
	key: string;
	text: string;
}

export function fitNotices(layout: FrontLayout, hasLinks: boolean): FitNotice[] {
	const out: FitNotice[] = [];

	if (layout.name.truncated) {
		out.push({ key: 'name', text: `Your name shows as “${layout.name.text}” on the card.` });
	}

	if (layout.pill?.truncated) {
		out.push({ key: 'pronouns', text: `Pronouns show as “${layout.pill.text}”.` });
	} else if (layout.pillHidden) {
		out.push({ key: 'pronouns', text: 'No room for pronouns beside your username.' });
	}

	if (layout.bioHidden) {
		out.push({
			key: 'bio',
			text: hasLinks
				? 'Your bio is hidden: the photo and links leave it no room. It’s kept — drag the divider up to show it.'
				: 'Your bio is hidden behind the photo. It’s kept — drag the divider up to show it.'
		});
	} else if (layout.bio && layout.bio.hiddenLines > 0) {
		const n = layout.bio.hiddenLines;
		out.push({
			key: 'bio',
			text:
				n === 1
					? 'Last line of your bio is hidden. Drag the divider up, or shorten it.'
					: `Last ${n} lines of your bio are hidden. Drag the divider up, or shorten it.`
		});
	}

	return out;
}
