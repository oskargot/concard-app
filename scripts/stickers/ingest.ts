/**
 * Deco sticker ingest (HANDOFF §3.1).
 *
 *   node scripts/stickers/ingest.ts --dry-run            # bake to sticker-out/, touch nothing remote
 *   node scripts/stickers/ingest.ts --dry-run --sheet    # …and write the contact sheet
 *   node scripts/stickers/ingest.ts                      # bake, upload, upsert rows
 *   node scripts/stickers/ingest.ts --only=cat,fox sticker-src/noto
 *
 * Input: folders of transparent PNGs (default: `sticker-src/` and every folder
 * under it), each with an optional `manifest.json`:
 *
 *   { "stickers": [{ "file": "a.png", "id": "cat", "name": "Cat",
 *                    "sort_order": 50, "source": "drop", "rarity": "common" }] }
 *
 * A PNG with no manifest entry gets id = slug of its file name, a title-cased
 * name, source `drop` and a sort order after everything listed.
 *
 * Output per sticker: `<out>/<id>/<hash>-{full,mask,thumb}.webp`, plus
 * `<out>/index.json` describing every sticker. `hash` covers the input bytes
 * and the pipeline recipe, so an unchanged PNG always lands on the same names:
 * re-running writes nothing and reports every sticker unchanged. Nothing is
 * ever overwritten or deleted, locally or in storage.
 *
 * Upload needs `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_URL` or
 * `EXPO_PUBLIC_SUPABASE_URL`) in `.env.local`, which is git-ignored and read
 * only by this script. Without the key the script runs dry and says so.
 * Objects go to the public `stickers` bucket at `<id>/<hash>-<kind>.webp`
 * with a one-year immutable cache header; then the `stickers` row is inserted
 * or updated to point at them. Rows are never deleted, and an existing row's
 * `is_active` is never touched (retiring a sticker is Oskar's call).
 *
 * Console output stays ASCII (cp932 console on the dev machine).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import sharp, { type OverlayOptions } from 'sharp';

import { makeSticker, PIPELINE_VERSION, type StickerAssets } from './pipeline.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BUCKET = 'stickers';
const CACHE_SECONDS = String(60 * 60 * 24 * 365);
const ASSET_KINDS = ['full', 'mask', 'thumb'] as const;
type AssetKind = (typeof ASSET_KINDS)[number];

interface ManifestEntry {
	file: string;
	id?: string;
	name?: string;
	sort_order?: number;
	source?: 'starter' | 'drop' | 'shop' | 'event';
	rarity?: 'common' | 'uncommon' | 'rare' | 'legendary';
}

interface Job {
	file: string;
	id: string;
	name: string;
	sort_order: number;
	source: NonNullable<ManifestEntry['source']>;
	rarity: NonNullable<ManifestEntry['rarity']>;
}

/** One sticker as written to index.json — what the app's fixtures and the
 *  row upsert both read. Paths are relative to the bucket / out folder. */
export interface IndexEntry extends Omit<Job, 'file'> {
	kind: 'deco';
	hash: string;
	source_file: string;
	full_path: string;
	mask_path: string;
	thumb_path: string;
	/** Width / height of full and mask (same canvas). */
	art_aspect: number;
	width: number;
	height: number;
	thumb_width: number;
	thumb_height: number;
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const dryRequested = args.includes('--dry-run');
const wantSheet = args.includes('--sheet');
const only = flag('only')?.split(',');
const outDir = path.resolve(ROOT, flag('out') ?? 'sticker-out');
const inputs = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(ROOT, a));

const env = readEnvLocal();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
let dry = dryRequested;
if (!dry && (!serviceKey || !supabaseUrl)) {
	console.log(
		'No SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL in .env.local: running dry.\n' +
			'Oskar needs to run the upload himself: put both in concard-app/.env.local, then\n' +
			'  node scripts/stickers/ingest.ts'
	);
	dry = true;
}

