/**
 * What a pasted link is: its platform, its icon, and the handle to show.
 *
 * Card spec §3.5. The URL is the only thing a user has to give. The domain
 * picks the icon, so there is no "choose your platform" step, and for known
 * platforms the handle is read out of the URL path and pre-filled into an
 * editable field. Handles keep each platform's own convention — `@name` where
 * the platform uses @, bare where it doesn't — rather than being normalised.
 * An unknown domain gets the globe and the domain itself as its handle.
 *
 * No React Native imports: the web card derives the same icon from the same
 * url, and the icon is never stored.
 */

import { LINK_ICONS } from './link-icons';

/** The icon key for an unknown domain. */
export const GLOBE = 'globe';

/**
 * The globe, from Lucide (ISC), drawn as a 2-unit stroke in a 24 × 24 box —
 * Simple Icons has no generic mark.
 */
export const GLOBE_PATHS = [
	'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20',
	'M12 2a14.5 14.5 0 0 0 0 20a14.5 14.5 0 0 0 0-20',
	'M2 12h20'
] as const;

export interface LinkInfo {
	/** Icon key in `LINK_ICONS`, or `GLOBE`. */
	icon: string;
	/** Platform name for accessibility labels; the domain when unknown. */
	title: string;
	/** Pre-fill for the handle field. Never empty for a parseable url. */
	handle: string;
	/** True when the platform was recognised. */
	known: boolean;
}

interface ParsedUrl {
	host: string;
	segments: string[];
}

/** Split without `URL`, so this runs the same under Hermes, Node and a browser. */
export function parseUrl(raw: string): ParsedUrl | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/?#\s]+)([^?#\s]*)/i.exec(trimmed);
	if (!m) return null;
	const host = m[1]
		.toLowerCase()
		.replace(/^[^@]*@/, '') // userinfo
		.replace(/:\d+$/, '') // port
		.replace(/^(www|m|mobile)\./, '');
	if (!host.includes('.')) return null;
	const segments = m[2]
		.split('/')
		.filter(Boolean)
		.map((s) => {
			try {
				return decodeURIComponent(s);
			} catch {
				return s;
			}
		});
	return { host, segments };
}

type Rule = {
	icon: string | null;
	title: string;
	/** Exact hosts, or `*.domain` for a subdomain-per-user platform. */
	hosts: string[];
	handle: (p: ParsedUrl, sub: string | null) => string | null;
};

const at = (s: string | undefined | null) => (s ? `@${s.replace(/^@+/, '')}` : null);
const bare = (s: string | undefined | null) => (s ? s.replace(/^@+/, '') : null);
/** The first segment, unless it is one of the platform's own non-profile routes. */
const first = (p: ParsedUrl, reserved: string[] = []) => {
	const s = p.segments[0];
	return s && !reserved.includes(s.toLowerCase()) ? s : null;
};
const after = (p: ParsedUrl, key: string) => {
	const i = p.segments.findIndex((s) => s.toLowerCase() === key);
	return i >= 0 ? (p.segments[i + 1] ?? null) : null;
};

