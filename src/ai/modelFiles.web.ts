/** Web preview: no model files (the runtime is native-only). */
export const modelUri = () => '';
export const isModelInstalled = () => false;
export const hasCompletePart = () => false;
export const freeSpaceOk = () => false;
export class DownloadCancelled extends Error {}
export async function downloadModel(_onProgress: (received: number, total: number) => void): Promise<void> {
  throw new Error('The on-device model runs only in the iOS / Android app.');
}
export function cancelDownload(): void {}
export async function verifyAndInstall(_onProgress: (fraction: number) => void): Promise<void> {
  throw new Error('The on-device model runs only in the iOS / Android app.');
}
export function deleteModel(): void {}
