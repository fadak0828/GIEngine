import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { assembleHtml } from '../src/template.js';
import { bundle } from '../src/bundler.js';
import type { GameDefinition } from '@gi-engine/core';

// --- assembleHtml tests ---

describe('assembleHtml', () => {
  it('produces a valid HTML document with all sections', () => {
    const html = assembleHtml({
      title: 'Test Game',
      css: '.test { color: red; }',
      js: 'console.log("hello");',
      gameData: '{"id":"test"}',
      lang: 'en',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Test Game</title>');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<div id="gi-engine-root">');
    expect(html).toContain('id="gi-game-data"');
    expect(html).toContain('.test { color: red; }');
    expect(html).toContain('console.log("hello");');
    expect(html).toContain('"id":"test"');
  });

  it('escapes HTML entities in the title', () => {
    const html = assembleHtml({
      title: '<script>alert("xss")</script>',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'ko',
    });

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes </script> in game data', () => {
    const html = assembleHtml({
      title: 'Test',
      css: '',
      js: '',
      gameData: '{"text":"</script>"}',
      lang: 'ko',
    });

    // Should not have a raw </script> inside the JSON block
    const jsonBlock = html.split('id="gi-game-data">')[1]?.split('</script>')[0];
    expect(jsonBlock).toContain('<\\/script>');
  });

  it('escapes </script> in JS code', () => {
    const html = assembleHtml({
      title: 'Test',
      css: '',
      js: 'var x = "</script>";',
      gameData: '{}',
      lang: 'ko',
    });

    // Count script tags - should be well-formed
    expect(html).toContain('<\\/script>');
  });

  it('sets the correct lang attribute', () => {
    const html = assembleHtml({
      title: 'Korean Game',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'ko',
    });

    expect(html).toContain('<html lang="ko">');
  });
});

// --- bundle integration tests ---

describe('bundle', () => {
  let tmpDir: string;

  const minimalGame: GameDefinition = {
    id: 'test-game',
    version: '1.0.0',
    title: { ko: '테스트 게임', en: 'Test Game' },
    description: { ko: '테스트용', en: 'For testing' },
    supportedLocales: ['ko', 'en'],
    settings: {
      validationFeedbackDuration: 2000,
      autoSaveInterval: 30000,
      debug: false,
      unlockMode: 'sequential',
      cssPrefix: 'gi-',
    },
    acts: [
      {
        id: 'act-1',
        title: { ko: '제1막', en: 'Act 1' },
        cases: [
          {
            id: 'case-1',
            title: { ko: '사건 1', en: 'Case 1' },
            description: { ko: '첫 번째 사건', en: 'First case' },
            scenes: [
              {
                id: 'scene-1',
                name: { ko: '장면 1', en: 'Scene 1' },
                background: 'bg-placeholder',
                dimensions: { width: 1920, height: 1080 },
                hotspots: [],
                layers: [],
              },
            ],
            puzzles: {
              main: {
                id: 'puzzle-1',
                title: { ko: '퍼즐 1', en: 'Puzzle 1' },
                type: 'fill_in_blank',
                template: { segments: [{ type: 'text', content: { ko: '테스트', en: 'test' } }] },
                answers: {},
              },
              sub: [],
            },
            prerequisites: [],
            thumbnail: 'thumb-placeholder',
          },
        ],
      },
    ],
    assets: {
      items: {
        'bg-placeholder': {
          id: 'bg-placeholder',
          type: 'image',
          src: 'placeholder.png',
          mimeType: 'image/png',
        },
      },
    },
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gi-exporter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('bundles a minimal game.json into a single HTML file', async () => {
    const inputPath = path.join(tmpDir, 'game.json');
    const outputPath = path.join(tmpDir, 'output.html');

    await fs.writeFile(inputPath, JSON.stringify(minimalGame, null, 2));

    const result = await bundle({
      input: inputPath,
      output: outputPath,
      mode: 'development',
    });

    expect(result.outputPath).toBe(outputPath);
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.breakdown.data).toBeGreaterThan(0);
    expect(result.breakdown.js).toBeGreaterThan(0);

    // Verify the file was written
    const html = await fs.readFile(outputPath, 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('test-game');
    expect(html).toContain('테스트 게임');
  });

  it('reports correct size breakdown', async () => {
    const inputPath = path.join(tmpDir, 'game.json');
    const outputPath = path.join(tmpDir, 'output.html');

    await fs.writeFile(inputPath, JSON.stringify(minimalGame));

    const result = await bundle({
      input: inputPath,
      output: outputPath,
      mode: 'production',
    });

    expect(result.breakdown.js).toBeGreaterThan(0);
    expect(result.breakdown.css).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.data).toBeGreaterThan(0);
    // Total should be larger than sum of parts (due to HTML wrapper)
    expect(result.totalSize).toBeGreaterThan(result.breakdown.data);
  });

  it('throws on invalid game definition', async () => {
    const inputPath = path.join(tmpDir, 'bad.json');
    const outputPath = path.join(tmpDir, 'output.html');

    await fs.writeFile(inputPath, JSON.stringify({ foo: 'bar' }));

    await expect(
      bundle({ input: inputPath, output: outputPath, mode: 'production' })
    ).rejects.toThrow();
  });

  it('throws on missing input file', async () => {
    await expect(
      bundle({
        input: path.join(tmpDir, 'nonexistent.json'),
        output: path.join(tmpDir, 'output.html'),
        mode: 'production',
      })
    ).rejects.toThrow();
  });

  it('creates output directory if it does not exist', async () => {
    const inputPath = path.join(tmpDir, 'game.json');
    const outputPath = path.join(tmpDir, 'nested', 'deep', 'output.html');

    await fs.writeFile(inputPath, JSON.stringify(minimalGame));

    const result = await bundle({
      input: inputPath,
      output: outputPath,
      mode: 'production',
    });

    expect(result.outputPath).toBe(outputPath);
    const exists = await fs.access(outputPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('handles missing asset files gracefully', async () => {
    const inputPath = path.join(tmpDir, 'game.json');
    const outputPath = path.join(tmpDir, 'output.html');

    await fs.writeFile(inputPath, JSON.stringify(minimalGame));

    // Asset file (placeholder.png) doesn't exist, should still bundle
    const result = await bundle({
      input: inputPath,
      output: outputPath,
      mode: 'production',
    });

    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.breakdown.assets).toBe(0); // No assets inlined
  });
});
