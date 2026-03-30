/**
 * Tests for browser-export.ts:
 * - browserExport is async and returns a BrowserExportResult with html, fileName, totalSize, breakdown
 * - inlineAssetsForBrowser handles undefined/empty assets gracefully (via browserExport)
 * - inlineAssetsForBrowser handles fetch errors gracefully (warn + keep original src)
 * - inlineAssetsForBrowser skips assets that already have inline / data: src
 *
 * NOTE: browser-export.ts imports runtimeJs and runtimeCss via ?raw Vite plugin aliases
 * which are not available in vitest. We mock them via vi.mock() so the module can be
 * imported and tested without a full Vite build.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GameDefinition } from '@gi-engine/core';

// ---------------------------------------------------------------------------
// Mock the ?raw Vite imports used by browser-export.ts.
// Without this, vitest cannot resolve "?raw" specifiers.
// ---------------------------------------------------------------------------
vi.mock('../../runtime/dist/index.iife.js?raw', () => ({ default: '/* mocked iife js */' }));
vi.mock('../../runtime/dist/runtime.css?raw', () => ({ default: '/* mocked css */' }));

// ---------------------------------------------------------------------------
// Minimal GameDefinition fixture
// ---------------------------------------------------------------------------
const baseGame: GameDefinition = {
  id: 'browser-export-test',
  version: '1.0.0',
  title: { ko: '테스트 게임', en: 'Test Game' },
  description: { ko: '설명', en: 'Description' },
  supportedLocales: ['ko'],
  settings: {
    validationFeedbackDuration: 2000,
    autoSaveInterval: 0,
    debug: false,
    unlockMode: 'sequential',
    cssPrefix: 'gi',
  },
  acts: [],
  assets: { items: {} },
};

describe('browserExport', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalFileReader: typeof globalThis.FileReader;
  let originalTextEncoder: typeof globalThis.TextEncoder;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalFileReader = globalThis.FileReader;
    originalTextEncoder = globalThis.TextEncoder;

    // Provide a minimal TextEncoder if not available in test env
    if (typeof globalThis.TextEncoder === 'undefined') {
      globalThis.TextEncoder = class {
        encode(str: string) {
          return Buffer.from(str, 'utf8');
        }
      } as never;
    }

    // Stub window.location (used as baseUrl)
    Object.defineProperty(globalThis, 'window', {
      value: { location: { href: 'http://localhost:3000/' } },
      writable: true,
      configurable: true,
    });

    // Default fetch stub: never called for empty assets manifest
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => new ArrayBuffer(4),
    } as never);

    // Stub FileReader used in inlineAssetsForBrowser
    globalThis.FileReader = class {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_blob: Blob) {
        this.result = 'data:image/png;base64,AAAA';
        if (this.onload) this.onload();
      }
    } as never;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalFileReader;
    globalThis.TextEncoder = originalTextEncoder;
  });

  it('is async and returns a BrowserExportResult', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const result = await browserExport({ gameDefinition: baseGame, mode: 'production' });

    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('fileName');
    expect(result).toHaveProperty('totalSize');
    expect(result).toHaveProperty('breakdown');
    expect(result.breakdown).toHaveProperty('js');
    expect(result.breakdown).toHaveProperty('css');
    expect(result.breakdown).toHaveProperty('assets');
    expect(result.breakdown).toHaveProperty('data');
  });

  it('fileName is derived from gameDefinition.id', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const result = await browserExport({ gameDefinition: baseGame, mode: 'production' });
    expect(result.fileName).toBe('browser-export-test.html');
  });

  it('html contains DOCTYPE and game data', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const result = await browserExport({ gameDefinition: baseGame, mode: 'production' });
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('browser-export-test');
  });

  it('totalSize is positive', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const result = await browserExport({ gameDefinition: baseGame, mode: 'production' });
    expect(result.totalSize).toBeGreaterThan(0);
  });

  it('handles empty assets manifest without throwing', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const game: GameDefinition = { ...baseGame, assets: { items: {} } };
    await expect(browserExport({ gameDefinition: game, mode: 'production' })).resolves.toBeDefined();
    // fetch should not have been called — no assets to inline
    expect(globalThis.fetch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('handles asset fetch error gracefully (warn, keeps original src)', async () => {
    // Make fetch fail for this test
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { browserExport } = await import('../src/browser-export.js');
    const game: GameDefinition = {
      ...baseGame,
      assets: {
        items: {
          'img-1': { id: 'img-1', type: 'image', src: 'hero.png', mimeType: 'image/png' },
        },
      },
    };

    const result = await browserExport({ gameDefinition: game, mode: 'production' });

    // Should not throw; warning should have been emitted
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('img-1'));
    warnSpy.mockRestore();
  });

  it('skips fetch for assets that already have a data: src', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const game: GameDefinition = {
      ...baseGame,
      assets: {
        items: {
          'img-data': {
            id: 'img-data',
            type: 'image',
            src: 'data:image/png;base64,AAAA',
            mimeType: 'image/png',
          },
        },
      },
    };

    await browserExport({ gameDefinition: game, mode: 'production' });
    // Already a data URI — fetch must NOT be called
    expect(globalThis.fetch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('skips fetch for assets that already have an inline field', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const game: GameDefinition = {
      ...baseGame,
      assets: {
        items: {
          'img-inline': {
            id: 'img-inline',
            type: 'image',
            src: 'hero.png',
            mimeType: 'image/png',
            inline: 'data:image/png;base64,BBBB',
          },
        },
      },
    };

    await browserExport({ gameDefinition: game, mode: 'production' });
    // Already inlined — fetch must NOT be called
    expect(globalThis.fetch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('skips fetch for assets with no src', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const game: GameDefinition = {
      ...baseGame,
      assets: {
        items: {
          'img-nosrc': {
            id: 'img-nosrc',
            type: 'image',
            src: '',
            mimeType: 'image/png',
          },
        },
      },
    };

    await browserExport({ gameDefinition: game, mode: 'production' });
    expect(globalThis.fetch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('uses development mode (pretty-printed JSON)', async () => {
    const { browserExport } = await import('../src/browser-export.js');
    const result = await browserExport({ gameDefinition: baseGame, mode: 'development' });
    // Development mode uses JSON.stringify with indent=2, so the HTML should contain newlines in game data
    expect(result.html).toContain('\n');
  });
});
