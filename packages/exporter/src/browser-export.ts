/**
 * Browser-safe export function for producing a single HTML file
 * from a GameDefinition without any Node.js dependencies.
 */
import type { GameDefinition } from '@gi-engine/core';
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
 * Export a GameDefinition to a single self-contained HTML string.
 * Runs entirely in the browser — no Node.js APIs used.
 */
export function browserExport(options: BrowserExportOptions): BrowserExportResult {
  const { gameDefinition, mode } = options;

  // 1. Serialize game data
  const gameDataJson = JSON.stringify(
    gameDefinition,
    null,
    mode === 'development' ? 2 : undefined,
  );

  // 2. Determine title and lang
  const title =
    gameDefinition.title?.ko ??
    gameDefinition.title?.en ??
    'GIEngine Game';
  const lang = gameDefinition.supportedLocales?.[0] ?? 'ko';

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
  // Assets are stored as base64, so actual binary size ≈ byteLength * 3/4.
  const assetsSize = Object.values(gameDefinition.assets?.items ?? {}).reduce(
    (sum, asset) => sum + (asset.inline ? byteLength(asset.inline) : 0),
    0,
  );
  // dataSize = game JSON minus the embedded asset bytes (meta, structure, etc.)
  const dataSize = Math.max(0, byteLength(gameDataJson) - assetsSize);

  const fileName = `${gameDefinition.id ?? 'game'}.html`;

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
