/**
 * Tests for Task 4: Inner hotspot clicks within examining_image sub-state.
 */

import { describe, it, expect } from 'vitest';
import { transition } from '../src/state/state-machine.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition, GameState, SaveState, Hotspot } from '../src/models/types.js';

const innerHotspots: Hotspot[] = [
  {
    id: 'inner-word',
    area: { type: 'rect', x: 10, y: 10, width: 5, height: 5 },
    action: { type: 'word_reveal', wordIds: ['word-hidden'] },
    cursor: 'pointer',
    ariaLabel: { ko: '숨겨진 단어', en: 'Hidden word' },
  },
  {
    id: 'inner-examine',
    area: { type: 'rect', x: 20, y: 20, width: 5, height: 5 },
    action: {
      type: 'examine',
      content: { ko: '내부 텍스트', en: 'Inner text' },
      wordIds: ['word-inner'],
    },
    cursor: 'pointer',
    ariaLabel: { ko: '내부', en: 'Inner' },
  },
];

const testDef: GameDefinition = {
  id: 'nested-hotspot-test',
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
                  id: 'hs-image-with-inner',
                  area: { type: 'rect', x: 0, y: 0, width: 100, height: 100 },
                  action: {
                    type: 'examine_image',
                    image: 'photo.jpg',
                    innerHotspots,
                  },
                  cursor: 'pointer',
                  ariaLabel: { ko: '사진', en: 'Photo' },
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
              answers: { 'slot-1': { correctWordId: 'word-hidden' } },
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

describe('Inner hotspot clicks (Task 4)', () => {
  // First open the image to get into examining_image sub-state
  function getExaminingImageState(): { state: GameState; save: SaveState } {
    const save = makeSave();
    const exploring: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'idle' },
    };
    const result = transition(exploring, save, { type: 'HOTSPOT_CLICK', hotspotId: 'hs-image-with-inner' }, testDef);
    return { state: result.nextState, save };
  }

  it('INNER_HOTSPOT_CLICK on word_reveal inner hotspot collects the word', () => {
    const { state, save } = getExaminingImageState();
    const result = transition(state, save, { type: 'INNER_HOTSPOT_CLICK', hotspotId: 'inner-word' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('word_collected');
      if (result.nextState.sub.type === 'word_collected') {
        expect(result.nextState.sub.wordIds).toContain('word-hidden');
      }
    }
    const collected = result.saveState?.caseStates?.['case-1']?.collectedWordIds ?? [];
    expect(collected).toContain('word-hidden');
  });

  it('INNER_HOTSPOT_CLICK on examine inner hotspot transitions to examining_text and collects words', () => {
    const { state, save } = getExaminingImageState();
    const result = transition(state, save, { type: 'INNER_HOTSPOT_CLICK', hotspotId: 'inner-examine' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_text');
    }
    const collected = result.saveState?.caseStates?.['case-1']?.collectedWordIds ?? [];
    expect(collected).toContain('word-inner');
  });

  it('INNER_HOTSPOT_CLICK with invalid hotspot ID returns no transition', () => {
    const { state, save } = getExaminingImageState();
    const result = transition(state, save, { type: 'INNER_HOTSPOT_CLICK', hotspotId: 'nonexistent' }, testDef);
    expect(result.nextState).toEqual(state);
  });

  it('INNER_HOTSPOT_CLICK in idle sub-state returns no transition', () => {
    const exploring: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'idle' },
    };
    const result = transition(exploring, makeSave(), { type: 'INNER_HOTSPOT_CLICK', hotspotId: 'inner-word' }, testDef);
    expect(result.nextState).toEqual(exploring);
  });

  it('INNER_HOTSPOT_CLICK in examining_image without innerHotspots returns no transition', () => {
    const state: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'examining_image', image: 'photo.jpg' },
    };
    const result = transition(state, makeSave(), { type: 'INNER_HOTSPOT_CLICK', hotspotId: 'inner-word' }, testDef);
    expect(result.nextState).toEqual(state);
  });
});
