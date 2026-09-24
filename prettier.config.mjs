/**
 * Matches the web app's config (tabs, single quotes, no trailing comma, 100
 * columns) minus its Svelte and Tailwind plugins, so shared files like
 * `card-style.ts` can move between the two repos without reformatting.
 *
 * @type {import("prettier").Config}
 */
const config = {
	useTabs: true,
	singleQuote: true,
	trailingComma: 'none',
	printWidth: 100,
	// core.autocrlf checks files out as CRLF on Windows and commits them as LF;
	// 'auto' keeps whichever a file has, so `prettier --check` judges style
	// rather than failing every file on this machine over line endings.
	endOfLine: 'auto'
};

export default config;
