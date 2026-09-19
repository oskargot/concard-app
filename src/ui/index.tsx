/**
 * The small set of chrome the app needs around its cards.
 *
 * Concard style guide: the app is a dark velvet display case — backgrounds
 * recede (ground → surface → raised) and the only colour that pops is the holo
 * gradient, reserved for primary actions, the Scan control, and card frames.
 * So most chrome here is deliberately quiet: flat raised surfaces with a real
 * hairline and one accent per screen. `HoloButton` is the single sanctioned
 * gradient surface in chrome.
 */

import { forwardRef, type ReactNode } from 'react';
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
	type TextInputProps,
	type ViewStyle
} from 'react-native';

import { HOLO_GRADIENT, palette } from '../theme/palette';
import { radius, shadow, space, type } from '../theme/tokens';

export function Button({
	label,
	onPress,
	variant = 'primary',
	disabled,
	busy
}: {
	label: string;
	onPress: () => void;
	variant?: 'primary' | 'secondary' | 'ghost';
	disabled?: boolean;
	busy?: boolean;
}) {
	const off = disabled || busy;
	return (
		<Pressable
			onPress={onPress}
			disabled={off}
			style={({ pressed }) => [
				styles.btn,
				variant === 'primary' && styles.btnPrimary,
				variant === 'secondary' && styles.btnSecondary,
				variant === 'ghost' && styles.btnGhost,
				pressed && !off && styles.btnPressed,
				off && styles.btnOff
			]}
			accessibilityRole="button"
			accessibilityState={{ disabled: !!off, busy: !!busy }}
		>
			{busy ? (
				<ActivityIndicator color={variant === 'primary' ? palette.ground : palette.textPrimary} />
			) : (
				<Text
					style={[
						styles.btnText,
						variant === 'primary' && styles.btnTextPrimary,
						variant === 'ghost' && styles.btnTextGhost
					]}
				>
					{label}
				</Text>
			)}
		</Pressable>
	);
}

/**
 * The large holo-gradient CTA — "Show My QR Code". The one place chrome uses the
 * holo gradient as a fill; everything else keeps to a single flat accent.
 */
export function HoloButton({
	label,
	onPress,
	disabled,
	busy,
	style
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	busy?: boolean;
	style?: ViewStyle;
}) {
	const off = disabled || busy;
	return (
		<Pressable
			onPress={onPress}
			disabled={off}
			style={({ pressed }) => [
				styles.holoBtn,
				pressed && !off && styles.btnPressed,
				off && styles.btnOff,
				style
			]}
			accessibilityRole="button"
			accessibilityState={{ disabled: !!off, busy: !!busy }}
		>
			{busy ? (
				<ActivityIndicator color={palette.ground} />
			) : (
				<Text style={styles.holoBtnText}>{label}</Text>
			)}
		</Pressable>
	);
}

/** Small pill button — the "Edit" chip in a header. */
export function ChipButton({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [styles.chipBtn, pressed && styles.btnPressed]}
			accessibilityRole="button"
		>
			<Text style={styles.chipBtnText}>{label}</Text>
		</Pressable>
	);
}

/** A filter / sort chip. Active is solid holo, inactive is an outlined surface. */
export function Chip({
	label,
	active,
	onPress
}: {
	label: string;
	active: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [styles.chip, active && styles.chipOn, pressed && styles.btnPressed]}
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
		>
			<Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
		</Pressable>
	);
}

/** 36px round header action, e.g. flash or sort. */
export function IconCircle({
	children,
	onPress,
	label,
	active
}: {
	children: ReactNode;
	onPress?: () => void;
	label?: string;
	active?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			accessibilityRole={onPress ? 'button' : undefined}
			accessibilityLabel={label}
			style={({ pressed }) => [
				styles.iconCircle,
				active && styles.iconCircleOn,
				pressed && !!onPress && styles.btnPressed
			]}
		>
			{children}
		</Pressable>
	);
}

/** A small count pill, e.g. "31 cards" beside a title. */
export function CountBadge({ children }: { children: ReactNode }) {
	return (
		<View style={styles.countBadge}>
			<Text style={styles.countBadgeText}>{children}</Text>
		</View>
	);
}

