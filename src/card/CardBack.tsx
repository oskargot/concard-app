/**
 * The card back (card spec §5).
 *
 * Same frame as the front, in the **card's own edge colour**, over one graphite
 * face every card shares. No silhouette: the edge colour and the QR are what
 * identify the card. The QR tile and the `concard.me/username` line under it
 * are one group, centred on the card.
 *
 * Three variants:
 *  - `qr` — your own card: the real code.
 *  - `placeholder` — an offline scan whose giver hasn't synced yet: the same
 *    layout with a neutral edge (their edge colour isn't known until sync) and
 *    a stand-in code. The username is known from the scan, so the URL shows.
 *  - `record` — a collected card: the collector's record and no code, so a
 *    binder card can never be re-scanned remotely.
 */

import { Text, View, type TextStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { font } from '../theme/tokens';
import {
	GRAPHITE,
	NEUTRAL_EDGE,
	QR_TILE,
	inkFor,
	normalizeStyle,
	type CardStyle
} from './card-style';
import { CardQr, PlaceholderQr } from './CardQr';
import { CardShell, shellMetrics } from './CardShell';
import { layoutBack } from './layout/back';
import { BACK, FRAME } from './layout/spec';

export interface CollectorRecord {
	collected: string;
	event: string;
	note: string;
}

export interface CardBackProps {
	style: CardStyle;
	width: number;
	variant: 'qr' | 'placeholder' | 'record';
	/** What the QR encodes: the stable profile url. */
	qrValue?: string;
	/** Human-readable link under the QR, e.g. concard.me/oskar */
	url?: string;
	record?: CollectorRecord;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
}

/** The graphite face's text roles: the slate face is the tuned dark ink set. */
const INK = inkFor('slate');

export function CardBack({
	style,
	width,
	variant,
	qrValue,
	url = '',
	record,
	rx,
	ry
}: CardBackProps) {
	const m = shellMetrics(width);
	const s = m.scale;
	const at = (x: number, y: number) => ({ left: (x - FRAME.edge) * s, top: (y - FRAME.edge) * s });

	return (
		<CardShell
			style={normalizeStyle(style)}
			width={width}
			faceColor={GRAPHITE}
			edge={variant === 'placeholder' ? NEUTRAL_EDGE : undefined}
			rx={rx}
			ry={ry}
		>
			{variant === 'record' && record ? (
				<Record record={record} scale={s} />
			) : (
				<QrGroup variant={variant} qrValue={qrValue} url={url} scale={s} at={at} />
			)}
		</CardShell>
	);
}

function QrGroup({
	variant,
	qrValue,
	url,
	scale: s,
	at
}: {
	variant: 'qr' | 'placeholder' | 'record';
	qrValue?: string;
	url: string;
	scale: number;
	at: (x: number, y: number) => { left: number; top: number };
}) {
	const back = layoutBack();
	const inset = (back.qr.x - back.tile.x) * s;
	return (
		<>
			<View
				style={{
					position: 'absolute',
					...at(back.tile.x, back.tile.y),
					width: back.tile.w * s,
					height: back.tile.h * s,
					borderRadius: BACK.tileRadius * s,
					backgroundColor: QR_TILE,
					padding: inset
				}}
			>
				{variant === 'qr' && qrValue ? (
					<CardQr value={qrValue} size={back.qr.w * s} dark={GRAPHITE} light={QR_TILE} />
				) : (
					<PlaceholderQr size={back.qr.w * s} color={GRAPHITE} />
				)}
			</View>
			{url ? (
				<Text
					allowFontScaling={false}
					numberOfLines={1}
					style={{
						position: 'absolute',
						...at(back.url.x + FRAME.edge, back.url.y),
						width: (back.url.w - FRAME.edge * 2) * s,
						height: back.url.h * s,
						fontFamily: font.ui,
						fontSize: BACK.urlSize * s,
						lineHeight: BACK.urlLineHeight * s,
						includeFontPadding: false,
						textAlign: 'center',
						color: INK.mute
					}}
				>
					{url}
				</Text>
			) : null}
		</>
	);
}

/** A collected card's back: when and where you met, and nothing to scan. */
function Record({ record, scale: s }: { record: CollectorRecord; scale: number }) {
	const label: TextStyle = {
		fontFamily: font.uiSemi,
		fontSize: 8 * s,
		lineHeight: 11 * s,
		letterSpacing: 0.9 * s,
		textTransform: 'uppercase',
		color: INK.mute
	};
	const value: TextStyle = {
		marginTop: 2 * s,
		fontFamily: font.uiBold,
		fontSize: 14 * s,
		lineHeight: 17 * s,
		color: INK.ink
	};
	const row = (l: string, v: string) => (
		<View>
			<Text allowFontScaling={false} style={label}>
				{l}
			</Text>
			<Text allowFontScaling={false} style={value}>
				{v}
			</Text>
		</View>
	);

	return (
		<View style={{ flex: 1, padding: FRAME.pad * s, gap: 12 * s }}>
			<Text allowFontScaling={false} style={label}>
				collector&apos;s record
			</Text>
			<View style={{ flex: 1, gap: 12 * s }}>
				{row('collected', record.collected)}
				{row('event', record.event)}
				<View
					style={{
						borderLeftWidth: 2 * s,
						borderLeftColor: INK.line,
						paddingLeft: 7 * s
					}}
				>
					{row('note', record.note)}
				</View>
			</View>
			<Text
				allowFontScaling={false}
				style={[label, { paddingTop: 8 * s, borderTopWidth: s, borderTopColor: INK.line }]}
			>
				a collected card carries no code
			</Text>
		</View>
	);
}
