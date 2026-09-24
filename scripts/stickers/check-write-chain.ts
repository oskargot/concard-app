/**
 * Exercises `src/stickers/write-chain.ts` against a fake server whose writes
 * take as long as each case says, so the orderings the live editor can't show
 * here (no signed-in session) are checked somewhere. The repo has no test
 * runner; this is a plain script that exits non-zero on the first failure.
 *
 *   node scripts/stickers/check-write-chain.ts
 */

import assert from 'node:assert/strict';

import { WriteChains } from '../../src/stickers/write-chain.ts';

type Patch = { x?: number; y?: number; z_index?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A table of rows, and every statement that reached it in arrival order. */
function fakeServer() {
	const rows = new Map<string, Patch>();
	const log: string[] = [];
	return {
		rows,
		log,
		async insert(key: string, row: Patch, ms: number, refuse = false) {
			await sleep(ms);
			log.push(`insert ${key}`);
			if (refuse) throw new Error('too_many_stickers');
			rows.set(key, row);
		},
		async update(key: string, patch: Patch, ms: number) {
			await sleep(ms);
			log.push(`update ${key} ${JSON.stringify(patch)}`);
			// like PostgREST: updating a row that isn't there is 0 rows, not an error
			const row = rows.get(key);
			if (row) rows.set(key, { ...row, ...patch });
		},
		async remove(key: string, ms: number) {
			await sleep(ms);
			log.push(`delete ${key}`);
			rows.delete(key);
		}
	};
}

function setup(updateMs: number | ((patch: Patch) => number) = 5) {
	const server = fakeServer();
	const errors: string[] = [];
	let idle = 0;
	const chains = new WriteChains<Patch>({
		update: (key, patch) =>
			server.update(key, patch, typeof updateMs === 'number' ? updateMs : updateMs(patch)),
		remove: (key) => server.remove(key, 5),
		onError: (e, key) => errors.push(`${key}: ${(e as Error).message}`),
		onIdle: () => idle++
	});
	const drained = async () => {
		while (chains.busy()) await sleep(2);
	};
	return { server, errors, chains, drained, idles: () => idle };
}

const cases: [string, () => Promise<void>][] = [
	[
		'a move made while the insert is in flight lands after it',
		async () => {
			const { server, chains, drained } = setup();
			chains.insert('a', () => server.insert('a', { x: 0.5, y: 0.5 }, 30));
			chains.update('a', { x: 0.1 });
			await drained();
			assert.deepEqual(server.rows.get('a'), { x: 0.1, y: 0.5 });
			assert.deepEqual(server.log, ['insert a', 'update a {"x":0.1}']);
		}
	],
	[
		'raises and moves waiting behind the insert merge into one update',
		async () => {
			const { server, chains, drained } = setup();
			chains.insert('a', () => server.insert('a', { x: 0.5, y: 0.5, z_index: 1 }, 30));
			chains.update('a', { x: 0.1 });
			chains.update('a', { z_index: 4 });
			chains.update('a', { x: 0.2, y: 0.3 });
			await drained();
			assert.deepEqual(server.rows.get('a'), { x: 0.2, y: 0.3, z_index: 4 });
			assert.equal(server.log.length, 2);
		}
	],
	[
		'two quick drags land in the order they were made, however long each takes',
		async () => {
			// the first update is slow, the second fast: unordered, the first would win
			const { server, chains, drained } = setup((patch) => (patch.x === 0.1 ? 40 : 1));
			server.rows.set('a', { x: 0.5 });
			chains.update('a', { x: 0.1 });
			await sleep(5); // the first is on the wire before the second is made
			chains.update('a', { x: 0.9 });
			await drained();
			assert.deepEqual(server.rows.get('a'), { x: 0.9 });
		}
	],
	[
		'removing a sticker still being inserted deletes it once it exists',
		async () => {
			const { server, chains, drained } = setup();
			chains.insert('a', () => server.insert('a', { x: 0.5 }, 30));
			chains.update('a', { x: 0.1 });
			chains.remove('a');
			chains.update('a', { x: 0.2 }); // a late gesture on a removed sticker
			await drained();
			assert.equal(server.rows.has('a'), false);
			assert.deepEqual(server.log, ['insert a', 'delete a']);
		}
	],
	[
		'a refused insert sends nothing after it for that sticker, and says so once',
		async () => {
			const { server, chains, drained, errors } = setup();
			chains.insert('a', () => server.insert('a', { x: 0.5 }, 10, true));
			chains.update('a', { x: 0.1 });
			chains.remove('a');
			await drained();
			assert.deepEqual(server.log, ['insert a']);
			assert.deepEqual(errors, ['a: too_many_stickers']);
		}
	],
	[
		'stickers chain independently, and idle fires once everything has settled',
		async () => {
			const { server, chains, drained, idles } = setup();
			chains.insert('a', () => server.insert('a', { x: 0.5 }, 40));
			chains.insert('b', () => server.insert('b', { x: 0.5 }, 5));
			chains.update('b', { x: 0.7 });
			await sleep(25);
			// b finished while a's insert is still out
			assert.deepEqual(server.rows.get('b'), { x: 0.7 });
			assert.equal(chains.busy('b'), false);
			assert.equal(chains.busy(), true);
			assert.equal(idles(), 0);
			await drained();
			assert.equal(idles(), 1);
		}
	],
	[
		'a task waits for the writes before it, and the ones after wait for it',
		async () => {
			const { server, chains, drained } = setup();
			const seen: string[] = [];
			server.rows.set('aff', { x: 0.5 });
			chains.update('aff', { x: 0.1 });
			chains.task('aff', async () => {
				await sleep(20);
				seen.push(`task saw ${server.rows.get('aff')?.x}`);
			});
			chains.update('aff', { x: 0.2 });
			await drained();
			assert.deepEqual(seen, ['task saw 0.1']);
			assert.deepEqual(server.rows.get('aff'), { x: 0.2 });
		}
	],
	[
		'every queued link bumps the epoch',
		async () => {
			const { server, chains, drained } = setup();
			const before = chains.epoch;
			chains.insert('a', () => server.insert('a', {}, 5));
			chains.update('a', { x: 0.1 });
			chains.update('a', { x: 0.2 }); // merged, still a change
			assert.equal(chains.epoch, before + 3);
			await drained();
		}
	]
];

let failed = 0;
for (const [name, run] of cases) {
	try {
		await run();
		console.log(`ok   ${name}`);
	} catch (e) {
		failed++;
		console.log(`FAIL ${name}\n     ${(e as Error).message}`);
	}
}
console.log(failed ? `${failed} failed` : `all ${cases.length} passed`);
process.exit(failed ? 1 : 0);
