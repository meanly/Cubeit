/** Web preview: there's no app file system, so photos keep their (blob/data) URI and nothing needs deleting. */
export function deleteLocalFile(_uri: string | null | undefined): void {}

export function keepJournalImage(uri: string): string {
  return uri;
}

export function deleteAllJournalImages(): void {}
