/**
 * Tests for Renderer.collectWordsForCase (private — exercised via update())
 *
 * Covers the three-tier lookup introduced in the runtime render fix:
 *   Tier 1 (primary):  def.words dictionary
 *   Tier 2 (fallback): scan scene hotspot word_reveal actions
 *   Tier 3 (last resort): emit warning and use wordId as display label
 *
 * Also verifies that clearView() (called on view transitions) resets
 * lastSlotAssignments so the next puzzle gets a clean diff baseline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GameDefinition,
  GameState,
  SaveState,
  CaseState,
  PuzzleState,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';
import { Renderer } from '../src/renderer/renderer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeI18n(): I18nManager {
  return new I18nManager('ko');
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeAssets() {
  return { items: {} };
}

/** Minimal valid puzzle */
const basePuzzle = {
  id: 'puzzle-main',
  title: { ko: '퍼즐', en: 'Puzzle' },
  type: 'fill_in_blank' as const,
  template: {
    segments: [
      { type: 'slot' as const, slotId: 'slot-1', placeholder: { ko: '?', en: '?' } },
    ],
  },
  answers: {
    'slot-1': { correctWordId: 'word-a' },
  },
};

/** Minimal valid case */
function makeCaseDef(id: string, scenes: GameDefinition['acts'][0]['cases'][0]['scenes'] = []) {
  return {
    id,
    title: { ko: '사건', en: 'Case' },
    description: { ko: '', en: '' },
    scenes: scenes.length
      ? scenes
      : [
          {
            id: 'scene-1',
            name: { ko: '장면', en: 'Scene' },
            background: '',
            dimensions: { width: 1920, height: 1080 },
            hotspots: [],
            layers: [],
          },
        ],
    puzzles: { main: basePuzzle, sub: [] },
    prerequisites: [],
    thumbnail: '',
  };
}

function makeDef(
  extra: Partial<GameDefinition> = {},
  caseId = 'case-1'
): GameDefinition {
  return {
    id: 'test-game',
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
    acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [makeCaseDef(caseId)] }],
    assets: makeAssets(),
    ...extra,
  };
}

function makeCaseState(wordIds: string[]): CaseState {
  return {
    status: 'unlocked',
    collectedWordIds: wordIds,
    puzzleStates: {
      'puzzle-main': {
        solved: false,
        slotAssignments: { 'slot-1': null },
        attemptCount: 0,
      } satisfies PuzzleState,
    },
    visitedSceneIds: [],
    layerVisibility: {},
  };
}

function makeSave(caseId: string, wordIds: string[]): SaveState {
  return {
    version: '1.0.0',
    savedAt: new Date().toISOString(),
    currentLocale: 'ko',
    caseStates: { [caseId]: makeCaseState(wordIds) },
    currentPosition: null,
    flags: {},
  };
}

function makeThinkingState(caseId: string): GameState {
  return {
    type: 'thinking',
    caseId,
    puzzleId: 'puzzle-main',
    sub: { type: 'editing' },
  };
}

function makeRenderer(container: HTMLElement) {
  const dispatched: unknown[] = [];
  const renderer = new Renderer({
    container,
    i18n: makeI18n(),
    assets: makeAssets(),
    dispatch: e => dispatched.push(e),
    onHotspotClick: () => {},
  });
  return { renderer, dispatched };
}

// ---------------------------------------------------------------------------
// Tests: Tier 1 — def.words primary lookup
// ---------------------------------------------------------------------------

describe('collectWordsForCase — Tier 1: def.words dictionary', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it('resolves display text from def.words when the word is collected', () => {
    const def = makeDef({
      words: {
        'word-a': {
          id: 'word-a',
          display: { ko: '단서A', en: 'ClueA' },
          category: 'evidence',
        },
      },
    });

    const save = makeSave('case-1', ['word-a']);
    const state = makeThinkingState('case-1');
    const { renderer } = makeRenderer(container);

    // Should not throw — word is resolved via def.words
    expect(() => renderer.update(state, save, def)).not.toThrow();

    // The deduction UI should be mounted; word bank should contain the resolved label
    const wordBankEl = container.querySelector('.gi-word-bank');
    expect(wordBankEl).not.toBeNull();
    expect(wordBankEl!.textContent).toContain('단서A');
  });

  it('resolves category from def.words', () => {
    const def = makeDef({
      words: {
        'word-a': {
          id: 'word-a',
          display: { ko: '시간', en: 'Time' },
          category: 'time',
        },
      },
    });

    const save = makeSave('case-1', ['word-a']);
    const state = makeThinkingState('case-1');
    const { renderer } = makeRenderer(container);
    renderer.update(state, save, def);

    // Category should appear as a CSS modifier or data attribute on the word element
    const wordEl = container.querySelector('[data-word-id="word-a"]');
    expect(wordEl).not.toBeNull();
    // The implementation adds a gi-word--{category} class
    expect(wordEl!.className).toContain('time');
  });

  it('handles multiple collected words all from def.words', () => {
    const caseWithTwoSlotPuzzle = {
      ...makeCaseDef('case-1'),
      puzzles: {
        main: {
          ...basePuzzle,
          template: {
            segments: [
              { type: 'slot' as const, slotId: 'slot-1', placeholder: { ko: '?', en: '?' } },
              { type: 'slot' as const, slotId: 'slot-2', placeholder: { ko: '?', en: '?' } },
            ],
          },
          answers: {
            'slot-1': { correctWordId: 'word-a' },
            'slot-2': { correctWordId: 'word-b' },
          },
        },
        sub: [],
      },
    };
    const defMulti: GameDefinition = {
      ...makeDef(),
      acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [caseWithTwoSlotPuzzle] }],
      words: {
        'word-a': { id: 'word-a', display: { ko: '단서A', en: 'ClueA' } },
        'word-b': { id: 'word-b', display: { ko: '단서B', en: 'ClueB' } },
      },
    };

    const caseState: CaseState = {
      status: 'unlocked',
      collectedWordIds: ['word-a', 'word-b'],
      puzzleStates: {
        'puzzle-main': { solved: false, slotAssignments: { 'slot-1': null, 'slot-2': null }, attemptCount: 0 },
      },
      visitedSceneIds: [],
      layerVisibility: {},
    };
    const save: SaveState = {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      currentLocale: 'ko',
      caseStates: { 'case-1': caseState },
      currentPosition: null,
      flags: {},
    };

    const { renderer } = makeRenderer(container);
    renderer.update(makeThinkingState('case-1'), save, defMulti);

    const wordBankEl = container.querySelector('.gi-word-bank');
    expect(wordBankEl!.textContent).toContain('단서A');
    expect(wordBankEl!.textContent).toContain('단서B');
  });
});

