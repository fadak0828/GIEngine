/**
 * Additional state machine tests to cover gaps:
 * - game_completed state
 * - TOGGLE_LAYER / CLOSE_POPUP / examine_image / toggle_layer / composite hotspot actions
 * - BACK_TO_SELECT from thinking state
 * - SELECT_CASE from case_completed
 * - all_unlocked mode
 * - game completion on CLOSE_PUZZLE (all cases done)
 * - ASSIGN_WORD word-swap logic
 * - solved puzzle rejects further mutation events
 * - invalid hotspot / invalid scene guard paths
 * - VALIDATE_PUZZLE with a sub-puzzle
 * - CLOSE_PUZZLE with a solved non-main sub-puzzle
 * - word_reveal for already-collected words
 */

import { describe, it, expect } from 'vitest';
import { transition } from '../src/state/state-machine.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition, GameState, SaveState } from '../src/models/types.js';

// ─── Minimal two-case game definition ───────────────────────────────────────

const testDef: GameDefinition = {
  id: 'extra-test-game',
  version: '1.0.0',
  title: { ko: '추가 테스트', en: 'Extra Test' },
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
              id: 'scene-1a',
              name: { ko: '거실', en: 'Living Room' },
              background: '',
              dimensions: { width: 1920, height: 1080 },
              hotspots: [
                {
                  id: 'hs-examine-image',
                  area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
                  action: { type: 'examine_image', image: 'photo.jpg' },
                  cursor: 'pointer',
                  ariaLabel: { ko: '이미지', en: 'Image' },
                },
                {
                  id: 'hs-toggle-layer',
                  area: { type: 'rect', x: 10, y: 10, width: 10, height: 10 },
                  action: { type: 'toggle_layer', layerId: 'layer-1', visible: true },
                  cursor: 'pointer',
                  ariaLabel: { ko: '레이어', en: 'Layer' },
                },
                {
                  id: 'hs-composite',
                  area: { type: 'rect', x: 20, y: 20, width: 10, height: 10 },
                  action: {
                    type: 'composite',
                    actions: [
                      { type: 'examine', content: { ko: '복합', en: 'Composite' } },
                    ],
                  },
                  cursor: 'pointer',
                  ariaLabel: { ko: '복합', en: 'Composite' },
                },
                {
                  id: 'hs-composite-empty',
                  area: { type: 'rect', x: 30, y: 30, width: 10, height: 10 },
                  action: { type: 'composite', actions: [] },
                  cursor: 'pointer',
                  ariaLabel: { ko: '빈 복합', en: 'Empty Composite' },
                },
                {
                  id: 'hs-word-dupe',
                  area: { type: 'rect', x: 40, y: 40, width: 10, height: 10 },
                  action: { type: 'word_reveal', wordIds: ['word-knife'] },
                  cursor: 'pointer',
                  ariaLabel: { ko: '칼', en: 'Knife' },
                },
              ],
              layers: [],
            },
          ],
          puzzles: {
            main: {
              id: 'puzzle-main-1',
              title: { ko: '메인 퍼즐', en: 'Main Puzzle' },
              type: 'fill_in_blank',
              template: { segments: [{ type: 'slot', slotId: 'slot-killer' }] },
              answers: { 'slot-killer': { correctWordId: 'word-john' } },
            },
            sub: [
              {
                id: 'sub-puzzle-1',
                title: { ko: '서브', en: 'Sub' },
                type: 'scenario',
                template: { segments: [{ type: 'slot', slotId: 'slot-a' }] },
                answers: { 'slot-a': { correctWordId: 'word-a' } },
              },
            ],
          },
        },
        {
          id: 'case-2',
          title: { ko: '사건 2', en: 'Case 2' },
          description: { ko: '', en: '' },
          prerequisites: ['case-1'],
          thumbnail: '',
          scenes: [
            {
              id: 'scene-2a',
              name: { ko: '정원', en: 'Garden' },
              background: '',
              dimensions: { width: 1920, height: 1080 },
              hotspots: [],
              layers: [],
            },
          ],
          puzzles: {
            main: {
              id: 'puzzle-main-2',
              title: { ko: '메인 퍼즐 2', en: 'Main Puzzle 2' },
              type: 'fill_in_blank',
              template: { segments: [{ type: 'slot', slotId: 'slot-who' }] },
              answers: { 'slot-who': { correctWordId: 'word-mary' } },
            },
            sub: [],
          },
        },
      ],
    },
  ],
  assets: { items: {} },
};

/** Game def with `all_unlocked` mode and a single case, for game_completed test */
const singleCaseDef: GameDefinition = {
  ...testDef,
  id: 'single-case-game',
  settings: { ...testDef.settings, unlockMode: 'all_unlocked' },
  acts: [
    {
      id: 'act-1',
      title: { ko: '1막', en: 'Act 1' },
      cases: [testDef.acts[0].cases[0]],
    },
  ],
};

