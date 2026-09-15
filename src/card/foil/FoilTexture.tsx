import { useId } from 'react';
import { Image, StyleSheet } from 'react-native';
import Svg, { Defs, Image as SvgImage, Pattern, Rect } from 'react-native-svg';

export type FoilTextureName =
	'glitter' | 'trainer' | 'cosmosBottom' | 'cosmosMiddle' | 'cosmosTop' | 'illusion' | 'grain';

const TEXTURES = {
	glitter: {
		source: require('../../../assets/foil/pokemon-cards-css/glitter.png'),
		aspect: 630 / 540
	},
	trainer: {
		source: require('../../../assets/foil/pokemon-cards-css/trainerbg.png'),
		aspect: 1
	},
	cosmosBottom: {
		source: require('../../../assets/foil/pokemon-cards-css/cosmos-bottom.png'),
		aspect: 734 / 1024
	},
	cosmosMiddle: {
		source: require('../../../assets/foil/pokemon-cards-css/cosmos-middle-trans.png'),
		aspect: 734 / 1024
	},
	cosmosTop: {
		source: require('../../../assets/foil/pokemon-cards-css/cosmos-top-trans.png'),
		aspect: 734 / 1024
	},
	illusion: {
		source: require('../../../assets/foil/pokemon-cards-css/illusion.png'),
		aspect: 1
	},
	grain: {
		source: require('../../../assets/foil/pokemon-cards-css/grain.webp'),
		aspect: 1
	}
} as const;

interface TiledFoilTextureProps {
	name: FoilTextureName;
	width: number;
	height: number;
	/** Width of one tile as a fraction of the card/layer width. */
	tileScale: number;
	opacity?: number;
}

/**
 * A card-relative raster tile rendered by one SVG pattern.
 *
 * React Native's `resizeMode="repeat"` repeats at the bitmap's intrinsic pixel
 * size, which makes a texture change density between thumbnails and hero cards.
 * An SVG pattern lets the tile scale with the card while preserving the source
 * image's aspect ratio on iOS, Android, and web.
 */
export function TiledFoilTexture({
	name,
	width,
	height,
	tileScale,
	opacity = 1
}: TiledFoilTextureProps) {
	const texture = TEXTURES[name];
	const id = `foil-texture-${name}-${useId().replace(/:/g, '')}`;
	const tileWidth = Math.max(1, width * tileScale);
	const tileHeight = tileWidth / texture.aspect;

	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
			<Defs>
				<Pattern
					id={id}
					x={0}
					y={0}
					width={tileWidth}
					height={tileHeight}
					patternUnits="userSpaceOnUse"
				>
					<SvgImage
						href={texture.source}
						width={tileWidth}
						height={tileHeight}
						preserveAspectRatio="xMidYMid meet"
					/>
				</Pattern>
			</Defs>
			<Rect width={width} height={height} fill={`url(#${id})`} opacity={opacity} />
		</Svg>
	);
}

interface CoverFoilTextureProps {
	name: Extract<FoilTextureName, 'cosmosBottom' | 'cosmosMiddle' | 'cosmosTop'>;
	opacity?: number;
}

/** Full-card source textures whose native aspect ratio already matches a card. */
export function CoverFoilTexture({ name, opacity = 1 }: CoverFoilTextureProps) {
	return (
		<Image
			source={TEXTURES[name].source}
			resizeMode="cover"
			style={[StyleSheet.absoluteFill, { opacity }]}
		/>
	);
}