const jobs = collectJobs(inputs.length ? inputs : defaultInputs());
if (!jobs.length) {
	console.log('no PNGs found');
	process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const index: IndexEntry[] = [];
let written = 0;
for (const job of jobs) {
	const png = readFileSync(job.file);
	const assets = await makeSticker(png);
	const entry = toIndexEntry(job, assets);
	let changed = false;
	for (const kind of ASSET_KINDS) {
		const dest = path.join(outDir, entry[`${kind}_path`]);
		if (existsSync(dest)) continue; // content-addressed: same name, same bytes
		mkdirSync(path.dirname(dest), { recursive: true });
		writeFileSync(dest, assets[kind].data);
		changed = true;
		written++;
	}
	console.log(`${job.id.padEnd(18)} ${entry.hash} ${changed ? 'baked' : 'unchanged'}`);
	index.push(entry);
}

const indexPath = path.join(outDir, 'index.json');
// A partial run (--only, or explicit folders) updates its stickers in the
// index and keeps everyone else's entries.
if ((only || inputs.length) && existsSync(indexPath)) {
	const ran = new Set(index.map((e) => e.id));
	const previous: IndexEntry[] = JSON.parse(readFileSync(indexPath, 'utf8')).stickers;
	index.push(...previous.filter((e) => !ran.has(e.id)));
}
index.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
const indexJson =
	JSON.stringify({ pipeline_version: PIPELINE_VERSION, stickers: index }, null, '\t') + '\n';
const indexChanged = !existsSync(indexPath) || readFileSync(indexPath, 'utf8') !== indexJson;
if (indexChanged) writeFileSync(indexPath, indexJson);
console.log(
	`${index.length} stickers, ${written} files written, index ${indexChanged ? 'updated' : 'unchanged'} (${path.relative(ROOT, outDir)})`
);

if (wantSheet) await contactSheet(index);
if (!dry) await upload(index);

// ---------------------------------------------------------------------------

function defaultInputs(): string[] {
	const root = path.join(ROOT, 'sticker-src');
	if (!existsSync(root)) return [];
	const dirs = [root];
	for (const name of readdirSync(root)) {
		const p = path.join(root, name);
		if (statSync(p).isDirectory()) dirs.push(p);
	}
	return dirs;
}

function collectJobs(dirs: string[]): Job[] {
	const jobs: Job[] = [];
	const seen = new Set<string>();
	for (const dir of dirs) {
		const pngs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
		if (!pngs.length) continue;
		const manifestPath = path.join(dir, 'manifest.json');
		const manifest: ManifestEntry[] = existsSync(manifestPath)
			? JSON.parse(readFileSync(manifestPath, 'utf8')).stickers
			: [];
		const byFile = new Map(manifest.map((m) => [m.file, m]));
		let next = 1000 + jobs.length * 10;
		for (const file of pngs.sort()) {
			const m = byFile.get(file);
			const id = m?.id ?? slug(file.replace(/\.png$/i, ''));
			if (only && !only.includes(id)) continue;
			if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id))
				throw new Error(`bad sticker id "${id}" (${file})`);
			if (seen.has(id)) throw new Error(`duplicate sticker id "${id}" (${dir})`);
			seen.add(id);
			jobs.push({
				file: path.join(dir, file),
				id,
				name: m?.name ?? titleCase(id),
				sort_order: m?.sort_order ?? (next += 10),
				source: m?.source ?? 'drop',
				rarity: m?.rarity ?? 'common'
			});
		}
	}
	return jobs;
}

function toIndexEntry(job: Job, assets: StickerAssets): IndexEntry {
	const p = (kind: AssetKind) => `${job.id}/${assets.hash}-${kind}.webp`;
	return {
		id: job.id,
		name: job.name,
		kind: 'deco',
		sort_order: job.sort_order,
		source: job.source,
		rarity: job.rarity,
		hash: assets.hash,
		source_file: path.relative(ROOT, job.file).replaceAll('\\', '/'),
		full_path: p('full'),
		mask_path: p('mask'),
		thumb_path: p('thumb'),
		art_aspect: Math.round((assets.full.width / assets.full.height) * 10000) / 10000,
		width: assets.full.width,
		height: assets.full.height,
		thumb_width: assets.thumb.width,
		thumb_height: assets.thumb.height
	};
}

/**
 * Every sticker's `full` on the dark card-table ground and on a light card
 * face, with its mask beside it, so rim weight and registration can be judged
 * across the whole set at a glance.
 */
