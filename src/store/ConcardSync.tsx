import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { useConcardStore } from './useConcardStore';
import { syncPendingScans } from './sync';

/** Starts a queue drain whenever connectivity returns or a new scan arrives. */
export function ConcardSync() {
	const pending = useConcardStore((state) => state.scan_queue.length);

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

	return null;
}
