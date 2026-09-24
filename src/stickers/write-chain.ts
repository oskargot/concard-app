/**
 * Keeps each live sticker's writes in the order they were made.
 *
 * The editor saves every gesture as it ends (HANDOFF §1.4), and a gesture can
 * end before the last one's write has landed: a sticker moved while its insert
 * is still in flight, two quick drags, a sticker put back before it was ever
 * saved. So each placement gets its own serial chain, keyed by its id:
 *
 *  - the insert is the first link, and every later link waits for it;
 *  - updates wait their turn, and ones still waiting merge into one patch;
 *  - a delete waits for the insert (so the row it removes exists) and drops
 *    any update still waiting (the row is going anyway);
 *  - if the insert is refused, nothing after it for that key is sent — the
 *    row was never made.
 *
 * Chains for different stickers run side by side. A refused write doesn't stop
 * its chain (only a refused insert does); `onError` hears about it, and
 * `onIdle` fires whenever every chain has settled, which is when it's safe to
 * refetch without racing a write.
 *
 * No React or Supabase here, so `node scripts/stickers/check-write-chain.ts`
 * can exercise it on its own.
 */

type Link<P> =
	| { kind: 'insert'; run: () => Promise<unknown> }
	| { kind: 'update'; patch: P }
	| { kind: 'delete' }
	| { kind: 'task'; run: () => Promise<unknown> };

interface Chain<P> {
	/** Links not started yet, in order. */
	queue: Link<P>[];
	running: boolean;
	/** The insert was refused: the row doesn't exist, so nothing more is sent. */
	dead: boolean;
	/** A delete is queued or done: later updates are dropped. */
	deleted: boolean;
}

export interface WriteChainIO<P> {
	update: (key: string, patch: P) => Promise<unknown>;
	remove: (key: string) => Promise<unknown>;
	/** A write was refused. */
	onError: (error: unknown, key: string) => void;
	/** Every chain has settled. */
	onIdle?: () => void;
}

export class WriteChains<P extends object> {
	private readonly chains = new Map<string, Chain<P>>();
	private readonly io: WriteChainIO<P>;
	/** Bumped by every link queued, so a refetch can tell a write began while it was out. */
	epoch = 0;

	constructor(io: WriteChainIO<P>) {
		this.io = io;
	}

	/** The first link of a new placement's chain. */
	insert(key: string, run: () => Promise<unknown>): void {
		this.push(key, { kind: 'insert', run });
	}

	update(key: string, patch: P): void {
		const chain = this.chain(key);
		if (chain.deleted) return;
		const last = chain.queue[chain.queue.length - 1];
		if (last?.kind === 'update') {
			last.patch = { ...last.patch, ...patch };
			this.epoch++;
			return;
		}
		this.push(key, { kind: 'update', patch });
	}

	remove(key: string): void {
		const chain = this.chain(key);
		if (chain.deleted) return;
		chain.deleted = true;
		chain.queue = chain.queue.filter((link) => link.kind !== 'update');
		this.push(key, { kind: 'delete' });
	}

	/** Anything else that has to wait its turn on this key (a refetch, say). */
	task(key: string, run: () => Promise<unknown>): void {
		this.push(key, { kind: 'task', run });
	}

	/** True while a write for `key` (or, with no key, any write) is queued or in flight. */
	busy(key?: string): boolean {
		if (key !== undefined) {
			const chain = this.chains.get(key);
			return !!chain && (chain.running || chain.queue.length > 0);
		}
		for (const chain of this.chains.values()) {
			if (chain.running || chain.queue.length > 0) return true;
		}
		return false;
	}

	private chain(key: string): Chain<P> {
		let chain = this.chains.get(key);
		if (!chain) {
			chain = { queue: [], running: false, dead: false, deleted: false };
			this.chains.set(key, chain);
		}
		return chain;
	}

	private push(key: string, link: Link<P>): void {
		const chain = this.chain(key);
		chain.queue.push(link);
		this.epoch++;
		void this.pump(key, chain);
	}

	private async pump(key: string, chain: Chain<P>): Promise<void> {
		if (chain.running) return;
		chain.running = true;
		while (chain.queue.length) {
			const link = chain.queue.shift()!;
			if (chain.dead && link.kind !== 'task') continue;
			try {
				if (link.kind === 'insert' || link.kind === 'task') await link.run();
				else if (link.kind === 'update') await this.io.update(key, link.patch);
				else await this.io.remove(key);
			} catch (error) {
				if (link.kind === 'insert') chain.dead = true;
				this.io.onError(error, key);
			}
		}
		chain.running = false;
		// A finished chain is forgotten, unless it has to keep refusing links.
		if (!chain.dead && !chain.deleted) this.chains.delete(key);
		if (!this.busy()) this.io.onIdle?.();
	}
}
