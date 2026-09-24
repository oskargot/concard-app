/**
 * The one clock every foiled sticker shimmers by (HANDOFF §1.6).
 *
 * A single shared value, advanced by a single frame callback — not one
 * animation per sticker — and only while at least one foiled sticker is
 * mounted and not paused. Plain stickers never subscribe, so a card or drawer
 * with no foil runs no frame callback at all. Offscreen stickers are unmounted
 * by their lists, and a closed drawer unmounts its grid, so both stop costing
 * anything; `useShimmerPause` covers anything else that wants to hold still.
 *
 * Cards keep their own per-canvas clock in SkiaFoil; this only drives the
 * *idle drift* term of a sticker's foil. On a card the tilt still comes from
 * the card's own `rx`/`ry`, so card and stickers share one light.
 */

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
	makeMutable,
	useFrameCallback,
	useSharedValue,
	type SharedValue
} from 'react-native-reanimated';

interface Shimmer {
	clock: SharedValue<number>;
	subscribe: () => () => void;
	pause: () => () => void;
}

/** Used when no provider is mounted: a clock that never moves. Stickers still
 *  draw their foil, lit by tilt alone. */
const STILL: Shimmer = {
	clock: makeMutable(0),
	subscribe: () => () => {},
	pause: () => () => {}
};

const ShimmerContext = createContext<Shimmer>(STILL);

export function StickerShimmerProvider({ children }: { children: ReactNode }) {
	const clock = useSharedValue(0);
	const subscribers = useRef(0);
	const pauses = useRef(0);

	const frame = useFrameCallback((info) => {
		clock.value += info.timeSincePreviousFrame ?? 0;
	}, false);

	const value = useMemo<Shimmer>(() => {
		const sync = () => frame.setActive(subscribers.current > 0 && pauses.current === 0);
		return {
			clock,
			subscribe: () => {
				subscribers.current += 1;
				sync();
				return () => {
					subscribers.current -= 1;
					sync();
				};
			},
			pause: () => {
				pauses.current += 1;
				sync();
				return () => {
					pauses.current -= 1;
					sync();
				};
			}
		};
		// `frame` is stable for the provider's life.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clock]);

	return <ShimmerContext.Provider value={value}>{children}</ShimmerContext.Provider>;
}

/** The shared clock (ms), kept running while the caller is mounted. */
export function useShimmerClock(): SharedValue<number> {
	const shimmer = useContext(ShimmerContext);
	useEffect(() => shimmer.subscribe(), [shimmer]);
	return shimmer.clock;
}

/** Holds every sticker's shimmer still while `paused` (e.g. a hidden drawer). */
export function useShimmerPause(paused: boolean) {
	const shimmer = useContext(ShimmerContext);
	useEffect(() => (paused ? shimmer.pause() : undefined), [shimmer, paused]);
}