function makeSave(def: GameDefinition = testDef): SaveState {
  return createInitialSaveState(def);
}

// ─── game_completed state ────────────────────────────────────────────────────

describe('GameCompleted state', () => {
  const gcState: GameState = { type: 'game_completed' };

  it('BACK_TO_SELECT → case_select', () => {
    const result = transition(gcState, makeSave(), { type: 'BACK_TO_SELECT' }, testDef);
    expect(result.nextState.type).toBe('case_select');
  });

  it('any other event → no transition', () => {
    const result = transition(gcState, makeSave(), { type: 'ASSETS_LOADED' }, testDef);
    expect(result.nextState.type).toBe('game_completed');
  });
});

// ─── CLOSE_PUZZLE → game_completed when all cases are done ─────────────────

describe('CLOSE_PUZZLE triggers game_completed when all cases solved', () => {
  it('single-case game, main puzzle solved + case already completed → game_completed', () => {
    const save = makeSave(singleCaseDef);
    // Both puzzle must be solved AND case status must be 'completed'
    // (VALIDATE_PUZZLE sets status=completed in the save; CLOSE_PUZZLE reads from save)
    save.caseStates['case-1'].puzzleStates['puzzle-main-1'].solved = true;
    save.caseStates['case-1'].status = 'completed';

    const thinking: GameState = {
      type: 'thinking',
      caseId: 'case-1',
      puzzleId: 'puzzle-main-1',
      sub: { type: 'editing' },
    };

    const result = transition(thinking, save, { type: 'CLOSE_PUZZLE' }, singleCaseDef);
    // All cases complete → game_completed
    expect(result.nextState.type).toBe('game_completed');
  });
});

// ─── CaseCompleted state ─────────────────────────────────────────────────────

describe('CaseCompleted state', () => {
  const ccState: GameState = { type: 'case_completed', caseId: 'case-1' };

  it('SELECT_CASE → falls through to case_select', () => {
    const result = transition(ccState, makeSave(), { type: 'SELECT_CASE', caseId: 'case-2' }, testDef);
    expect(result.nextState.type).toBe('case_select');
  });

  it('unrelated event → no transition', () => {
    const result = transition(ccState, makeSave(), { type: 'ASSETS_LOADED' }, testDef);
    expect(result.nextState.type).toBe('case_completed');
  });
});

// ─── Exploring: TOGGLE_LAYER, CLOSE_POPUP, examine_image, toggle_layer hs ──

describe('Exploring: additional hotspot actions and events', () => {
  const exploring: GameState = {
    type: 'exploring',
    caseId: 'case-1',
    sceneId: 'scene-1a',
    sub: { type: 'idle' },
  };

  it('HOTSPOT_CLICK(examine_image) → examining_image sub-state', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-image' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_image');
    }
  });

  it('HOTSPOT_CLICK(toggle_layer) → idle sub-state + layer visibility updated', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-toggle-layer' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('idle');
    }
    expect(result.saveState?.caseStates?.['case-1']?.layerVisibility?.['layer-1']).toBe(true);
  });

  it('HOTSPOT_CLICK(composite with actions) → delegates to first action', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-composite' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('examining_text');
    }
  });

  it('HOTSPOT_CLICK(composite with no actions) → no transition', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hs-composite-empty' }, testDef);
    expect(result.nextState).toEqual(exploring);
  });

  it('HOTSPOT_CLICK with invalid hotspot id → no transition', () => {
    const result = transition(exploring, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'nonexistent' }, testDef);
    expect(result.nextState).toEqual(exploring);
  });

  it('NAVIGATE_SCENE to invalid scene → no transition', () => {
    const result = transition(exploring, makeSave(), { type: 'NAVIGATE_SCENE', sceneId: 'nonexistent-scene' }, testDef);
    expect(result.nextState).toEqual(exploring);
  });

  it('CLOSE_POPUP → idle sub-state', () => {
    const examiningState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1a',
      sub: { type: 'examining_text', content: { ko: '...', en: '...' } },
    };
    const result = transition(examiningState, makeSave(), { type: 'CLOSE_POPUP' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('idle');
    }
  });

  it('TOGGLE_LAYER event → updates layer visibility', () => {
    const result = transition(exploring, makeSave(), { type: 'TOGGLE_LAYER', layerId: 'layer-x', visible: false }, testDef);
    expect(result.nextState.type).toBe('exploring');
    expect(result.saveState?.caseStates?.['case-1']?.layerVisibility?.['layer-x']).toBe(false);
  });

  it('word_reveal for already-collected words → no transition', () => {
    const save = makeSave();
    save.caseStates['case-1'].collectedWordIds = ['word-knife'];
    const result = transition(exploring, save, { type: 'HOTSPOT_CLICK', hotspotId: 'hs-word-dupe' }, testDef);
    // Already collected → noTransition
    expect(result.nextState).toEqual(exploring);
  });
});

