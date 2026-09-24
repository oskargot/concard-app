/**
 * A link's platform icon, tinted to whatever colour it sits on.
 *
 * Simple Icons are filled 24 × 24 paths; the globe for an unknown domain is a
 * 2-unit stroke in the same box. Both are bundled, so a pill draws the same
 * offline in a convention hall as it does at home.
 */

import Svg, { Path } from 'react-native-svg';

import { LINK_ICONS } from './link-icons';
import { GLOBE_PATHS, iconFor } from './link-platforms';

export function LinkIcon({ url, size, color }: { url: string; size: number; color: string }) {
	const icon = LINK_ICONS[iconFor(url)];
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24">
			{icon ? (
				<Path d={icon.path} fill={color} />
			) : (
				GLOBE_PATHS.map((d) => (
					<Path
						key={d}
						d={d}
						fill="none"
						stroke={color}
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				))
			)}
		</Svg>
	);
}
