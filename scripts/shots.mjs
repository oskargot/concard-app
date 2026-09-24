#!/usr/bin/env node
// Screenshot harness for the sticker build loop (docs/stickers/HANDOFF.md §6.2).
//
//   npm run shots -- /dev/stickers /dev/cards
//   npm run shots -- --phase=3 --name=rungs /dev/stickers
//
// Starts Expo's web target on WEB_PORT if nothing is listening there, visits
// each route in headless Chrome at 390 x 844 (an iPhone 14/15's points), and
// writes a PNG per route to docs/stickers/shots/phase-N/. N comes from
// --phase, else from "Phase N" under "## Current phase" in PROGRESS.md.
//
// Uses the installed Chrome through playwright-core rather than a downloaded
// Playwright browser. Set CHROME_PATH to use another Chromium.
//
// Web screenshots prove layout and logic, not how foil feels: Skia has no
// runtime on the web target (see SKIA_AVAILABLE), blend modes and gestures
// differ from native. Device checks cover that.
//
// Console output stays ASCII; this machine's console is cp932.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_PORT = Number(process.env.WEB_PORT ?? 8082);
const BASE = `http://localhost:${WEB_PORT}`;
const VIEWPORT = { width: 390, height: 844 };
const CHROME_CANDIDATES = [
	process.env.CHROME_PATH,
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium'
].filter(Boolean);

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
// Git Bash rewrites a leading `/dev/x` into `C:/Program Files/Git/dev/x`;
// undo that, and accept routes without the leading slash.
const routes = args
	.filter((a) => !a.startsWith('--'))
	.map((a) => a.replace(/^[a-z]:\/.*?\/Git(?=\/)/i, '').replace(/^(?!\/)/, '/'));
const fullPage = args.includes('--full');
const keep = args.includes('--keep');
const waitMs = Number(flag('wait') ?? 2500);

if (!routes.length) {
	console.log(
		'usage: npm run shots -- [--phase=N] [--name=suffix] [--full] [--keep] <route> [...]'
	);
	process.exit(1);
}

function currentPhase() {
	const explicit = flag('phase');
	if (explicit) return explicit;
	try {
		const progress = readFileSync(path.join(ROOT, 'docs/stickers/PROGRESS.md'), 'utf8');
		const match = progress.match(/## Current phase\s+Phase (\d+)/);
		if (match) return match[1];
	} catch {
		/* no PROGRESS.md yet */
	}
	return '0';
}

async function isUp() {
	try {
		const res = await fetch(BASE, { signal: AbortSignal.timeout(3000) });
		return res.ok;
	} catch {
		return false;
	}
}

async function startWeb() {
	// Output goes to a file, not a pipe: with --keep this process exits first,
	// and a server writing into a closed pipe dies with it.
	const logFile = path.join(os.tmpdir(), `concard-expo-web-${WEB_PORT}.log`);
	console.log(`starting expo web on :${WEB_PORT} (log: ${logFile}) ...`);
	const out = openSync(logFile, 'w');
	const child = spawn(`npx expo start --web --port ${WEB_PORT}`, {
		cwd: ROOT,
		// Not CI=1: CI mode turns off Metro's watcher, so edits would never
		// reach a kept server.
		env: { ...process.env, BROWSER: 'none', EXPO_NO_TELEMETRY: '1' },
		shell: true,
		detached: keep,
		stdio: ['ignore', out, out]
	});
	const deadline = Date.now() + 180_000;
	while (Date.now() < deadline) {
		if (await isUp()) {
			if (keep) child.unref();
			return child;
		}
		if (child.exitCode !== null) break;
		await new Promise((r) => setTimeout(r, 1000));
	}
	console.log(readFileSync(logFile, 'utf8').slice(-2000));
	throw new Error('expo web did not come up');
}

function stop(child) {
	if (!child) return;
	if (process.platform === 'win32') {
		spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
	} else {
		child.kill('SIGTERM');
	}
}

function slug(route) {
	const s = route
		.replace(/^\/+/, '')
		.replace(/[^a-z0-9]+/gi, '-')
		.replace(/-+$/, '');
	return s || 'root';
}

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
	console.log('no Chrome found; set CHROME_PATH');
	process.exit(1);
}

const outDir = path.join(ROOT, 'docs/stickers/shots', `phase-${currentPhase()}`);
mkdirSync(outDir, { recursive: true });

let server = null;
if (!(await isUp())) server = await startWeb();

const browser = await chromium.launch({ executablePath, headless: true });
let failed = false;
try {
	const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
	const errors = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(`console: ${m.text()}`);
	});
	for (const route of routes) {
		errors.length = 0;
		// The first visit compiles the bundle, which can take a while.
		await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 180_000 });
		// A cold Metro answers with an empty shell while it bundles; wait for
		// React to actually put something on screen, then let fonts and
		// images settle.
		await page.waitForFunction(
			() => (document.getElementById('root')?.innerText ?? '').length > 0,
			null,
			{
				timeout: 180_000
			}
		);
		await page.waitForTimeout(waitMs);
		const name = [slug(route), flag('name')].filter(Boolean).join('--');
		const file = path.join(outDir, `${name}.png`);
		await page.screenshot({ path: file, fullPage });
		console.log(`${route} -> ${path.relative(ROOT, file).replaceAll('\\', '/')}`);
		for (const e of errors) console.log(`  ${e.slice(0, 300).replace(/[^\x20-\x7e]/g, '?')}`);
	}
} catch (e) {
	failed = true;
	console.log(String(e?.message ?? e).replace(/[^\x20-\x7e\n]/g, '?'));
} finally {
	await browser.close();
	if (!keep) stop(server);
	else if (server) console.log(`left expo web running (pid ${server.pid})`);
}
process.exit(failed ? 1 : 0);
