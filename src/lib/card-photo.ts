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
 * `allowsEditing` hands framing to the OS crop UI rather than building a
 * pan/zoom gesture onto the card's photo well — that well is already a tap
 * target for this picker, and the two gestures would fight. The aspect follows
 * the card's own photo shape so what gets cropped is what gets drawn:
 * `circle` is a square well, every other shape is the 47.33cqw letterbox strip.
 *
 * `art_x` / `art_y` / `art_scale` stay at their defaults as a result. They are
 * still honoured by the renderer and by the web card, so an in-app pan/zoom can
 * be added later without touching the stored photo.
 */
export async function pickCardPhoto(photoShape: string): Promise<PickedPhoto | null> {
	const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
	if (!permission.granted) throw new PhotoPermissionError();

	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ['images'],
		allowsEditing: true,
		aspect: photoShape === 'circle' ? [1, 1] : [2, 1],
		// The bucket caps objects at 5 MB and a card photo is never rendered wider
		// than a phone screen, so there is nothing to gain from a full-size upload.
		quality: 0.8,
		base64: true,
		exif: false
	});

	if (result.canceled || !result.assets.length) return null;

	const asset = result.assets[0];
	if (!asset.base64) throw new Error('That image could not be read.');

	return {
		uri: asset.uri,
		base64: asset.base64,
		mimeType: allowedMime(asset.mimeType)
	};
}

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

/** The bucket's `allowed_mime_types`; anything else is sent as jpeg. */
function allowedMime(mime: string | null | undefined): string {
	return mime === 'image/png' || mime === 'image/webp' || mime === 'image/jpeg'
		? mime
		: 'image/jpeg';
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
