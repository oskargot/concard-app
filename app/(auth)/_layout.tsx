import { Stack } from 'expo-router';

import { palette } from '@/theme/palette';

/** The onboarding flow has no headers and no back button: every step is
 *  mandatory, and a back arrow that cannot go anywhere is worse than none. */
export default function AuthLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: palette.base },
				animation: 'fade'
			}}
		/>
	);
}