const RULES: Rule[] = [
	{
		icon: 'instagram',
		title: 'Instagram',
		hosts: ['instagram.com', 'instagr.am'],
		handle: (p) => at(first(p, ['p', 'reel', 'reels', 'stories', 'explore']))
	},
	{
		icon: 'x',
		title: 'X',
		hosts: ['x.com', 'twitter.com'],
		handle: (p) => at(first(p, ['i', 'home', 'intent', 'search', 'hashtag']))
	},
	{
		icon: 'tiktok',
		title: 'TikTok',
		hosts: ['tiktok.com'],
		handle: (p) => at(p.segments.find((s) => s.startsWith('@')) ?? null)
	},
	{
		icon: 'threads',
		title: 'Threads',
		hosts: ['threads.net', 'threads.com'],
		handle: (p) => at(first(p))
	},
	{
		icon: 'bluesky',
		title: 'Bluesky',
		hosts: ['bsky.app'],
		handle: (p) => at(after(p, 'profile'))
	},
	{
		icon: 'youtube',
		title: 'YouTube',
		hosts: ['youtube.com'],
		handle: (p) => {
			const s = p.segments[0];
			if (s?.startsWith('@')) return s;
			return bare(after(p, 'c') ?? after(p, 'user') ?? after(p, 'channel'));
		}
	},
	{ icon: 'twitch', title: 'Twitch', hosts: ['twitch.tv'], handle: (p) => bare(first(p)) },
	{ icon: 'kick', title: 'Kick', hosts: ['kick.com'], handle: (p) => bare(first(p)) },
	{ icon: 'github', title: 'GitHub', hosts: ['github.com'], handle: (p) => bare(first(p)) },
	{ icon: 'itchio', title: 'itch.io', hosts: ['*.itch.io'], handle: (_p, sub) => sub },
	{
		icon: 'tumblr',
		title: 'Tumblr',
		hosts: ['*.tumblr.com', 'tumblr.com'],
		handle: (p, sub) => sub ?? bare(after(p, 'blog') ?? first(p))
	},
	{
		icon: 'deviantart',
		title: 'DeviantArt',
		hosts: ['*.deviantart.com', 'deviantart.com'],
		handle: (p, sub) => sub ?? bare(first(p))
	},
	{
		icon: 'artstation',
		title: 'ArtStation',
		hosts: ['artstation.com'],
		handle: (p) => bare(first(p, ['artwork']))
	},
	{ icon: 'behance', title: 'Behance', hosts: ['behance.net'], handle: (p) => bare(first(p)) },
	{ icon: 'dribbble', title: 'Dribbble', hosts: ['dribbble.com'], handle: (p) => bare(first(p)) },
	{
		icon: 'facebook',
		title: 'Facebook',
		hosts: ['facebook.com', 'fb.com'],
		handle: (p) => bare(first(p, ['profile.php', 'people', 'groups']))
	},
	{
		icon: 'reddit',
		title: 'Reddit',
		hosts: ['reddit.com', 'old.reddit.com'],
		handle: (p) => {
			const u = after(p, 'u') ?? after(p, 'user');
			if (u) return `u/${u}`;
			const r = after(p, 'r');
			return r ? `r/${r}` : null;
		}
	},
	{
		icon: 'discord',
		title: 'Discord',
		hosts: ['discord.gg', 'discord.com'],
		handle: (p) => {
			const code = p.host === 'discord.gg' ? first(p) : after(p, 'invite');
			return code ? `discord.gg/${code}` : null;
		}
	},
	{
		icon: 'patreon',
		title: 'Patreon',
		hosts: ['patreon.com'],
		handle: (p) => bare(after(p, 'c') ?? first(p))
	},
	{ icon: 'kofi', title: 'Ko-fi', hosts: ['ko-fi.com'], handle: (p) => bare(first(p)) },
	{
		icon: 'buymeacoffee',
		title: 'Buy Me a Coffee',
		hosts: ['buymeacoffee.com'],
		handle: (p) => bare(first(p))
	},
	{
		icon: 'gumroad',
		title: 'Gumroad',
		hosts: ['*.gumroad.com', 'gumroad.com'],
		handle: (p, sub) => sub ?? bare(first(p))
	},
	{
		icon: 'etsy',
		title: 'Etsy',
		hosts: ['etsy.com', '*.etsy.com'],
		handle: (p, sub) => bare(after(p, 'shop')) ?? sub
	},
	{
		icon: 'kickstarter',
		title: 'Kickstarter',
		hosts: ['kickstarter.com'],
		handle: (p) => bare(after(p, 'profile'))
	},
	{
		icon: 'soundcloud',
		title: 'SoundCloud',
		hosts: ['soundcloud.com'],
		handle: (p) => bare(first(p))
	},
	{ icon: 'spotify', title: 'Spotify', hosts: ['open.spotify.com'], handle: () => null },
	{ icon: 'bandcamp', title: 'Bandcamp', hosts: ['*.bandcamp.com'], handle: (_p, sub) => sub },
	{ icon: 'applemusic', title: 'Apple Music', hosts: ['music.apple.com'], handle: () => null },
	{ icon: 'vimeo', title: 'Vimeo', hosts: ['vimeo.com'], handle: (p) => bare(first(p)) },
	{ icon: 'pixiv', title: 'pixiv', hosts: ['pixiv.net'], handle: (p) => bare(after(p, 'users')) },
	{ icon: 'linktree', title: 'Linktree', hosts: ['linktr.ee'], handle: (p) => bare(first(p)) },
	{ icon: 'carrd', title: 'Carrd', hosts: ['*.carrd.co'], handle: (_p, sub) => sub },
	{
		icon: 'substack',
		title: 'Substack',
		hosts: ['*.substack.com', 'substack.com'],
		handle: (p, sub) => sub ?? at(p.segments.find((s) => s.startsWith('@')) ?? null)
	},
	{
		icon: 'pinterest',
		title: 'Pinterest',
		hosts: ['pinterest.com', 'pinterest.co.uk', 'pinterest.ca', 'pinterest.com.au', 'pin.it'],
		handle: (p) => bare(first(p, ['pin']))
	},
	{
		icon: 'snapchat',
		title: 'Snapchat',
		hosts: ['snapchat.com'],
		handle: (p) => bare(after(p, 'add'))
	},
	{
		icon: 'telegram',
		title: 'Telegram',
		hosts: ['t.me', 'telegram.me'],
		handle: (p) => at(first(p))
	},
	{ icon: 'whatsapp', title: 'WhatsApp', hosts: ['wa.me', 'whatsapp.com'], handle: () => null },
	{
		icon: 'mastodon',
		title: 'Mastodon',
		hosts: ['mastodon.social', 'mastodon.art', 'mstdn.social', 'mas.to', 'mastodon.online'],
		handle: (p) => at(p.segments.find((s) => s.startsWith('@')) ?? null)
	},
	{
		icon: 'steam',
		title: 'Steam',
		hosts: ['steamcommunity.com'],
		handle: (p) => bare(after(p, 'id'))
	},
	// Recognised for their handles, but not in Simple Icons: they draw the globe.
	{ icon: null, title: 'LinkedIn', hosts: ['linkedin.com'], handle: (p) => bare(after(p, 'in')) },
	{ icon: null, title: 'Cara', hosts: ['cara.app'], handle: (p) => bare(first(p)) },
	{ icon: null, title: 'VGen', hosts: ['vgen.co'], handle: (p) => bare(first(p)) }
];