/**
 * Standard screen header: 17/700 title on the left, an optional action on the
 * right. `eyebrow` renders a small-caps kicker above the title when supplied.
 */
export function ScreenHeader({
	title,
	eyebrow,
	right
}: {
	title: string;
	eyebrow?: string;
	right?: ReactNode;
}) {
	return (
		<View style={styles.screenHeader}>
			<View style={styles.screenHeaderText}>
				{eyebrow ? <Text style={styles.screenHeaderEyebrow}>{eyebrow}</Text> : null}
				<Text style={styles.screenTitle}>{title}</Text>
			</View>
			{right}
		</View>
	);
}

/**
 * The ambient radial glow behind the hero card. Absolutely positioned by its
 * parent; the parent sets `top`/`left`. Uses the gradient engine the foils
 * already rely on, degrading to nothing if a runtime can't parse the radial.
 */
export function AmbientGlow({ style }: { style?: ViewStyle }) {
	return (
		<View
			pointerEvents="none"
			style={[
				styles.ambientGlow,
				{ experimental_backgroundImage: AMBIENT_GRADIENT } as ViewStyle,
				style
			]}
		/>
	);
}

const AMBIENT_GRADIENT =
	'radial-gradient(ellipse at center, rgba(185,201,255,0.10) 0%, rgba(185,201,255,0.05) 40%, transparent 68%)';

/** A stylized QR glyph, drawn from squares — the Scan control and nav icon. */
export function QrGlyph({ size, color = palette.ground }: { size: number; color?: string }) {
	const unit = size / 9; // 9-cell grid, three 3x3 finder-like blocks + a dot
	const box = (top: number, left: number, cells: number) => ({
		position: 'absolute' as const,
		top: unit * top,
		left: unit * left,
		width: unit * cells,
		height: unit * cells,
		borderWidth: Math.max(unit * 0.5, 1.5),
		borderColor: color,
		borderRadius: unit * 0.35
	});
	const dot = (top: number, left: number, cells = 1) => ({
		position: 'absolute' as const,
		top: unit * top,
		left: unit * left,
		width: unit * cells,
		height: unit * cells,
		backgroundColor: color,
		borderRadius: unit * 0.3
	});
	return (
		<View style={{ width: size, height: size }}>
			<View style={box(0, 0, 3)} />
			<View style={dot(1, 1)} />
			<View style={box(0, 6, 3)} />
			<View style={dot(1, 7)} />
			<View style={box(6, 0, 3)} />
			<View style={dot(7, 1)} />
			{/* scattered data cells, bottom-right quadrant */}
			<View style={dot(6, 6, 1.2)} />
			<View style={dot(6, 8, 1)} />
			<View style={dot(8, 6, 1)} />
			<View style={dot(8, 8, 1.2)} />
		</View>
	);
}

export interface FieldProps extends TextInputProps {
	label: string;
	/** Shown under the field in the danger colour; also marks the field invalid. */
	error?: string | null;
	/** Shown under the field when there is no error. */
	hint?: string | null;
	/** Trailing status text, e.g. a live availability check. */
	status?: ReactNode;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
	{ label, error, hint, status, style, ...rest },
	ref
) {
	return (
		<View style={styles.field}>
			<View style={styles.fieldHead}>
				<Text style={styles.fieldLabel}>{label}</Text>
				{status}
			</View>
			<TextInput
				ref={ref}
				style={[styles.input, !!error && styles.inputError, style]}
				placeholderTextColor={palette.textGhost}
				selectionColor={palette.holo}
				accessibilityLabel={label}
				{...rest}
			/>
			{error ? (
				<Text style={styles.errorText}>{error}</Text>
			) : hint ? (
				<Text style={styles.hintText}>{hint}</Text>
			) : null}
		</View>
	);
});

/** A flat raised surface with a real hairline. */
export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
	return <View style={[styles.panel, style]}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
	return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
	return <Text style={styles.body}>{children}</Text>;
}

export function Meta({ children }: { children: ReactNode }) {
	return <Text style={styles.metaText}>{children}</Text>;
}

