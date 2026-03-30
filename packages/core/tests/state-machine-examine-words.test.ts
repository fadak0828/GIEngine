/**
 * Tests for interactive word collection via collectibleWords and COLLECT_WORD_IN_POPUP.
 * Updated to reflect the new model where examine actions no longer auto-collect words;
 * instead, words must be individually clicked via COLLECT_WORD_IN_POPUP.
 */

import { describe, it, expect } from 'vitest';
import { transition } from '../src/state/state-machine.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition, GameState, SaveState } from '../src/models/types.js';

const testDef: GameDefinition = {
  id: 'examine-words-test',
  version: '1.0.0',
  title: { ko: '테스트', en: 'Test' },
  description: { ko: '', en: '' },
  supportedLocales: ['ko', 'en'],
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
      title: { ko: '1막', en: 'Act 1' },
      cases: [
        {
          id: 'case-1',
          title: { ko: '사건 1', en: 'Case 1' },
          description: { ko: '', en: '' },
          prerequisites: [],
          thumbnail: '',
          scenes: [
            {
              id: 'scene-1',
              name: { ko: '장면', en: 'Scene' },
              background: '',
              dimensions: { width: 1920, height: 1080 },
              hotspots: [
                {
                  id: 'hs-examine-with-words',
                  area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
                  action: {
                    type: 'examine',
                    content: { ko: '편지 내용입니다', en: 'Letter content' },
                    collectibleWords: [
                      { wordId: 'word-a', textMatch: { ko: '편지', en: 'Letter' } },
                      { wordId: 'word-b', textMatch: { ko: '내용', en: 'content' } },
                    ],
                  },
                  cursor: 'pointer',
                  ariaLabel: { ko: '편지', en: 'Letter' },
                },
                {
                  id: 'hs-examine-no-words',
                  area: { type: 'rect', x: 10, y: 10, width: 10, height: 10 },
                  action: {
                    type: 'examine',
                    content: { ko: '메모', en: 'Note' },
                  },
                  cursor: 'pointer',
                  ariaLabel: { ko: '메모', en: 'Note' },
                },
                {
                  id: 'hs-examine-image',
                  area: { type: 'rect', x: 20, y: 20, width: 10, height: 10 },
                  action: {
                    type: 'examine_image',
                    image: 'photo.jpg',
                  },
                  cursor: 'pointer',
                  ariaLabel: { ko: '사진', en: 'Photo' },
                },
                {
                  id: 'hs-word-reveal',
                  area: { type: 'rect', x: 30, y: 30, width: 10, height: 10 },
                  action: { type: 'word_reveal', wordIds: ['word-d', 'word-e'] },
                  cursor: 'pointer',
                  ariaLabel: { ko: '단어', en: 'Word' },
                },
              ],
              layers: [],
            },
          ],
          puzzles: {
            main: {
              id: 'puzzle-main',
              title: { ko: '메인', en: 'Main' },
              type: 'fill_in_blank',
              template: { segments: [{ type: 'slot', slotId: 'slot-1' }] },
              answers: { 'slot-1': { correctWordId: 'word-a' } },
            },
            sub: [],
          },
        },
      ],
    },
  ],
  assets: { items: {} },
};

function makeSave(): SaveState {
  return createInitialSaveState(testDef);
}

const exploring: GameState = {
  type: 'exploring',
  caseId: 'case-1',
  sceneId: 'scene-1',
  sub: { type: 'idle' },
};

describe('Examine actions no longer auto-collect words', () => {
  it('examine action with collectibleWords shows examining_text WITHOUT collecting words', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-with-words' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_text');
      if (result.nextState.sub.type === 'examining_text') {
        // collectibleWords should be passed through to sub-state
        expect(result.nextState.sub.collectibleWords).toHaveLength(2);
      }
    }
    // No auto-collection — no save state change
    expect(result.saveState).toBeUndefined();
    expect(result.effects).toEqual([]);
  });

  it('examine action without collectibleWords shows examining_text with no effects', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-no-words' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_text');
    }
    expect(result.saveState).toBeUndefined();
    expect(result.effects).toEqual([]);
  });

  it('examine_image action shows examining_image without collecting words', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-image' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_image');
    }
    expect(result.saveState).toBeUndefined();
    expect(result.effects).toEqual([]);
  });
});

describe('COLLECT_WORD_IN_POPUP — interactive word collection', () => {
  function getExaminingTextState(): { state: GameState; save: SaveState } {
    const save = makeSave();
    const result = transition(exploring, save, { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-with-words' }, testDef);
    return { state: result.nextState, save };
  }

  it('collects a word while staying in examining_text sub-state', () => {
    const { state, save } = getExaminingTextState();
    const result = transition(state, save, { type: 'COLLECT_WORD_IN_POPUP', wordId: 'word-a' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      // Sub-state should NOT change — popup stays open
      expect(result.nextState.sub.type).toBe('examining_text');
    }
    const collected = result.saveState?.caseStates?.['case-1']?.collectedWordIds ?? [];
    expect(collected).toContain('word-a');
    expect(result.effects).toContainEqual({ type: 'word_collected_in_popup', wordId: 'word-a' });
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });

  it('collecting a second word adds it without duplicating the first', () => {
    const { state, save } = getExaminingTextState();
    // Collect word-a first
    const r1 = transition(state, save, { type: 'COLLECT_WORD_IN_POPUP', wordId: 'word-a' }, testDef);
    const save2 = { ...save, ...r1.saveState };
    // Collect word-b
    const r2 = transition(r1.nextState, save2, { type: 'COLLECT_WORD_IN_POPUP', wordId: 'word-b' }, testDef);
    const collected = r2.saveState?.caseStates?.['case-1']?.collectedWordIds ?? [];
    expect(collected).toContain('word-a');
    expect(collected).toContain('word-b');
    expect(collected.filter(id => id === 'word-a').length).toBe(1);
  });

  it('collecting an already-collected word emits UI feedback but no save change', () => {
    const { state, save } = getExaminingTextState();
    save.caseStates['case-1'].collectedWordIds = ['word-a'];
    const result = transition(state, save, { type: 'COLLECT_WORD_IN_POPUP', wordId: 'word-a' }, testDef);
    // No save change
    expect(result.saveState).toBeUndefined();
    // Still emits UI feedback effect
    expect(result.effects).toContainEqual({ type: 'word_collected_in_popup', wordId: 'word-a' });
    // But no save_game effect
    expect(result.effects).not.toContainEqual({ type: 'save_game' });
  });

  it('COLLECT_WORD_IN_POPUP in idle sub-state is ignored', () => {
    const result = transition(exploring, makeSave(), { type: 'COLLECT_WORD_IN_POPUP', wordId: 'word-a' }, testDef);
    expect(result.nextState).toEqual(exploring);
    expect(result.saveState).toBeUndefined();
  });
});

describe('word_reveal and COLLECT_WORD still work', () => {
  it('COLLECT_WORD produces word_collected sub-state', () => {
    const result = transition(exploring, makeSave(), { type: 'COLLECT_WORD', wordId: 'word-x' }, testDef);
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub).toEqual({ type: 'word_collected', wordIds: ['word-x'] });
    }
  });

  it('word_reveal produces word_collected sub-state with all new words', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-word-reveal' }, testDef);
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub).toEqual({ type: 'word_collected', wordIds: ['word-d', 'word-e'] });
    }
  });
});
