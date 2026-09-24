/**
 * Where a baked sticker image comes from.
 *
 * Asset paths are object paths in the public `stickers` bucket
 * (`<id>/<hash>-<kind>.webp`). Objects there are never overwritten, so a path
 * is as permanent as a URL; the client supplies the host. Bundled fixtures
 * (src/stickers/fixtures.generated.ts) use the same paths and win, so dev
 * screens and a Supabase-less editor draw real art offline.
 */

import type { ImageSourcePropType } from 'react-native';

import { SUPABASE_URL } from '@/lib/env';
import { FIXTURE_FILES } from './fixtures.generated';

export const STICKER_BUCKET = 'stickers';

export function stickerAssetUrl(path: string): string | null {
	if (!SUPABASE_URL) return null;
	return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${STICKER_BUCKET}/${path}`;
}

export function stickerAsset(path: string | null | undefined): ImageSourcePropType | null {
	if (!path) return null;
	const fixture = FIXTURE_FILES[path];
	if (fixture !== undefined) return fixture;
	const url = stickerAssetUrl(path);
	return url ? { uri: url } : null;
}
