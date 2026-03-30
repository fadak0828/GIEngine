import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AssetManifest, AssetDefinition } from '@gi-engine/core';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

/**
 * Reads asset files from disk and converts them to base64 data URIs.
 * Returns a new AssetManifest with inline data populated.
 */
export async function inlineAssets(
  manifest: AssetManifest,
  baseDir: string
): Promise<AssetManifest> {
  const inlinedItems: Record<string, AssetDefinition> = {};

  for (const [id, asset] of Object.entries(manifest.items)) {
    const filePath = path.resolve(baseDir, asset.src);

    try {
      const buffer = await fs.readFile(filePath);
      const base64 = buffer.toString('base64');
      const mimeType = asset.mimeType || guessMimeType(filePath);

      inlinedItems[id] = {
        ...asset,
        mimeType,
        inline: `data:${mimeType};base64,${base64}`,
        size: buffer.byteLength,
      };
    } catch {
      // If asset file not found, keep asset as-is without inline data
      console.warn(`[asset-inliner] Could not read asset "${id}" at ${filePath}, skipping inline.`);
      inlinedItems[id] = { ...asset };
    }
  }

  return { items: inlinedItems };
}

/**
 * Calculates total size of all inlined assets in bytes.
 */
export function getInlinedAssetsSize(manifest: AssetManifest): number {
  let total = 0;
  for (const asset of Object.values(manifest.items)) {
    if (asset.size) {
      total += asset.size;
    }
  }
  return total;
}
