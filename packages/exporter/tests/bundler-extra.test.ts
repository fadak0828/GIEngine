/**
 * Additional bundler tests:
 * - validateGameDefinition with various invalid inputs
 * - analyze: true option (calls printAnalysis without throwing)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { bundle } from '../src/bundler.js';
import type { GameDefinition } from '@gi-engine/core';

const validGame: GameDefinition = {
  id: 'validate-test',
  version: '1.0.0',
  title: { ko: '테스트', en: 'Test' },
  description: { ko: '', en: '' },
  supportedLocales: ['ko'],
  settings: {
    validationFeedbackDuration: 2000,
    autoSaveInterval: 0,
    debug: false,
    unlockMode: 'sequential',
    cssPrefix: 'gi',
  },
  acts: [
    {
      id: 'act-1',
      title: { ko: '막', en: 'Act' },
      cases: [
        {
          id: 'case-1',
          title: { ko: '사건', en: 'Case' },
          description: { ko: '', en: '' },
          scenes: [
            {
              id: 'scene-1',
              name: { ko: '장면', en: 'Scene' },
              background: '',
              dimensions: { width: 1920, height: 1080 },
              hotspots: [],
              layers: [],
            },
          ],
          puzzles: {
            main: {
              id: 'puzzle-1',
              title: { ko: '퍼즐', en: 'Puzzle' },
              type: 'fill_in_blank',
              template: { segments: [] },
              answers: {},
            },
            sub: [],
          },
          prerequisites: [],
          thumbnail: '',
        },
      ],
    },
  ],
  assets: { items: {} },
};

describe('validateGameDefinition via bundle', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gi-validate-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const bundleData = async (data: unknown, dir: string) => {
    const inputPath = path.join(dir, 'game.json');
    const outputPath = path.join(dir, 'output.html');
    await fs.writeFile(inputPath, JSON.stringify(data));
    return bundle({ input: inputPath, output: outputPath, mode: 'production' });
  };

  it('throws when id is missing', async () => {
    const bad = { ...validGame, id: '' };
    await expect(bundleData(bad, tmpDir)).rejects.toThrow(/id/);
  });

  it('throws when id is not a string', async () => {
    const bad = { ...validGame, id: 123 };
    await expect(bundleData(bad, tmpDir)).rejects.toThrow(/id/);
  });

  it('throws when version is missing', async () => {
    const { version: _, ...noVersion } = validGame as any;
    await expect(bundleData(noVersion, tmpDir)).rejects.toThrow(/version/);
  });

  it('throws when title is missing', async () => {
    const { title: _, ...noTitle } = validGame as any;
    await expect(bundleData(noTitle, tmpDir)).rejects.toThrow(/title/);
  });

  it('throws when title is not an object', async () => {
    const bad = { ...validGame, title: 'string-title' };
    await expect(bundleData(bad, tmpDir)).rejects.toThrow(/title/);
  });

  it('throws when acts is not an array', async () => {
    const bad = { ...validGame, acts: 'not-an-array' };
    await expect(bundleData(bad, tmpDir)).rejects.toThrow(/acts/);
  });

  it('throws when assets is missing', async () => {
    const { assets: _, ...noAssets } = validGame as any;
    await expect(bundleData(noAssets, tmpDir)).rejects.toThrow(/assets/);
  });

  it('throws when assets.items is missing', async () => {
    const bad = { ...validGame, assets: {} };
    await expect(bundleData(bad, tmpDir)).rejects.toThrow(/items/);
  });

  it('throws on non-object input (null)', async () => {
    const inputPath = path.join(tmpDir, 'null.json');
    const outputPath = path.join(tmpDir, 'output.html');
    await fs.writeFile(inputPath, 'null');
    await expect(
      bundle({ input: inputPath, output: outputPath, mode: 'production' })
    ).rejects.toThrow();
  });

  it('accepts valid game definition and produces HTML', async () => {
    const result = await bundleData(validGame, tmpDir);
    expect(result.totalSize).toBeGreaterThan(0);
  });
});

describe('bundle with analyze: true', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gi-analyze-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runs without throwing when analyze is true', async () => {
    const inputPath = path.join(tmpDir, 'game.json');
    const outputPath = path.join(tmpDir, 'output.html');
    await fs.writeFile(inputPath, JSON.stringify(validGame));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await bundle({
        input: inputPath,
        output: outputPath,
        mode: 'production',
        analyze: true,
      });
      expect(result.totalSize).toBeGreaterThan(0);
      // printAnalysis should have been called
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });
});
