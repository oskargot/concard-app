/**
 * The QR on a card back, drawn straight from the module matrix.
 *
 * Card spec §5: 150 units square *including* a 4-module quiet zone, dark
 * modules on the light tile, and never styled or inverted — people without the
 * app reach `/username` by pointing a phone's own camera at it, and those
 * readers are the least forgiving. Drawing the matrix directly (rather than via
 * a QR component's own padding rules) keeps the quiet zone exactly 4 modules.
 */

import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import QRCode from 'qrcode';

import { BACK } from './layout/spec';

export function CardQr({
	value,
	size,
	dark,
	light
}: {
	value: string;
	/** Width in px, quiet zone included. */
	size: number;
	dark: string;
	light: string;
}) {
	const { path, total } = useMemo(() => {
		const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
		const n = qr.modules.size;
		const q = BACK.quietModules;
		// One rectangle per horizontal run of dark modules, so neighbours share
		// no anti-aliased seam for a camera to misread.
		let d = '';
		for (let y = 0; y < n; y++) {
			let x = 0;
			while (x < n) {
				if (!qr.modules.data[y * n + x]) {
					x++;
					continue;
				}
				let run = 1;
				while (x + run < n && qr.modules.data[y * n + x + run]) run++;
				d += `M${x + q} ${y + q}h${run}v1h-${run}z`;
				x += run;
			}
		}
		return { path: d, total: n + q * 2 };
	}, [value]);

	return (
		<Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
			<Rect x={0} y={0} width={total} height={total} fill={light} />
			<Path d={path} fill={dark} />
		</Svg>
	);
}

/**
 * Stand-in for a code not known yet: an offline scan's back, before sync says
 * whose card it is. Three finder squares and nothing else, so it reads as a QR
 * at a glance but can never be scanned as one.
 */
export function PlaceholderQr({ size, color }: { size: number; color: string }) {
	const total = 29 + BACK.quietModules * 2;
	const finder = (x: number, y: number) =>
		`M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z M${x + 2} ${y + 2}h3v3h-3z`;
	const q = BACK.quietModules;
	return (
		<Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
			<Path
				d={`${finder(q, q)} ${finder(q + 22, q)} ${finder(q, q + 22)}`}
				fill={color}
				fillRule="evenodd"
				opacity={0.28}
			/>
		</Svg>
	);
}