/** A form-level error, distinct from a per-field one. */
export function FormError({ message }: { message?: string | null }) {
	if (!message) return null;
	return (
		<View style={styles.formError} accessibilityLiveRegion="polite">
			<Text style={styles.formErrorText}>{message}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	btn: {
		minHeight: 46,
		borderRadius: radius.xxl,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 28,
		paddingVertical: 11,
		borderWidth: 1.5,
		borderColor: 'transparent'
	},
	btnPrimary: { backgroundColor: palette.holo, borderColor: palette.holo },
	btnSecondary: { backgroundColor: 'transparent', borderColor: palette.line },
	btnGhost: { backgroundColor: 'transparent', borderWidth: 0 },
	btnPressed: { opacity: 0.82 },
	btnOff: { opacity: 0.45 },
	btnText: { ...type.bodyStrong, color: palette.textPrimary },
	btnTextPrimary: { fontFamily: 'Outfit-Bold', color: palette.ground, letterSpacing: 0.3 },
	btnTextGhost: { color: palette.holo },

	holoBtn: {
		minHeight: 48,
		borderRadius: 26,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 36,
		paddingVertical: 13,
		boxShadow: shadow.cta,
		...({ experimental_backgroundImage: HOLO_GRADIENT } as object)
	},
	holoBtnText: { ...type.cta, color: palette.ground },

	chipBtn: {
		backgroundColor: palette.surface,
		borderWidth: 1,
		borderColor: palette.line,
		borderRadius: radius.xl,
		paddingHorizontal: 14,
		paddingVertical: 8
	},
	chipBtnText: { ...type.bodyStrong, color: palette.textDim },

	chip: {
		backgroundColor: palette.surface,
		borderWidth: 1,
		borderColor: palette.line,
		borderRadius: radius.xl,
		paddingHorizontal: 15,
		paddingVertical: 6
	},
	chipOn: { backgroundColor: palette.holo, borderColor: palette.holo },
	chipText: { fontFamily: 'Outfit-SemiBold', fontSize: 12, color: palette.textDim },
	chipTextOn: { fontFamily: 'Outfit-Bold', color: palette.ground },

	iconCircle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: palette.surface,
		borderWidth: 1,
		borderColor: palette.line,
		alignItems: 'center',
		justifyContent: 'center'
	},
	iconCircleOn: { borderColor: palette.holo },

	countBadge: {
		backgroundColor: palette.surface,
		borderWidth: 1,
		borderColor: palette.line,
		borderRadius: radius.md,
		paddingHorizontal: 10,
		paddingVertical: 2
	},
	countBadgeText: { fontFamily: 'Outfit-SemiBold', fontSize: 11, color: palette.textDim },

	screenHeader: {
		minHeight: 44,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: space.md
	},
	screenHeaderText: { flexShrink: 1 },
	screenHeaderEyebrow: { ...type.meta, color: palette.textFaint, marginBottom: 2 },
	screenTitle: { ...type.title, color: palette.textPrimary },

	ambientGlow: {
		position: 'absolute',
		width: 320,
		height: 320,
		borderRadius: 160
	},

	field: { gap: space.xs },
	fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
	fieldLabel: { ...type.meta, color: palette.textDim },
	input: {
		minHeight: 48,
		backgroundColor: palette.raised,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: palette.line,
		paddingHorizontal: space.md,
		...type.body,
		color: palette.textPrimary
	},
	inputError: { borderColor: palette.danger },
	errorText: { ...type.small, color: palette.danger },
	hintText: { ...type.small, color: palette.textFaint },

	panel: {
		backgroundColor: palette.surface,
		borderRadius: radius.lg,
		borderWidth: 1,
		borderColor: palette.line,
		padding: space.lg,
		gap: space.md
	},
	heading: { ...type.title, color: palette.textPrimary },
	body: { ...type.body, color: palette.textDim },
	metaText: { ...type.meta, color: palette.textFaint },

	formError: {
		backgroundColor: 'rgba(255, 92, 92, 0.12)',
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: palette.danger,
		padding: space.md
	},
	formErrorText: { ...type.small, color: palette.textPrimary }
});
