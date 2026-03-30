/**
 * Tests for Task 3 & 6: Word collection from examine/examine_image actions
 * and word_collected sub-state carrying wordIds array.
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
                    content: { ko: '편지', en: 'Letter' },
                    wordIds: ['word-a', 'word-b'],
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
                  id: 'hs-examine-image-with-words',
                  area: { type: 'rect', x: 20, y: 20, width: 10, height: 10 },
                  action: {
                    type: 'examine_image',
                    image: 'photo.jpg',
                    wordIds: ['word-c'],
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

describe('Word collection from examine actions (Task 3)', () => {
  it('examine action with wordIds collects words AND shows examining_text', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-with-words' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_text');
    }
    const collected = result.saveState?.caseStates?.['case-1']?.collectedWordIds ?? [];
    expect(collected).toContain('word-a');
    expect(collected).toContain('word-b');
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });

  it('examine action without wordIds shows examining_text with no save effect', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-no-words' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_text');
    }
    expect(result.saveState).toBeUndefined();
    expect(result.effects).toEqual([]);
  });

  it('examine_image action with wordIds collects words AND shows examining_image', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-image-with-words' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_image');
    }
    const collected = result.saveState?.caseStates?.['case-1']?.collectedWordIds ?? [];
    expect(collected).toContain('word-c');
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });

  it('already-collected words are not duplicated in examine action', () => {
    const save = makeSave();
    save.caseStates['case-1'].collectedWordIds = ['word-a'];
    const result = transition(exploring, save, { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-with-words' }, testDef);
    const collected = result.saveState?.caseStates?.['case-1']?.collectedWordIds ?? [];
    // word-a should not be duplicated, only word-b added
    expect(collected.filter(id => id === 'word-a').length).toBe(1);
    expect(collected).toContain('word-b');
  });

  it('all words already collected in examine action produces no save effect', () => {
    const save = makeSave();
    save.caseStates['case-1'].collectedWordIds = ['word-a', 'word-b'];
    const result = transition(exploring, save, { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-with-words' }, testDef);
    // Still transitions to examining_text
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_text');
    }
    expect(result.saveState).toBeUndefined();
    expect(result.effects).toEqual([]);
  });
});

describe('word_collected sub-state carries wordIds array (Task 6)', () => {
  it('COLLECT_WORD produces wordIds array with single element', () => {
    const result = transition(exploring, makeSave(), { type: 'COLLECT_WORD', wordId: 'word-x' }, testDef);
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub).toEqual({ type: 'word_collected', wordIds: ['word-x'] });
    }
  });

  it('word_reveal produces wordIds array with all new words', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-word-reveal' }, testDef);
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub).toEqual({ type: 'word_collected', wordIds: ['word-d', 'word-e'] });
    }
  });
});