// ─── Thinking: additional transitions ───────────────────────────────────────

describe('Thinking: additional transitions', () => {
  const thinking: GameState = {
    type: 'thinking',
    caseId: 'case-1',
    puzzleId: 'puzzle-main-1',
    sub: { type: 'editing' },
  };

  it('BACK_TO_SELECT from thinking → case_select', () => {
    const result = transition(thinking, makeSave(), { type: 'BACK_TO_SELECT' }, testDef);
    expect(result.nextState.type).toBe('case_select');
    expect(result.saveState?.currentPosition).toBeNull();
  });

  it('ASSIGN_WORD moves word from existing slot', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['puzzle-main-1'].slotAssignments = {
      'slot-killer': 'word-john',
      'slot-other': null,
    };
    // Now assign word-john to slot-other — should remove from slot-killer
    const result = transition(thinking, save, { type: 'ASSIGN_WORD', slotId: 'slot-other', wordId: 'word-john' }, testDef);
    const ps = result.saveState?.caseStates?.['case-1']?.puzzleStates?.['puzzle-main-1'];
    expect(ps?.slotAssignments['slot-other']).toBe('word-john');
    expect(ps?.slotAssignments['slot-killer']).toBeNull();
  });

  it('Solved puzzle rejects ASSIGN_WORD', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['puzzle-main-1'].solved = true;
    const result = transition(thinking, save, { type: 'ASSIGN_WORD', slotId: 'slot-killer', wordId: 'word-john' }, testDef);
    // Should be noTransition when puzzle already solved
    expect(result.nextState).toEqual(thinking);
  });

  it('Solved puzzle rejects UNASSIGN_WORD', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['puzzle-main-1'].solved = true;
    const result = transition(thinking, save, { type: 'UNASSIGN_WORD', slotId: 'slot-killer' }, testDef);
    expect(result.nextState).toEqual(thinking);
  });

  it('VALIDATE_PUZZLE with sub-puzzle (scenario type)', () => {
    const subThinking: GameState = {
      type: 'thinking',
      caseId: 'case-1',
      puzzleId: 'sub-puzzle-1',
      sub: { type: 'editing' },
    };
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'] = {
      solved: false,
      slotAssignments: { 'slot-a': 'word-a' },
      attemptCount: 0,
    };
    const result = transition(subThinking, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    if (result.nextState.type === 'thinking') {
      expect(result.nextState.sub.type).toBe('solved');
    }
  });

  it('CLOSE_PUZZLE with solved non-main puzzle → exploring (not case_completed)', () => {
    const subThinking: GameState = {
      type: 'thinking',
      caseId: 'case-1',
      puzzleId: 'sub-puzzle-1',
      sub: { type: 'editing' },
    };
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'] = {
      solved: true,
      slotAssignments: { 'slot-a': 'word-a' },
      attemptCount: 1,
    };
    const result = transition(subThinking, save, { type: 'CLOSE_PUZZLE' }, testDef);
    // Not the main puzzle → back to exploring
    expect(result.nextState.type).toBe('exploring');
  });
});

// ─── CaseSelect: invalid / no-scene cases ────────────────────────────────────

describe('CaseSelect: guards', () => {
  it('SELECT_CASE for a non-existent case → no transition', () => {
    const state: GameState = { type: 'case_select' };
    const result = transition(state, makeSave(), { type: 'SELECT_CASE', caseId: 'nonexistent' }, testDef);
    expect(result.nextState.type).toBe('case_select');
  });
});

// ─── all_unlocked mode: no next-case unlock side effect ──────────────────────

describe('all_unlocked mode: VALIDATE_PUZZLE', () => {
  const unlockDef: GameDefinition = {
    ...testDef,
    id: 'unlock-test',
    settings: { ...testDef.settings, unlockMode: 'all_unlocked' },
  };

  it('solving main puzzle in all_unlocked mode does not produce unlock_case effect', () => {
    const save = makeSave(unlockDef);
    save.caseStates['case-1'].puzzleStates['puzzle-main-1'].slotAssignments = {
      'slot-killer': 'word-john',
    };
    const thinking: GameState = {
      type: 'thinking',
      caseId: 'case-1',
      puzzleId: 'puzzle-main-1',
      sub: { type: 'editing' },
    };
    const result = transition(thinking, save, { type: 'VALIDATE_PUZZLE' }, unlockDef);
    const hasUnlock = result.effects.some(e => e.type === 'unlock_case');
    expect(hasUnlock).toBe(false);
  });
});
