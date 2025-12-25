import type { App, TFile } from 'obsidian';

/**
 * Load avatar image from vault and return as data URL
 * @param app Obsidian App instance
 * @param folderPath Character folder path (e.g., "characters/alice")
 * @param avatarFilename Avatar filename from frontmatter (e.g., "avatar.png")
 * @returns Data URL string or undefined if not found
 */
export async function loadAvatarAsDataUrl(
  app: App,
  folderPath: string,
  avatarFilename: string | undefined
): Promise<string | undefined> {
  if (!avatarFilename) return undefined;

  const avatarPath = `${folderPath}/${avatarFilename}`;
  const file = app.vault.getAbstractFileByPath(avatarPath);

  if (!file || !(file instanceof Object && 'extension' in file)) {
    return undefined;
  }

  try {
    const tFile = file as TFile;
    const arrayBuffer = await app.vault.readBinary(tFile);
    const mimeType = getMimeType(tFile.extension);
    const base64 = arrayBufferToBase64(arrayBuffer);
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to load avatar:', error);
    return undefined;
  }
}

/**
 * Get Obsidian resource URL for avatar (alternative to data URL)
 * Uses Obsidian's internal resource handling
 */
export function getAvatarResourceUrl(
  app: App,
  folderPath: string,
  avatarFilename: string | undefined
): string | undefined {
  if (!avatarFilename) return undefined;

  const avatarPath = `${folderPath}/${avatarFilename}`;
  const file = app.vault.getAbstractFileByPath(avatarPath);

  if (!file) return undefined;

  return app.vault.getResourcePath(file as TFile);
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return mimeTypes[extension.toLowerCase()] || 'image/png';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
