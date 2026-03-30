/**
 * Browser-safe export function for producing a single HTML file
 * from a GameDefinition without any Node.js dependencies.
 */
import type { GameDefinition, AssetManifest, AssetDefinition } from '@gi-engine/core';
import { assembleHtml } from './template.js';
// @ts-ignore — Vite ?raw import; resolved at editor build time from pre-built runtime IIFE
import runtimeJs from '../../runtime/dist/index.iife.js?raw';
// @ts-ignore — Vite ?raw import; resolved at editor build time from pre-built runtime CSS
import runtimeCss from '../../runtime/dist/runtime.css?raw';

export interface BrowserExportOptions {
  gameDefinition: GameDefinition;
  mode: 'development' | 'production';
}

export interface BrowserExportResult {
  html: string;
  fileName: string;
  totalSize: number;
  breakdown: {
    js: number;
    css: number;
    assets: number;
    data: number;
  };
}

function byteLength(str: string): number {
  return new TextEncoder().encode(str).byteLength;
}

/**
 * Fetches each asset with a relative src path and converts it to a base64 data URI.
 * Uses fetch() + FileReader — both browser-native, no Node.js APIs.
 * Returns a new AssetManifest; the original is not mutated.
 */
async function inlineAssetsForBrowser(
  manifest: AssetManifest,
  baseUrl: string
): Promise<AssetManifest> {
  /**
   * Inline a single asset entry. Never throws — returns the original asset on failure.
   */
  async function inlineOne(id: string, asset: AssetDefinition): Promise<[string, AssetDefinition]> {
    // Already inlined — keep as-is (no redundant fetch)
    if (asset.inline) return [id, asset];
    // No src (unusual edge case) — keep as-is
    if (!asset.src) return [id, asset];
    // Already a data URI — keep as-is
    if (asset.src.startsWith('data:')) return [id, asset];

    try {
      const url = new URL(asset.src, baseUrl).href;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const mimeType =
        asset.mimeType ||
        response.headers.get('content-type')?.split(';')[0].trim() ||
        'application/octet-stream';

      // Use FileReader for reliable binary → base64 conversion (handles all byte values)
      const blob = new Blob([buffer], { type: mimeType });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      return [id, { ...asset, inline: dataUrl, size: buffer.byteLength }];
    } catch (err) {
      // Graceful degradation: warn and keep original src
      console.warn(
        `[browserExport] Could not inline asset "${id}" (src: "${asset.src}"): ${err}. Using src path.`
      );
      return [id, asset];
    }
  }

  // Fetch all assets in parallel — avoids serialising N network round-trips
  const entries = await Promise.all(
    Object.entries(manifest.items).map(([id, asset]) => inlineOne(id, asset))
  );

  const inlinedItems: Record<string, AssetDefinition> = Object.fromEntries(entries);
  return { items: inlinedItems };
}

/**
 * Export a GameDefinition to a single self-contained HTML string.
 * Runs entirely in the browser — no Node.js APIs used.
 */
export async function browserExport(options: BrowserExportOptions): Promise<BrowserExportResult> {
  const { gameDefinition, mode } = options;

  // 0. Inline all assets as base64 data URIs (browser fetch, no Node.js)
  const baseUrl = window.location.href;
  const inlinedManifest = await inlineAssetsForBrowser(gameDefinition.assets, baseUrl);
  const exportDef: GameDefinition = {
    ...gameDefinition,
    assets: inlinedManifest,
  };

  // 1. Serialize game data with inlined assets
  const gameDataJson = JSON.stringify(
    exportDef,
    null,
    mode === 'development' ? 2 : undefined,
  );

  // 2. Determine title and lang
  const title =
    exportDef.title?.ko ??
    exportDef.title?.en ??
    'GIEngine Game';
  const lang = exportDef.supportedLocales?.[0] ?? 'ko';

  // 3. Assemble HTML using the browser-safe template
  const html = assembleHtml({
    title,
    css: runtimeCss,
    js: runtimeJs,
    gameData: gameDataJson,
    lang,
  });

  // 4. Compute sizes (TextEncoder is browser-safe)
  const jsSize = byteLength(runtimeJs);
  const cssSize = byteLength(runtimeCss);
  const totalSize = byteLength(html);

  // Compute inlined asset bytes: sum of all base64 inline strings in the asset library.
  const assetsSize = Object.values(inlinedManifest.items).reduce(
    (sum, asset) => sum + (asset.inline ? byteLength(asset.inline) : 0),
    0,
  );
  // dataSize = game JSON minus the embedded asset bytes (meta, structure, etc.)
  const dataSize = Math.max(0, byteLength(gameDataJson) - assetsSize);

  const fileName = `${exportDef.id ?? 'game'}.html`;

  return {
    html,
    fileName,
    totalSize,
    breakdown: {
      js: jsSize,
      css: cssSize,
      assets: assetsSize,
      data: dataSize,
    },
  };
}
