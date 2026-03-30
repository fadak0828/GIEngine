/**
 * Additional template tests:
 * - escapeHtml with & characters
 * - escapeAttr with quotes in lang
 * - The assembleHtml output structure details
 */

import { describe, it, expect } from 'vitest';
import { assembleHtml } from '../src/template.js';

describe('assembleHtml – additional coverage', () => {
  it('escapes & in title', () => {
    const html = assembleHtml({
      title: 'John & Jane',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'en',
    });
    expect(html).toContain('John &amp; Jane');
    expect(html).not.toContain('<title>John & Jane</title>');
  });

  it('escapes > in title', () => {
    const html = assembleHtml({
      title: 'Score > 100',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'en',
    });
    expect(html).toContain('Score &gt; 100');
  });

  it('escapes " in title', () => {
    const html = assembleHtml({
      title: 'Game "Alpha"',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'en',
    });
    expect(html).toContain('Game &quot;Alpha&quot;');
  });

  it('escapes " in lang attribute', () => {
    const html = assembleHtml({
      title: 'Test',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'en"onload=alert(1)',
    });
    expect(html).not.toContain('lang="en"onload=alert(1)"');
    expect(html).toContain('&quot;');
  });

  it('includes mobile-web-app meta tags', () => {
    const html = assembleHtml({
      title: 'Mobile Test',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'ko',
    });
    expect(html).toContain('mobile-web-app-capable');
    expect(html).toContain('apple-mobile-web-app-capable');
  });

  it('includes auto-boot IIFE that calls __giEngineBoot__', () => {
    const html = assembleHtml({
      title: 'Test',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'en',
    });
    expect(html).toContain('__giEngineBoot__');
    expect(html).toContain('gi-game-data');
    expect(html).toContain('gi-engine-root');
    expect(html).toContain('__GI_GAME_DATA__');
  });

  it('embeds CSS inside style tag', () => {
    const css = '.custom-class { color: blue; }';
    const html = assembleHtml({
      title: 'Style Test',
      css,
      js: '',
      gameData: '{}',
      lang: 'en',
    });
    expect(html).toContain(css);
  });

  it('empty game data still produces valid HTML structure', () => {
    const html = assembleHtml({
      title: '',
      css: '',
      js: '',
      gameData: '{}',
      lang: 'en',
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });
});
