/**
 * Picking a card photo and putting it in Storage.
 *
 * Objects are keyed `<owner_id>/<card_id>/<timestamp>.<ext>`. The first segment
 * is what every `card-art` storage policy checks
 * (`supabase/migrations/20260915000000_card_links_and_art.sql`), so the key
 * layout is not cosmetic — flattening it would lock every upload out.
 *
 * The timestamp means a replacement never overwrites the key the old image was
 * served from. That matters because a card's photo is baked into collection
 * snapshots by url: overwriting in place would silently repaint a card someone
 * collected months ago, which is exactly the drift `CardView` exists to prevent.
 * The cost is orphaned objects, which a later sweep can collect.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { requireSupabase } from './supabase';

const BUCKET = 'card-art';

/** What `expo-image-picker` gives back, reduced to what the upload needs. */
export interface PickedPhoto {
	/** Local file uri, for showing the new photo before the upload finishes. */
	uri: string;
	base64: string;
	mimeType: string;
}

export class PhotoPermissionError extends Error {
	constructor() {
		super('Concard needs permission to open your photos.');
		this.name = 'PhotoPermissionError';
	}
}

/**
 * Open the library and return the chosen image, or null if the user backed out.
 *
 * No OS crop step. The card spec stores a photo as a focal point plus zoom
 * (`art_x` / `art_y` / `art_scale`), not a crop rectangle, because the photo
 * zone's height moves with the divider and its shape can change: a crop baked
 * in at upload would be the wrong aspect the moment either did. The whole image
 * is uploaded, and framing happens on the card itself (drag and pinch).
 */
export async function pickCardPhoto(): Promise<PickedPhoto | null> {
	const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
	if (!permission.granted) throw new PhotoPermissionError();

	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ['images'],
		allowsEditing: false,
		exif: false
	});

	if (result.canceled || !result.assets.length) return null;
	const asset = result.assets[0];

	// Without the OS crop a full camera photo would come through whole, which
	// is far past the bucket's 5 MB cap. A card photo is at most ~210 units
	// wide at 3× zoom on a dense screen, so a 1600px long edge loses nothing.
	const long = Math.max(asset.width, asset.height);
	const context = ImageManipulator.manipulate(asset.uri);
	if (long > MAX_EDGE) {
		context.resize(
			asset.width >= asset.height
				? { width: MAX_EDGE, height: null }
				: { width: null, height: MAX_EDGE }
		);
	}
	const image = await context.renderAsync();
	const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
	if (!saved.base64) throw new Error('That image could not be read.');

	return { uri: saved.uri, base64: saved.base64, mimeType: 'image/jpeg' };
}

/** Longest edge a card photo is uploaded at, in px. */
const MAX_EDGE = 1600;

/** Upload a picked photo and return its public url. */
export async function uploadCardPhoto(
	photo: PickedPhoto,
	ownerId: string,
	cardId: string
): Promise<string> {
	const client = requireSupabase();
	const key = `${ownerId}/${cardId}/${Date.now()}.${extFor(photo.mimeType)}`;

	const { error } = await client.storage.from(BUCKET).upload(key, base64ToBytes(photo.base64), {
		contentType: photo.mimeType,
		upsert: false
	});
	if (error) throw error;

	const { data } = client.storage.from(BUCKET).getPublicUrl(key);
	return data.publicUrl;
}

function extFor(mime: string): string {
	return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64 → bytes, by hand.
 *
 * Hermes has no `atob`, and `fetch()` on a `file://` uri is not dependable
 * across both platforms, so the usual web recipes for turning a picked image
 * into an upload body don't apply. supabase-js accepts a `Uint8Array` directly,
 * which makes this the whole of the conversion — and it keeps a base64 polyfill
 * out of the dependency list for the sake of one function.
 */
function base64ToBytes(base64: string): Uint8Array {
	const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
	const pad = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
	const bytes = new Uint8Array((clean.length * 3) / 4 - pad);

	let byte = 0;
	for (let i = 0; i < clean.length; i += 4) {
		const chunk =
			(B64.indexOf(clean[i]) << 18) |
			(B64.indexOf(clean[i + 1]) << 12) |
			(B64.indexOf(clean[i + 2]) << 6) |
			B64.indexOf(clean[i + 3]);

		if (byte < bytes.length) bytes[byte++] = (chunk >> 16) & 0xff;
		if (byte < bytes.length) bytes[byte++] = (chunk >> 8) & 0xff;
		if (byte < bytes.length) bytes[byte++] = chunk & 0xff;
	}

	return bytes;
}
