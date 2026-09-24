/**
 * Stage C1.2: the tilt-holo finishes, as one SkSL runtime shader per recipe.
 *
 * The shader and every look value live in `foil-sksl.ts`; this file is the
 * React Native half: it compiles the source for the chosen recipe, binds the
 * recipe's texture as a child shader, and feeds the uniforms from the card's
 * tilt. Like the other Skia engines it is an *additive light overlay*: it
 * draws no card, only the light the laminate throws back, and the caller
 * screen-blends it over the real face.
 *
 * If a compile fails, the canvas is replaced by a red panel quoting the error
 * and the offending source line. It is never a silent white rectangle.
 */

import {
	Canvas,
	Fill,
	ImageShader,
	Shader,
	Skia,
	useClock,
	useImage
} from '@shopify/react-native-skia';
import type { SkMatrix, SkRuntimeEffect } from '@shopify/react-native-skia';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { palette } from '../../theme/palette';
import { space, type } from '../../theme/tokens';
import { TILT_RANGE } from '../FlipCard';
import {
	buildSource,
	SKIA_RECIPES,
	SKIA_TEXTURE_LAYOUT,
	type SkiaRecipeName,
	type SkiaTextureName
} from './foil-sksl';

export { SKIA_RECIPE_NAMES, type SkiaRecipeName } from './foil-sksl';

/** The bundled textures. Metro resolves these; Node (scripts/foil-sksl.js)
 *  never sees this file, which is why they are not in foil-sksl.ts. */
const TEXTURE_SOURCES: Record<SkiaTextureName, number> = {
	spray: require('../../../assets/foil/sprayed.png'),
	stars: require('../../../assets/foil/stars.png'),
	mosaic: require('../../../assets/foil/mosaic.png')
};

/**
 * Whether a Skia runtime exists at all. On native it always does. On the web
 * target `Skia` is a wrapper around `global.CanvasKit`, which is only set once
 * CanvasKit has been loaded — this app never loads it, so every call would
 * throw. The foil steps aside there rather than showing an error panel.
 */
export const SKIA_AVAILABLE =
	Platform.OS !== 'web' || typeof (globalThis as { CanvasKit?: unknown }).CanvasKit !== 'undefined';

interface Compiled {
	effect: SkRuntimeEffect | null;
	error: string | null;
	source: string;
}

/** Compiled once per recipe per module instance; Fast Refresh resets the
 *  cache on save, and a changed source recompiles. */
const compiled = new Map<SkiaRecipeName, Compiled>();

function foilEffect(name: SkiaRecipeName): Compiled {
	const source = buildSource(name);
	const hit = compiled.get(name);
	if (hit && hit.source === source) return hit;

	let effect: SkRuntimeEffect | null = null;
	let error: string | null = null;
	try {
		effect = Skia.RuntimeEffect.Make(source) ?? null;
		if (!effect) error = 'RuntimeEffect.Make returned null.';
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
	}
	if (!effect) console.warn(`[SkiaFoil:${name}] SkSL did not compile\n${error}`);

	const entry = { effect, error, source };
	compiled.set(name, entry);
	return entry;
}

export interface SkiaFoilProps {
	recipe: SkiaRecipeName;
	width: number;
	height: number;
	/** Card tilt, owned by FlipCard — the same signal the foil engines read. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	/** Corner radius of the face this sits over, so the shine follows its edge. */
	radius?: number;
	/**
	 * `drift` wanders the light slowly when nobody is touching the card, which
	 * means redrawing every frame. `still` holds it, so a grid of thumbnails
	 * only redraws when its tilt changes.
	 */
	idle?: 'drift' | 'still';
}

export function SkiaFoil({ idle = 'drift', ...props }: SkiaFoilProps) {
	// Split so the frame clock only exists on canvases that drift; hooks
	// cannot be conditional inside one component.
	return idle === 'drift' ? <DriftingFoil {...props} /> : <StillFoil {...props} />;
}

type CanvasProps = Omit<SkiaFoilProps, 'idle'>;

function DriftingFoil(props: CanvasProps) {
	const clock = useClock();
	return <FoilCanvas {...props} clock={clock} />;
}

function StillFoil(props: CanvasProps) {
	const clock = useSharedValue(0);
	return <FoilCanvas {...props} clock={clock} />;
}

function FoilCanvas({
	recipe,
	width,
	height,
	rx,
	ry,
	radius = width * 0.06,
	clock
}: CanvasProps & { clock: SharedValue<number> }) {
	const { effect, error, source } = foilEffect(recipe);
	if (!effect) return <ShaderError message={error} source={source} width={width} height={height} />;

	return (
		<Canvas style={{ width, height }}>
			<FoilFill
				recipe={recipe}
				width={width}
				height={height}
				radius={radius}
				rx={rx}
				ry={ry}
				clock={clock}
			/>
		</Canvas>
	);
}

