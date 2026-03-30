/**
 * Tests for asset-inliner.ts:
 * - inlineAssets: with real temp files, missing files, empty manifest
 * - getInlinedAssetsSize: empty manifest, single asset, multiple assets
 * - guessMimeType coverage (indirectly via inlineAssets)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { inlineAssets, getInlinedAssetsSize } from '../src/asset-inliner.js';
import type { AssetManifest } from '@gi-engine/core';

describe('getInlinedAssetsSize', () => {
  it('returns 0 for empty manifest', () => {
    const manifest: AssetManifest = { items: {} };
    expect(getInlinedAssetsSize(manifest)).toBe(0);
  });

  it('returns 0 when no assets have a size field', () => {
    const manifest: AssetManifest = {
      items: {
        a: { id: 'a', type: 'image', src: 'a.png', mimeType: 'image/png' },
      },
    };
    expect(getInlinedAssetsSize(manifest)).toBe(0);
  });

  it('sums size fields correctly', () => {
    const manifest: AssetManifest = {
      items: {
        a: { id: 'a', type: 'image', src: 'a.png', mimeType: 'image/png', size: 100 },
        b: { id: 'b', type: 'audio', src: 'b.mp3', mimeType: 'audio/mpeg', size: 200 },
      },
    };
    expect(getInlinedAssetsSize(manifest)).toBe(300);
  });

  it('ignores assets without size', () => {
    const manifest: AssetManifest = {
      items: {
        a: { id: 'a', type: 'image', src: 'a.png', mimeType: 'image/png', size: 50 },
        b: { id: 'b', type: 'image', src: 'b.png', mimeType: 'image/png' },
      },
    };
    expect(getInlinedAssetsSize(manifest)).toBe(50);
  });
});

describe('inlineAssets', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gi-asset-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('inlines an existing PNG file as base64 data URI', async () => {
    // Create a minimal 1x1 PNG (binary)
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
      + '000000197465787400536f6674776172650041646f626520496d6167655265616479'
      + '71c9653c0000000c4944415478016360f8cf000002000162d9f0510000000049454e44ae426082',
      'hex'
    );
    await fs.writeFile(path.join(tmpDir, 'test.png'), pngBytes);

    const manifest: AssetManifest = {
      items: {
        'img-1': { id: 'img-1', type: 'image', src: 'test.png', mimeType: 'image/png' },
      },
    };

    const result = await inlineAssets(manifest, tmpDir);
    expect(result.items['img-1'].inline).toBeDefined();
    expect(result.items['img-1'].inline).toMatch(/^data:image\/png;base64,/);
    expect(result.items['img-1'].size).toBe(pngBytes.byteLength);
  });

  it('uses mimeType from manifest when present (does not override)', async () => {
    const data = Buffer.from('hello');
    await fs.writeFile(path.join(tmpDir, 'asset.dat'), data);

    const manifest: AssetManifest = {
      items: {
        'custom-mime': {
          id: 'custom-mime',
          type: 'image',
          src: 'asset.dat',
          mimeType: 'image/svg+xml',
        },
      },
    };

    const result = await inlineAssets(manifest, tmpDir);
    expect(result.items['custom-mime'].inline).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('falls back to application/octet-stream for unknown extension', async () => {
    const data = Buffer.from('binary data');
    await fs.writeFile(path.join(tmpDir, 'asset.xyz'), data);

    const manifest: AssetManifest = {
      items: {
        'unknown-ext': {
          id: 'unknown-ext',
          type: 'image',
          src: 'asset.xyz',
          mimeType: '',  // Empty mimeType triggers guessing
        },
      },
    };

    const result = await inlineAssets(manifest, tmpDir);
    // Should use guessed mime type (application/octet-stream for .xyz)
    expect(result.items['unknown-ext'].inline).toMatch(/^data:application\/octet-stream;base64,/);
  });

  it('skips missing files and returns asset without inline field', async () => {
    const manifest: AssetManifest = {
      items: {
        'missing-img': {
          id: 'missing-img',
          type: 'image',
          src: 'does-not-exist.png',
          mimeType: 'image/png',
        },
      },
    };

    const result = await inlineAssets(manifest, tmpDir);
    // Asset exists in result but without inline data
    expect(result.items['missing-img']).toBeDefined();
    expect(result.items['missing-img'].inline).toBeUndefined();
  });

  it('returns empty manifest unchanged', async () => {
    const manifest: AssetManifest = { items: {} };
    const result = await inlineAssets(manifest, tmpDir);
    expect(result.items).toEqual({});
  });

  it('inlines multiple assets independently', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.png'), Buffer.from('fileA'));
    await fs.writeFile(path.join(tmpDir, 'b.png'), Buffer.from('fileB'));

    const manifest: AssetManifest = {
      items: {
        a: { id: 'a', type: 'image', src: 'a.png', mimeType: 'image/png' },
        b: { id: 'b', type: 'image', src: 'b.png', mimeType: 'image/png' },
      },
    };

    const result = await inlineAssets(manifest, tmpDir);
    expect(result.items['a'].inline).toBeDefined();
    expect(result.items['b'].inline).toBeDefined();
    expect(result.items['a'].inline).not.toBe(result.items['b'].inline);
  });

  it('guesses mime type for .mp3 extension when mimeType is empty', async () => {
    await fs.writeFile(path.join(tmpDir, 'sound.mp3'), Buffer.from('fake mp3'));
    const manifest: AssetManifest = {
      items: {
        'audio-1': { id: 'audio-1', type: 'audio', src: 'sound.mp3', mimeType: '' },
      },
    };
    const result = await inlineAssets(manifest, tmpDir);
    expect(result.items['audio-1'].inline).toMatch(/^data:audio\/mpeg;base64,/);
  });

  it('guesses mime type for .woff2 extension when mimeType is empty', async () => {
    await fs.writeFile(path.join(tmpDir, 'font.woff2'), Buffer.from('fake woff2'));
    const manifest: AssetManifest = {
      items: {
        'font-1': { id: 'font-1', type: 'font', src: 'font.woff2', mimeType: '' },
      },
    };
    const result = await inlineAssets(manifest, tmpDir);
    expect(result.items['font-1'].inline).toMatch(/^data:font\/woff2;base64,/);
  });
});