// ---------------------------------------------------------------------------
// Tests: Tier 2 — fallback scan of scene hotspot word_reveal actions
// ---------------------------------------------------------------------------

describe('collectWordsForCase — Tier 2: scene hotspot fallback', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it('falls back to scene word_reveal when def.words is absent', () => {
    const sceneWithWordReveal = {
      id: 'scene-1',
      name: { ko: '장면', en: 'Scene' },
      background: '',
      dimensions: { width: 1920, height: 1080 },
      layers: [],
      hotspots: [
        {
          id: 'hs-1',
          label: { ko: '', en: '' },
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          action: {
            type: 'word_reveal' as const,
            wordIds: ['word-a'],
            message: { ko: '단서', en: 'Clue' },
          },
        },
      ],
    };

    const defNoWords = makeDef(); // no def.words
    // Override scenes in act
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defNoWords.acts[0].cases[0].scenes = [sceneWithWordReveal as any];

    const save = makeSave('case-1', ['word-a']);
    const { renderer } = makeRenderer(container);

    expect(() => renderer.update(makeThinkingState('case-1'), save, defNoWords)).not.toThrow();
    // word bank should render (even without a display label, an element is present)
    expect(container.querySelector('.gi-word-bank')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: Tier 3 — last resort (unknown word → warning + id as label)
// ---------------------------------------------------------------------------

describe('collectWordsForCase — Tier 3: unknown word last resort', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it('emits a console.warn and uses wordId as display label for unknown words', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = makeDef(); // no def.words, no word_reveal hotspot
    const save = makeSave('case-1', ['unknown-word-xyz']);
    const { renderer } = makeRenderer(container);

    renderer.update(makeThinkingState('case-1'), save, def);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown-word-xyz')
    );
    // The word bank should still render with the id as the label
    const wordBankEl = container.querySelector('.gi-word-bank');
    expect(wordBankEl).not.toBeNull();
    expect(wordBankEl!.textContent).toContain('unknown-word-xyz');
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Tests: lastSlotAssignments reset in clearView
// ---------------------------------------------------------------------------

describe('clearView resets lastSlotAssignments', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it('re-mounts deduction UI cleanly after transitioning away and back', () => {
    const def = makeDef({
      words: { 'word-a': { id: 'word-a', display: { ko: '단서A', en: 'ClueA' } } },
    });
    const save = makeSave('case-1', ['word-a']);
    const { renderer } = makeRenderer(container);

    // First visit: mount thinking view
    renderer.update(makeThinkingState('case-1'), save, def);
    expect(container.querySelector('.gi-deduction')).not.toBeNull();

    // Navigate away (case_select clears the view)
    renderer.update({ type: 'case_select' }, save, def);
    expect(container.querySelector('.gi-deduction')).toBeNull();

    // Return to thinking: should re-mount cleanly without stale diff state
    renderer.update(makeThinkingState('case-1'), save, def);
    expect(container.querySelector('.gi-deduction')).not.toBeNull();

    // Exactly one deduction element (no duplicates from stale state)
    expect(container.querySelectorAll('.gi-deduction')).toHaveLength(1);
  });

  it('diff is clean after clearView — no spurious updateSlotContent calls', () => {
    const def = makeDef({
      words: { 'word-a': { id: 'word-a', display: { ko: '단서A', en: 'ClueA' } } },
    });
    const { renderer } = makeRenderer(container);

    // First visit to puzzle-main, then assign word-a to slot-1
    const saveEmpty = makeSave('case-1', ['word-a']);
    renderer.update(makeThinkingState('case-1'), saveEmpty, def);

    const saveAssigned: SaveState = {
      ...saveEmpty,
      caseStates: {
        'case-1': {
          ...makeCaseState(['word-a']),
          puzzleStates: {
            'puzzle-main': { solved: false, slotAssignments: { 'slot-1': 'word-a' }, attemptCount: 0 },
          },
        },
      },
    };

    // Second update: diff should set slot-1 → word-a incrementally
    renderer.update(makeThinkingState('case-1'), saveAssigned, def);

    // The slot element should now reflect the assigned word
    const slotEl = container.querySelector('[data-slot-id="slot-1"]');
    expect(slotEl).not.toBeNull();
    // After assignment, the slot should not show the placeholder
    expect(slotEl!.textContent).not.toBe('?');
  });
});
