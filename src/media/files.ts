import { Directory, File, Paths } from 'expo-file-system';

/**
 * Small helpers around expo-file-system for media the app keeps or throws
 * away: temporary recordings and photos are deleted as soon as they've been
 * used; photos attached to journal entries are copied into the app's own
 * documents folder (never the photo library) and deleted with the entry.
 */

const JOURNAL_DIR = 'journal-images';

/** Delete a local file if it exists. Never throws — cleanup is best-effort. */
export function deleteLocalFile(uri: string | null | undefined): void {
  if (!uri || !uri.startsWith('file:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('[cubeit] could not delete a temporary file', error);
  }
}

/** Copy a (temporary) image into the journal's folder and return the kept copy's URI. */
export function keepJournalImage(uri: string): string {
  const dir = new Directory(Paths.document, JOURNAL_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const source = new File(uri);
  const ext = source.extension || '.jpg';
  const target = new File(dir, `img_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}${ext}`);
  source.copy(target);
  return target.uri;
}

/** Remove every kept journal photo (used by "Start over"). */
export function deleteAllJournalImages(): void {
  try {
    const dir = new Directory(Paths.document, JOURNAL_DIR);
    if (dir.exists) dir.delete();
  } catch (error) {
    console.warn('[cubeit] could not clear journal images', error);
  }
}
