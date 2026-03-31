/**
 * Unit tests for WordBankPanelRenderer
 *
 * Covers:
 *  - Rendering collected words grouped by category
 *  - Marking assigned words with the --assigned CSS modifier
 *  - Count badge on toggle button
 *  - Empty-state rendering
 *  - Toggle expand / collapse
 *  - updateWords() preserves expanded state and updates DOM
 *  - destroy() removes DOM elements and resets state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { I18nManager } from '@gi-engine/core';
import type { Word } from '@gi-engine/core';
import { WordBankPanelRenderer } from '../src/renderer/word-bank-panel-renderer.js';

// ── helpers ────────────────────────────────────────────────────────

function makeI18n(): I18nManager {
  return new I18nManager('ko');
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeWord(id: string, displayKo: string, category?: string): Word {
  return {
    id,
    display: { ko: displayKo, en: displayKo },
    category: category as any,
    caseId: 'case-1',
  };
}

function makeRenderer(container: HTMLElement): WordBankPanelRenderer {
  return new WordBankPanelRenderer({ container, i18n: makeI18n() });
}

// ── tests ──────────────────────────────────────────────────────────

describe('WordBankPanelRenderer', () => {
  let container: HTMLElement;
  let renderer: WordBankPanelRenderer;

  beforeEach(() => {
    container = makeContainer();
    renderer = makeRenderer(container);
  });

  describe('render()', () => {
    it('mounts wrapper and toggle button in the container', () => {
      renderer.render([], new Set());
      expect(container.querySelector('.gi-word-bank-panel-wrapper')).not.toBeNull();
      expect(container.querySelector('.gi-word-bank-panel-toggle')).not.toBeNull();
    });

    it('panel is initially collapsed (display: none)', () => {
      renderer.render([makeWord('w1', '단서')], new Set());
      const panel = container.querySelector<HTMLElement>('.gi-word-bank-panel');
      expect(panel).not.toBeNull();
      expect(panel!.style.display).toBe('none');
      expect(panel!.getAttribute('aria-hidden')).toBe('true');
    });

    it('shows count badge equal to words.length', () => {
      const words = [makeWord('w1', '단서A'), makeWord('w2', '단서B')];
      renderer.render(words, new Set());
      const badge = container.querySelector('.gi-word-bank-panel-count');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('2');
    });

    it('shows 0 count badge when no words', () => {
      renderer.render([], new Set());
      const badge = container.querySelector('.gi-word-bank-panel-count');
      expect(badge!.textContent).toBe('0');
    });

    it('shows empty-state message when no words', () => {
      renderer.render([], new Set());
      const empty = container.querySelector('.gi-word-bank-panel-empty');
      expect(empty).not.toBeNull();
    });

    it('renders word items with data-word-id attributes', () => {
      const words = [makeWord('w1', '인물A', 'person'), makeWord('w2', '장소B', 'place')];
      renderer.render(words, new Set());
      expect(container.querySelector('[data-word-id="w1"]')).not.toBeNull();
      expect(container.querySelector('[data-word-id="w2"]')).not.toBeNull();
    });

    it('displays word display text (ko locale)', () => {
      renderer.render([makeWord('w1', '단서A')], new Set());
      const item = container.querySelector('[data-word-id="w1"]');
      expect(item!.textContent).toBe('단서A');
    });

    it('marks assigned words with --assigned class', () => {
      const words = [makeWord('w1', '단서A'), makeWord('w2', '단서B')];
      renderer.render(words, new Set(['w1']));
      const w1 = container.querySelector('[data-word-id="w1"]');
      const w2 = container.querySelector('[data-word-id="w2"]');
      expect(w1!.classList.contains('gi-word-bank-panel-item--assigned')).toBe(true);
      expect(w2!.classList.contains('gi-word-bank-panel-item--assigned')).toBe(false);
    });

    it('groups words by category', () => {
      const words = [
        makeWord('w1', '홍길동', 'person'),
        makeWord('w2', '시장', 'place'),
        makeWord('w3', '황금', 'object'),
      ];
      renderer.render(words, new Set());
      const groups = container.querySelectorAll('.gi-word-bank-panel-group');
      expect(groups.length).toBe(3);
      expect(container.querySelector('[data-category="person"]')).not.toBeNull();
      expect(container.querySelector('[data-category="place"]')).not.toBeNull();
      expect(container.querySelector('[data-category="object"]')).not.toBeNull();
    });

    it('groups words without category under "other"', () => {
      renderer.render([makeWord('w1', '알 수 없음')], new Set());
      expect(container.querySelector('[data-category="other"]')).not.toBeNull();
    });
  });

  describe('toggle button', () => {
    it('expands panel on first click', () => {
      renderer.render([makeWord('w1', '단서')], new Set());
      const btn = container.querySelector<HTMLButtonElement>('.gi-word-bank-panel-toggle')!;
      const panel = container.querySelector<HTMLElement>('.gi-word-bank-panel')!;

      btn.click();

      expect(panel.style.display).toBe('');
      expect(panel.getAttribute('aria-hidden')).toBe('false');
      expect(btn.getAttribute('aria-expanded')).toBe('true');
    });

    it('collapses panel on second click', () => {
      renderer.render([makeWord('w1', '단서')], new Set());
      const btn = container.querySelector<HTMLButtonElement>('.gi-word-bank-panel-toggle')!;
      const panel = container.querySelector<HTMLElement>('.gi-word-bank-panel')!;

      btn.click(); // expand
      btn.click(); // collapse

      expect(panel.style.display).toBe('none');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('updateWords()', () => {
    it('updates count badge without destroying the wrapper', () => {
      renderer.render([makeWord('w1', '단서A')], new Set());
      const wrapper = container.querySelector('.gi-word-bank-panel-wrapper');

      renderer.updateWords(
        [makeWord('w1', '단서A'), makeWord('w2', '단서B')],
        new Set()
      );

      // Same wrapper element (not replaced)
      expect(container.querySelector('.gi-word-bank-panel-wrapper')).toBe(wrapper);
      expect(container.querySelector('.gi-word-bank-panel-count')!.textContent).toBe('2');
    });

    it('updates word items in the panel', () => {
      renderer.render([makeWord('w1', '단서A')], new Set());
      renderer.updateWords([makeWord('w1', '단서A'), makeWord('w2', '단서B')], new Set());

      expect(container.querySelector('[data-word-id="w2"]')).not.toBeNull();
    });

    it('preserves expanded state after updateWords', () => {
      renderer.render([makeWord('w1', '단서A')], new Set());
      const btn = container.querySelector<HTMLButtonElement>('.gi-word-bank-panel-toggle')!;
      btn.click(); // expand

      renderer.updateWords([makeWord('w1', '단서A'), makeWord('w2', '단서B')], new Set());

      const panel = container.querySelector<HTMLElement>('.gi-word-bank-panel')!;
      // Panel should still be visible after update
      expect(panel.style.display).toBe('');
    });

    it('updates --assigned class correctly', () => {
      renderer.render([makeWord('w1', '단서A'), makeWord('w2', '단서B')], new Set());
      renderer.updateWords(
        [makeWord('w1', '단서A'), makeWord('w2', '단서B')],
        new Set(['w2'])
      );

      const w1 = container.querySelector('[data-word-id="w1"]');
      const w2 = container.querySelector('[data-word-id="w2"]');
      expect(w1!.classList.contains('gi-word-bank-panel-item--assigned')).toBe(false);
      expect(w2!.classList.contains('gi-word-bank-panel-item--assigned')).toBe(true);
    });

    it('does nothing gracefully when called before render', () => {
      // Should not throw
      expect(() => {
        renderer.updateWords([makeWord('w1', '단서A')], new Set());
      }).not.toThrow();
    });
  });

  describe('destroy()', () => {
    it('removes the wrapper from the DOM', () => {
      renderer.render([makeWord('w1', '단서A')], new Set());
      expect(container.querySelector('.gi-word-bank-panel-wrapper')).not.toBeNull();

      renderer.destroy();

      expect(container.querySelector('.gi-word-bank-panel-wrapper')).toBeNull();
    });

    it('resets expanded state on destroy', () => {
      renderer.render([makeWord('w1', '단서A')], new Set());
      const btn = container.querySelector<HTMLButtonElement>('.gi-word-bank-panel-toggle')!;
      btn.click(); // expand

      renderer.destroy();

      // Re-render should start collapsed again
      renderer.render([makeWord('w1', '단서A')], new Set());
      const panel = container.querySelector<HTMLElement>('.gi-word-bank-panel')!;
      expect(panel.style.display).toBe('none');
    });

    it('is idempotent — second destroy does not throw', () => {
      renderer.render([makeWord('w1', '단서A')], new Set());
      renderer.destroy();
      expect(() => renderer.destroy()).not.toThrow();
    });
  });
});
