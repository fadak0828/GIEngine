import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameDefinition } from '@gi-engine/core';
import { inlineAssets, getInlinedAssetsSize } from './asset-inliner.js';
import { assembleHtml } from './template.js';
import { PLACEHOLDER_RUNTIME_JS, PLACEHOLDER_RUNTIME_CSS } from './runtime-placeholder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BundleOptions {
  /** Path to game.json */
  input: string;
  /** Path to output .html file */
  output: string;
  /** Base directory for resolving asset paths (defaults to dirname of input) */
  assetDir?: string;
  /** Build mode */
  mode: 'development' | 'production';
  /** Print size analysis */
  analyze?: boolean;
}

export interface BundleResult {
  outputPath: string;
  totalSize: number;
  breakdown: {
    js: number;
    css: number;
    assets: number;
    data: number;
  };
}


/**
 * Attempts to read the pre-built runtime JS from packages/runtime/dist/.
 * Falls back to a placeholder if not found.
 */
async function loadRuntimeJs(_mode: 'development' | 'production'): Promise<string> {
  // Try to find the runtime dist relative to this package
  // Must use IIFE format (index.iife.js) — the ES module (index.js) has `export {}` statements
  // which cause SyntaxError when embedded in a plain <script> block, preventing __giEngineBoot__.
  const runtimeDistPaths = [
    path.resolve(__dirname, '../../runtime/dist/index.iife.js'),
    path.resolve(__dirname, '../../runtime/dist/gi-runtime.js'),
    path.resolve(__dirname, '../../runtime/dist/gi-runtime.min.js'),
    path.resolve(__dirname, '../../runtime/dist/index.js'),
  ];

  for (const runtimePath of runtimeDistPaths) {
    try {
      return await fs.readFile(runtimePath, 'utf-8');
    } catch {
      // Try next path
    }
  }

  // Also try via process.cwd()-based paths (IIFE format first)
  const cwdPaths = [
    path.resolve(process.cwd(), '../runtime/dist/index.iife.js'),
    path.resolve(process.cwd(), '../../packages/runtime/dist/index.iife.js'),
    path.resolve(process.cwd(), '../runtime/dist/gi-runtime.js'),
    path.resolve(process.cwd(), '../../packages/runtime/dist/gi-runtime.js'),
  ];

  for (const runtimePath of cwdPaths) {
    try {
      return await fs.readFile(runtimePath, 'utf-8');
    } catch {
      // Try next path
    }
  }

  console.warn('[bundler] Runtime JS not found in dist, using placeholder.');
  return PLACEHOLDER_RUNTIME_JS;
}

/**
 * Attempts to read the pre-built runtime CSS.
 * Falls back to a placeholder if not found.
 */
async function loadRuntimeCss(): Promise<string> {
  const cssPaths = [
    path.resolve(__dirname, '../../runtime/dist/gi-runtime.css'),
    path.resolve(__dirname, '../../runtime/dist/style.css'),
    path.resolve(process.cwd(), '../runtime/dist/gi-runtime.css'),
    path.resolve(process.cwd(), '../../packages/runtime/dist/gi-runtime.css'),
  ];

  for (const cssPath of cssPaths) {
    try {
      return await fs.readFile(cssPath, 'utf-8');
    } catch {
      // Try next path
    }
  }

  console.warn('[bundler] Runtime CSS not found in dist, using placeholder.');
  return PLACEHOLDER_RUNTIME_CSS;
}

/**
 * Validates the basic structure of a GameDefinition.
 * Throws on critical issues.
 */
function validateGameDefinition(data: unknown): asserts data is GameDefinition {
  if (!data || typeof data !== 'object') {
    throw new Error('Game definition must be a non-null object.');
  }

  const def = data as Record<string, unknown>;

  if (typeof def.id !== 'string' || !def.id) {
    throw new Error('Game definition must have a non-empty "id" string.');
  }

  if (typeof def.version !== 'string') {
    throw new Error('Game definition must have a "version" string.');
  }

  if (!def.title || typeof def.title !== 'object') {
    throw new Error('Game definition must have a "title" object with localized text.');
  }

  if (!Array.isArray(def.acts)) {
    throw new Error('Game definition must have an "acts" array.');
  }

  if (!def.assets || typeof def.assets !== 'object') {
    throw new Error('Game definition must have an "assets" object.');
  }

  const assets = def.assets as Record<string, unknown>;
  if (!assets.items || typeof assets.items !== 'object') {
    throw new Error('Game definition assets must have an "items" record.');
  }
}

/**
 * Bundles a game definition into a single HTML file.
 */
export async function bundle(options: BundleOptions): Promise<BundleResult> {
  const { input, output, mode, analyze } = options;

  // 1. Read and parse game.json
  const inputPath = path.resolve(input);
  const rawJson = await fs.readFile(inputPath, 'utf-8');
  const gameData: unknown = JSON.parse(rawJson);

  // 2. Validate
  validateGameDefinition(gameData);
  const gameDef = gameData as GameDefinition;

  // 3. Inline assets
  const assetDir = options.assetDir ?? path.dirname(inputPath);
  const inlinedManifest = await inlineAssets(gameDef.assets, assetDir);

  // Create the game definition with inlined assets for embedding
  const exportDef = { ...gameDef, assets: inlinedManifest };
  const gameDataJson = JSON.stringify(exportDef, null, mode === 'development' ? 2 : undefined);

  // 4. Load runtime JS and CSS
  const [runtimeJs, runtimeCss] = await Promise.all([
    loadRuntimeJs(mode),
    loadRuntimeCss(),
  ]);

  // 5. Determine locale for HTML lang attribute
  const lang = gameDef.supportedLocales?.[0] ?? 'ko';
  const title = gameDef.title.ko ?? gameDef.title.en ?? 'GIEngine Game';

  // 6. Assemble HTML
  const html = assembleHtml({
    title,
    css: runtimeCss,
    js: runtimeJs,
    gameData: gameDataJson,
    lang,
  });

  // 7. Write output
  const outputPath = path.resolve(output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, 'utf-8');

  // 8. Calculate sizes
  const jsSize = Buffer.byteLength(runtimeJs, 'utf-8');
  const cssSize = Buffer.byteLength(runtimeCss, 'utf-8');
  const assetsSize = getInlinedAssetsSize(inlinedManifest);
  const dataSize = Buffer.byteLength(gameDataJson, 'utf-8');
  const totalSize = Buffer.byteLength(html, 'utf-8');

  const result: BundleResult = {
    outputPath,
    totalSize,
    breakdown: {
      js: jsSize,
      css: cssSize,
      assets: assetsSize,
      data: dataSize,
    },
  };

  if (analyze) {
    printAnalysis(result);
  }

  return result;
}

function printAnalysis(result: BundleResult): void {
  const fmt = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  console.log('\n=== GIEngine Bundle Analysis ===');
  console.log(`  Output:  ${result.outputPath}`);
  console.log(`  Total:   ${fmt(result.totalSize)}`);
  console.log(`  ---`);
  console.log(`  JS:      ${fmt(result.breakdown.js)}`);
  console.log(`  CSS:     ${fmt(result.breakdown.css)}`);
  console.log(`  Assets:  ${fmt(result.breakdown.assets)}`);
  console.log(`  Data:    ${fmt(result.breakdown.data)}`);
  console.log('================================\n');
}
