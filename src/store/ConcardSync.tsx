import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { useAuth } from '@/auth/AuthProvider';
import { useConcardStore } from './useConcardStore';
import { fetchMyCollections, syncPendingScans } from './sync';

/** Starts a queue drain whenever connectivity returns or a new scan arrives,
 *  and replaces the starter demo binder with a live `collections` read the
 *  first time a signed-in user with a real session is seen. */
export function ConcardSync() {
	const pending = useConcardStore((state) => state.scan_queue.length);
	const demoBinder = useConcardStore((state) => state.demo_binder);
	const { session, status } = useAuth();
	// Guards against re-fetching every time this effect's deps change while
	// still signed in to the same account.
	const fetchedFor = useRef<string | null>(null);

	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((state) => {
			if (state.isConnected && state.isInternetReachable !== false) {
				syncPendingScans().catch((error) =>
					console.warn('concard: scan sync paused', error instanceof Error ? error.message : error)
				);
			}
		});
		return unsubscribe;
	}, []);

	useEffect(() => {
		if (!pending) return;
		NetInfo.fetch().then((state) => {
			if (state.isConnected && state.isInternetReachable !== false) {
				syncPendingScans().catch(() => {
					/* The queue remains intact for the next connectivity event. */
				});
			}
		});
	}, [pending]);

	useEffect(() => {
		if (status !== 'ready' || !session) return;
		if (!demoBinder || fetchedFor.current === session.user.id) return;
		fetchedFor.current = session.user.id;
		fetchMyCollections().catch((error) =>
			console.warn(
				'concard: could not load live binder',
				error instanceof Error ? error.message : error
			)
		);
	}, [status, session, demoBinder]);

	return null;
}
