import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { deleteLocalFile } from './files';
import { cleanOcrLines } from './ocrText';

/**
 * Photo input for the assistant. Photos are picked or taken with
 * expo-image-picker, copied into a normalized JPEG (upright, at most 2000 px)
 * with expo-image-manipulator, and read with on-device OCR (Apple Vision on
 * iOS, ML Kit on Android) through expo-text-extractor. Nothing is uploaded.
 * This is text recognition only — no image understanding.
 */

export class ImageInputError extends Error {}

type OcrModule = typeof import('expo-text-extractor');
let ocr: OcrModule | null | undefined;
function ocrModule(): OcrModule | null {
  if (ocr !== undefined) return ocr;
  try {
    // Loaded lazily: the native module is missing in Expo Go, and importing it eagerly would crash there.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ocr = require('expo-text-extractor') as OcrModule;
  } catch {
    ocr = null;
  }
  return ocr;
}

export function ocrAvailability(): { ok: true } | { ok: false; reason: string } {
  const m = ocrModule();
  if (!m || !m.isSupported) return { ok: false, reason: 'Text recognition needs the Cubeit app build (Expo Go can’t run it).' };
  return { ok: true };
}

/** Let the user take or choose one photo. Returns null if they cancel. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<{ uri: string; width: number } | null> {
  if (source === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new ImageInputError('Cubeit needs camera access to take a photo. You can allow it in the Settings app.');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
    return r.canceled || !r.assets[0] ? null : { uri: r.assets[0].uri, width: r.assets[0].width };
  }
  // The iOS photo picker runs out of process and doesn't need library permission.
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false, allowsMultipleSelection: false });
  return r.canceled || !r.assets[0] ? null : { uri: r.assets[0].uri, width: r.assets[0].width };
}

/** An upright, size-limited JPEG copy in the cache (OCR reads raw pixels and ignores rotation metadata). */
export async function normalizePhoto(uri: string, width?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && width > 2000) ctx.resize({ width: 2000 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

/** Recognize text in a local image. Returns cleaned lines (possibly empty). */
export async function recognizeText(uri: string): Promise<string[]> {
  const m = ocrModule();
  if (!m || !m.isSupported) throw new ImageInputError('Text recognition isn’t available in this build.');
  try {
    return cleanOcrLines(await m.extractTextFromImage(uri));
  } catch (error) {
    throw new ImageInputError(`Couldn’t read text from that photo${error instanceof Error && error.message ? ` (${error.message})` : ''}.`);
  }
}

/** Delete temporary copies once they're no longer needed. */
export function discardPhotos(...uris: (string | null | undefined)[]): void {
  uris.forEach(deleteLocalFile);
}
