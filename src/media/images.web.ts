import * as ImagePicker from 'expo-image-picker';

/** Web preview: photos can be picked, but on-device OCR is phone-only. */
export class ImageInputError extends Error {}

export function ocrAvailability(): { ok: true } | { ok: false; reason: string } {
  return { ok: false, reason: 'Reading text from photos works in the phone app only.' };
}

export async function pickPhoto(_source: 'camera' | 'library'): Promise<{ uri: string; width: number } | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  return r.canceled || !r.assets[0] ? null : { uri: r.assets[0].uri, width: r.assets[0].width };
}

export async function normalizePhoto(uri: string): Promise<string> {
  return uri;
}

export async function recognizeText(_uri: string): Promise<string[]> {
  throw new ImageInputError('Reading text from photos works in the phone app only.');
}

export function discardPhotos(..._uris: (string | null | undefined)[]): void {}