export interface FoilFillProps {
	recipe: SkiaRecipeName;
	/** The light field in px: the card this foil belongs to. */
	width: number;
	height: number;
	/** Corner radius of that card's face. */
	radius?: number;
	/** The card's tilt, so every foil on one card shares one light. */
	rx: SharedValue<number>;
	ry: SharedValue<number>;
	/** Milliseconds; drives the idle drift. Hold it still to hold the light. */
	clock: SharedValue<number>;
	/**
	 * 1 (a card): clip to the card's rounded face and light its rim. 0 (a
	 * sticker): no card clip or rim — the sticker's own mask shapes it, and it
	 * may hang past the card's edge.
	 */
	edge?: 0 | 1;
	/**
	 * The shader's local matrix: where the light field (card coordinates) sits
	 * in this canvas. Omit on a card, whose canvas *is* the field. A sticker
	 * passes the inverse of its placement, so each of its pixels is lit as the
	 * point of the card it covers.
	 */
	matrix?: SkMatrix | SharedValue<SkMatrix>;
	/**
	 * Where the material (flecks, stars, facets) is anchored, in card
	 * coordinates. Omit on a card (pinned to the face, as it always was). A
	 * sticker passes its own centre and rotation, so its flecks travel with it
	 * at the card's fleck size rather than shrinking to the sticker's.
	 */
	textureMatrix?: SkMatrix | SharedValue<SkMatrix>;
}

/**
 * The foil as a Skia element, for drawing inside any canvas: the card's own
 * canvas (SkiaFoil) and a sticker's (src/stickers/StickerFoil.tsx) run this
 * one component, with this one shader, so a foil on a sticker is the same
 * foil as on a card, lit by the same light.
 */
export function FoilFill({
	recipe,
	width,
	height,
	radius = width * 0.06,
	rx,
	ry,
	clock,
	edge = 1,
	matrix,
	textureMatrix
}: FoilFillProps) {
	const { effect } = foilEffect(recipe);
	const textureName = SKIA_RECIPES[recipe].texture;

	// `useImage` decodes asynchronously and is null for a frame or two on a
	// cold mount. Hooks must run unconditionally, so a texture-less recipe
	// still calls it, with nothing to load.
	const texture = useImage(textureName ? TEXTURE_SOURCES[textureName] : null);

	const uniforms = useDerivedValue(() => ({
		u_resolution: [width, height],
		u_radius: radius,
		u_time: clock.value / 1000,
		// FlipCard's ry is +right and rx is +up; the shader wants the finger
		// in screen space with y down, so rx flips.
		u_tilt: [ry.value / TILT_RANGE, -rx.value / TILT_RANGE],
		u_edge: edge
	}));

	if (!effect || (textureName && !texture)) return null;

	// The rect the ImageShader draws into is what maps the texture onto the
	// card. Doing it here rather than in the shader keeps the sampling at
	// plain `fragCoord`, which is what makes the pinning obvious on inspection.
	// Anchored to a sticker, the rect is centred on the sticker instead of
	// starting at the card's corner.
	let child = null;
	if (textureName && texture) {
		const layout = SKIA_TEXTURE_LAYOUT[textureName];
		const anchored = textureMatrix !== undefined;
		if (layout.fit === 'face') {
			child = (
				<ImageShader
					image={texture}
					rect={{ x: anchored ? -width / 2 : 0, y: anchored ? -height / 2 : 0, width, height }}
					fit="fill"
					tx="clamp"
					ty="clamp"
					matrix={textureMatrix}
				/>
			);
		} else {
			const tileWidth = width / layout.tiles;
			child = (
				<ImageShader
					image={texture}
					rect={{ x: 0, y: 0, width: tileWidth, height: tileWidth / layout.aspect }}
					fit="fill"
					tx="repeat"
					ty="repeat"
					matrix={textureMatrix}
				/>
			);
		}
	}

	return (
		<Fill>
			<Shader source={effect} uniforms={uniforms} matrix={matrix}>
				{child}
			</Shader>
		</Fill>
	);
}

/** A compile failure is otherwise a white rectangle. */
function ShaderError({
	message,
	source,
	width,
	height
}: {
	message: string | null;
	source: string;
	width: number;
	height: number;
}) {
	return (
		<ScrollView style={[styles.error, { width, height }]}>
			<Text style={styles.errorTitle}>SKSL DID NOT COMPILE</Text>
			<Text selectable style={styles.errorBody}>
				{message ?? 'No error text was reported.'}
			</Text>
			<Text style={styles.errorSource}>{quoteSource(message, source)}</Text>
		</ScrollView>
	);
}

/** The three source lines around the first line number in a Skia error. */
function quoteSource(message: string | null, source: string): string {
	const line = Number(message?.match(/error:\s*(\d+):/)?.[1]);
	if (!line) return '';
	const lines = source.split('\n');
	const from = Math.max(0, line - 3);
	return lines
		.slice(from, line + 2)
		.map((text, i) => `${from + i + 1 === line ? '>' : ' '} ${from + i + 1}  ${text}`)
		.join('\n');
}

const styles = StyleSheet.create({
	error: {
		padding: space.md,
		backgroundColor: palette.raised,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: palette.danger
	},
	errorTitle: { ...type.meta, color: palette.danger, marginBottom: space.xs },
	errorBody: { ...type.body, color: palette.textPrimary, marginBottom: space.sm },
	errorSource: { ...type.small, color: palette.textDim }
});
