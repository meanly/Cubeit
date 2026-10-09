import { Directory, File, Paths, type DownloadTask } from 'expo-file-system';

import { MODEL } from './modelInfo';
import { Sha256 } from './sha256';

/**
 * The model file lives in the app's own Documents/models folder. It is
 * downloaded only when the user asks, verified (exact size + SHA-256) before
 * first use, and can be deleted from Settings. User data exports never
 * include it.
 */

const dir = () => new Directory(Paths.document, 'models');
export const modelFile = () => new File(dir(), MODEL.fileName);
const partFile = () => new File(dir(), `${MODEL.fileName}.part`);
const markerFile = () => new File(dir(), `${MODEL.fileName}.sha256`);

/** Path llama.rn loads from. */
export const modelUri = () => modelFile().uri;

/** The model is on disk and was verified earlier (marker written after a successful hash check). */
export function isModelInstalled(): boolean {
  try {
    const f = modelFile();
    if (!f.exists || f.size !== MODEL.sizeBytes) return false;
    const marker = markerFile();
    return marker.exists && marker.textSync().trim() === MODEL.sha256;
  } catch {
    return false;
  }
}

/** A complete but unverified download (e.g. finished while the app was suspended). */
export function hasCompletePart(): boolean {
  try {
    const p = partFile();
    return p.exists && p.size === MODEL.sizeBytes;
  } catch {
    return false;
  }
}

export function freeSpaceOk(): boolean {
  try {
    return Paths.availableDiskSpace > MODEL.sizeBytes + 300_000_000;
  } catch {
    return true;
  }
}

let task: DownloadTask | null = null;
let controller: AbortController | null = null;

export class DownloadCancelled extends Error {}

/** Download the model to a temporary file. Progress is reported in bytes. */
export async function downloadModel(onProgress: (received: number, total: number) => void): Promise<void> {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  const part = partFile();
  if (part.exists) part.delete();
  controller = new AbortController();
  task = File.createDownloadTask(MODEL.url, part, {
    onProgress: ({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes > 0 ? totalBytes : MODEL.sizeBytes),
    signal: controller.signal,
  });
  try {
    const result = await task.downloadAsync();
    if (!result) throw new DownloadCancelled('Download paused.');
  } catch (error) {
    if (controller?.signal.aborted) throw new DownloadCancelled('Download cancelled.');
    throw error;
  } finally {
    task = null;
    controller = null;
  }
}

export function cancelDownload(): void {
  controller?.abort();
  try {
    task?.cancel();
  } catch {
    // Already finished.
  }
}

/**
 * Check the downloaded file's size and SHA-256 in 4 MB chunks (yielding
 * between chunks so the app stays responsive), then move it into place.
 * A file that doesn't match is deleted.
 */
export async function verifyAndInstall(onProgress: (fraction: number) => void): Promise<void> {
  const part = partFile();
  if (!part.exists) throw new Error('The download is missing. Please try again.');
  if (part.size !== MODEL.sizeBytes) {
    part.delete();
    throw new Error('The download was incomplete. Please try again.');
  }
  const hash = new Sha256();
  const handle = part.open();
  const chunk = 4 * 1024 * 1024;
  try {
    let read = 0;
    while (read < MODEL.sizeBytes) {
      const bytes = handle.readBytes(Math.min(chunk, MODEL.sizeBytes - read));
      if (bytes.length === 0) break;
      hash.update(bytes);
      read += bytes.length;
      onProgress(read / MODEL.sizeBytes);
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    handle.close();
  }
  const digest = hash.digestHex();
  if (digest !== MODEL.sha256) {
    part.delete();
    throw new Error('The downloaded file didn’t match the expected checksum, so it was deleted. Please try again.');
  }
  const target = modelFile();
  if (target.exists) target.delete();
  part.move(target);
  const marker = markerFile();
  if (!marker.exists) marker.create();
  marker.write(digest);
}

export function deleteModel(): void {
  for (const f of [modelFile(), partFile(), markerFile()]) {
    try {
      if (f.exists) f.delete();
    } catch {
      // Best effort.
    }
  }
}
