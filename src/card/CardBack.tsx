/**
 * The card back. Ported from the web app's `CardBack.svelte`.
 *
 * Your own card shows a QR (or a placeholder until Phase 3 wires one in). A
 * collected card shows the collector's record and never a code — so cards can't
 * be re-scanned remotely.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { font } from '../theme/tokens';
import type { CardStyle } from './card-style';
import { CardShell, shellMetrics } from './CardShell';

export interface CollectorRecord {
	collected: string;
	event: string;
	note: string;
}

export interface CardBackProps {
	style: CardStyle;
	width: number;
	/** Your own card shows QR; a collected card shows the collector's record. */
	variant: 'qr' | 'record';
	/** Human-readable link under the QR, e.g. concard.me/oskar */
	url?: string;
	/** Drawn inside the paper plate. Phase 3 supplies a real QR. */
	qr?: ReactNode;
	record?: CollectorRecord;
	rx: SharedValue<number>;
	ry: SharedValue<number>;
}

export function CardBack({
	style,
	width,
	variant,
	url = '',
	qr,
	record,
	rx,
	ry
}: CardBackProps) {
	const m = shellMetrics(width, style.shape);
	const hair = Math.max(m.u(0.5), 1);
	const lab = {
		fontFamily: font.bodyBold,
		fontSize: Math.max(m.u(2.67), 6.5),
		letterSpacing: 1.1,
		textTransform: 'uppercase' as const,
		color: '#a9a4b8'
	};

	return (
		// The back is always ink, whatever the front's background: the reverse of a printed card.
		<CardShell style={style} width={width} faceColor="#17161b" rx={rx} ry={ry}>
			<View style={{ flex: 1, paddingVertical: m.u(6), paddingHorizontal: m.u(5.33) }}>
				{variant === 'qr' ? (
					<View style={styles.centre}>
						<Text style={lab}>scan me</Text>
						<View
							style={{
								width: m.u(60),
								padding: m.u(3.33),
								borderRadius: m.u(3.33),
								backgroundColor: '#fbf9f3',
								aspectRatio: 1,
								alignItems: 'center',
								justifyContent: 'center'
							}}
						>
							{qr ?? (
								<Text
									style={{
										fontFamily: font.bodyBold,
										fontSize: Math.max(m.u(3.17), 8),
										letterSpacing: 1,
										textTransform: 'uppercase',
										color: '#17161b',
										textAlign: 'center'
									}}
								>
									QR
								</Text>
							)}
						</View>
						{url ? (
							<Text style={[lab, { textAlign: 'center' }]} numberOfLines={2}>
								{url}
							</Text>
						) : null}
					</View>
				) : record ? (
					<View style={{ flex: 1, gap: m.u(4.33) }}>
						<Text style={lab}>collector's record</Text>
						<View style={{ flex: 1, gap: m.u(4.33) }}>
							<RecordRow lab={lab} label="collected" value={record.collected} m={m} />
							<RecordRow lab={lab} label="event" value={record.event} m={m} />
							<View
								style={{
									borderLeftWidth: hair * 2,
									borderLeftColor: '#e7f8f1',
									paddingLeft: m.u(2.67)
								}}
							>
								<Text style={lab}>note</Text>
								<Text
									style={{
										marginTop: m.u(1),
										fontFamily: font.display,
										fontSize: m.u(5.33),
										lineHeight: m.u(5.33) * 1.15,
										color: '#f2efe6'
									}}
								>
									{record.note}
								</Text>
							</View>
						</View>
						<Text
							style={[
								lab,
								{
									paddingTop: m.u(3),
									borderTopWidth: hair,
									borderTopColor: 'rgba(242,239,230,0.25)'
								}
							]}
						>
							a collected card carries no code
						</Text>
					</View>
				) : null}
			</View>
		</CardShell>
	);
}

function RecordRow({
	lab,
	label,
	value,
	m
}: {
	lab: object;
	label: string;
	value: string;
	m: ReturnType<typeof shellMetrics>;
}) {
	return (
		<View>
			<Text style={lab}>{label}</Text>
			<Text
				style={{
					marginTop: m.u(1),
					fontFamily: font.display,
					fontSize: m.u(5.33),
					lineHeight: m.u(5.33) * 1.15,
					color: '#f2efe6'
				}}
			>
				{value}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	centre: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12
	}
});