async function contactSheet(entries: IndexEntry[]) {
	const TILE = 132;
	const LABEL = 18;
	const COLS = 5;
	const cellW = TILE * 3;
	const cellH = TILE + LABEL;
	const rows = Math.ceil(entries.length / COLS);
	const grounds = ['#1b1a20', '#f4efe6', '#3b3942'];
	const layers: OverlayOptions[] = [];
	for (const [i, e] of entries.entries()) {
		const x0 = (i % COLS) * cellW;
		const y0 = Math.floor(i / COLS) * cellH;
		const images = [e.full_path, e.full_path, e.mask_path];
		for (const [j, rel] of images.entries()) {
			const fitted = await sharp(path.join(outDir, rel))
				.resize(TILE - 12, TILE - 12, {
					fit: 'contain',
					background: { r: 0, g: 0, b: 0, alpha: 0 }
				})
				.png()
				.toBuffer();
			const tile = await sharp({
				create: { width: TILE, height: TILE, channels: 4, background: grounds[j] }
			})
				.composite([{ input: fitted, left: 6, top: 6 }])
				.png()
				.toBuffer();
			layers.push({ input: tile, left: x0 + j * TILE, top: y0 });
		}
		const label = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${LABEL}">` +
				`<rect width="100%" height="100%" fill="#121116"/>` +
				`<text x="6" y="13" font-family="Arial, sans-serif" font-size="12" fill="#c9c6d2">` +
				`${escapeXml(e.id)}  ${e.width}x${e.height}  ${e.hash.slice(0, 8)}</text></svg>`
		);
		layers.push({ input: label, left: x0, top: y0 + TILE });
	}
	const file = path.join(ROOT, 'docs/stickers/shots/ingest-contact-sheet.png');
	mkdirSync(path.dirname(file), { recursive: true });
	await sharp({
		create: { width: COLS * cellW, height: rows * cellH, channels: 4, background: '#121116' }
	})
		.composite(layers)
		.png({ compressionLevel: 9 })
		.toFile(file);
	console.log(`contact sheet -> ${path.relative(ROOT, file).replaceAll('\\', '/')}`);
}

async function upload(entries: IndexEntry[]) {
	const supabase = createClient(supabaseUrl!, serviceKey!, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	let uploaded = 0;
	let rowsChanged = 0;
	for (const e of entries) {
		const { data: existing, error: listError } = await supabase.storage.from(BUCKET).list(e.id);
		if (listError) throw new Error(`list ${e.id}: ${listError.message}`);
		const have = new Set((existing ?? []).map((o) => `${e.id}/${o.name}`));
		for (const kind of ASSET_KINDS) {
			const key = e[`${kind}_path`];
			if (have.has(key)) continue; // immutable: never overwrite
			const { error } = await supabase.storage
				.from(BUCKET)
				.upload(key, readFileSync(path.join(outDir, key)), {
					contentType: 'image/webp',
					cacheControl: CACHE_SECONDS,
					upsert: false
				});
			if (error) throw new Error(`upload ${key}: ${error.message}`);
			uploaded++;
		}

		const row = {
			id: e.id,
			name: e.name,
			kind: 'deco',
			sort_order: e.sort_order,
			source: e.source,
			rarity: e.rarity,
			full_path: e.full_path,
			mask_path: e.mask_path,
			thumb_path: e.thumb_path,
			art_aspect: e.art_aspect
		};
		const { data: current, error: readError } = await supabase
			.from('stickers')
			.select(Object.keys(row).join(','))
			.eq('id', e.id)
			.maybeSingle();
		if (readError) throw new Error(`read row ${e.id}: ${readError.message}`);
		const same =
			current &&
			Object.entries(row).every(
				([k, v]) =>
					// numeric columns can come back as strings; compare as text
					String((current as unknown as Record<string, unknown>)[k]) === String(v)
			);
		if (same) continue;
		const { error } = current
			? await supabase.from('stickers').update(row).eq('id', e.id)
			: await supabase.from('stickers').insert(row);
		if (error) throw new Error(`write row ${e.id}: ${error.message}`);
		rowsChanged++;
	}
	console.log(`uploaded ${uploaded} objects, ${rowsChanged} rows written`);
}

/** Minimal .env.local reader; nothing else in the repo loads this file. */
function readEnvLocal(): Record<string, string> {
	const file = path.join(ROOT, '.env.local');
	const out: Record<string, string> = {};
	if (!existsSync(file)) return out;
	for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
		if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
	}
	return out;
}

function slug(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

function titleCase(id: string): string {
	return id.replace(
		/(^|-)([a-z])/g,
		(_m, sep: string, c: string) => (sep ? ' ' : '') + c.toUpperCase()
	);
}

function escapeXml(s: string): string {
	return s.replace(
		/[<>&"]/g,
		(c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!
	);
}
