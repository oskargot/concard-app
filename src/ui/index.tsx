/**
 * The small set of chrome the app needs around its cards.
 *
 * Design bible §12: medium rounded corners, subtle glow on interactive
 * elements, and "cards are always the loudest thing on screen — everything else
 * supports them". So these are deliberately quiet: flat raised surfaces with a
 * real hairline, one accent, no gradients. The holo gradient is reserved for
 * tier reveals and celebration, never for ordinary chrome.
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

import { palette } from '../theme/palette';
import { radius, space, type } from '../theme/tokens';

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
				<ActivityIndicator color={variant === 'primary' ? palette.void : palette.cream} />
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
				placeholderTextColor={palette.creamFaint}
				selectionColor={palette.teal}
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

/** A flat raised surface with a real hairline — "panels are stock, not glass". */
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
		minHeight: 48,
		borderRadius: radius.md,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: space.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: 'transparent'
	},
	btnPrimary: {
		backgroundColor: palette.rose,
		boxShadow: `0 0 18px ${palette.roseGlow}`
	},
	btnSecondary: {
		backgroundColor: palette.raisedHigh,
		borderColor: palette.line
	},
	btnGhost: { backgroundColor: 'transparent' },
	btnPressed: { opacity: 0.82 },
	btnOff: { opacity: 0.45 },
	btnText: { ...type.bodyStrong, color: palette.cream },
	btnTextPrimary: { color: palette.void, fontFamily: 'Fredoka-Bold', fontSize: 16 },
	btnTextGhost: { color: palette.teal },

	field: { gap: space.xs },
	fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
	fieldLabel: { ...type.meta, color: palette.creamMute },
	input: {
		minHeight: 48,
		backgroundColor: palette.raisedHigh,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		paddingHorizontal: space.md,
		...type.body,
		color: palette.cream
	},
	inputError: { borderColor: palette.danger },
	errorText: { ...type.small, color: palette.danger },
	hintText: { ...type.small, color: palette.creamFaint },

	panel: {
		backgroundColor: palette.raised,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.line,
		padding: space.lg,
		gap: space.md
	},
	heading: { ...type.title, color: palette.cream },
	body: { ...type.body, color: palette.creamMute },
	metaText: { ...type.meta, color: palette.creamFaint },

	formError: {
		backgroundColor: 'rgba(255, 92, 92, 0.12)',
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.danger,
		padding: space.md
	},
	formErrorText: { ...type.small, color: palette.cream }
});
