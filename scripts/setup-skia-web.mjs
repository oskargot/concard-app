// Copies CanvasKit's wasm into public/ so Expo's web target can serve it to
// index.web.js. Idempotent; run by scripts/shots.mjs, or by hand before
// `npx expo start --web`. public/canvaskit.wasm is git-ignored (8 MB).
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(ROOT, 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm');
const to = path.join(ROOT, 'public/canvaskit.wasm');

if (!existsSync(from)) {
	console.log('canvaskit-wasm not installed; web foil stays off');
	process.exit(0);
}
if (!existsSync(to) || statSync(to).size !== statSync(from).size) {
	mkdirSync(path.dirname(to), { recursive: true });
	copyFileSync(from, to);
	console.log('copied canvaskit.wasm -> public/');
}