function match(host: string): { rule: Rule; sub: string | null } | null {
	for (const rule of RULES) {
		for (const h of rule.hosts) {
			if (h.startsWith('*.')) {
				const base = h.slice(2);
				if (host.endsWith(`.${base}`)) {
					const sub = host.slice(0, -base.length - 1);
					// Only a single label is a user's subdomain (`name.itch.io`).
					if (!sub.includes('.')) return { rule, sub };
				}
			} else if (host === h) {
				return { rule, sub: null };
			}
		}
	}
	return null;
}

/** Icon, title and suggested handle for a url. Null when it isn't a url at all. */
export function linkInfo(url: string): LinkInfo | null {
	const mail = /^mailto:(.+)$/i.exec(url.trim());
	if (mail) return { icon: GLOBE, title: 'Email', handle: mail[1], known: false };

	const parsed = parseUrl(url);
	if (!parsed) return null;
	const hit = match(parsed.host);
	if (!hit) return { icon: GLOBE, title: parsed.host, handle: parsed.host, known: false };

	const icon = hit.rule.icon && LINK_ICONS[hit.rule.icon] ? hit.rule.icon : GLOBE;
	const handle = hit.rule.handle(parsed, hit.sub)?.trim();
	// A known platform with no readable handle (a Spotify album link) still
	// needs a label; the platform's name says more than its hostname.
	return { icon, title: hit.rule.title, handle: handle || hit.rule.title, known: true };
}

/** The icon key a url draws with, derived at render time and never stored. */
export function iconFor(url: string): string {
	return linkInfo(url)?.icon ?? GLOBE;
}
