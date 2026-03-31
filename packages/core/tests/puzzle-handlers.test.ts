/**
 * Unit tests for puzzle-handlers.ts (handleThinking)
 */
import { describe, it, expect } from 'vitest';
import { handleThinking } from '../src/state/puzzle-handlers.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition, GameState, SaveState, CaseState } from '../src/models/types.js';

// --- fixture ---

const testDef: GameDefinition = {
  id: 'g',
  version: '1.0.0',
  title: { ko: '게임', en: 'Game' },
  description: { ko: '', en: '' },
  supportedLocales: ['ko', 'en'],
  settings: {
    validationFeedbackDuration: 1500,
    autoSaveInterval: 30000,
    debug: false,
    unlockMode: 'sequential',
    cssPrefix: 'gi',
  },
  acts: [
    {
      id: 'act1',
      title: { ko: '막1', en: 'Act1' },
      cases: [
        {
          id: 'case1',
          title: { ko: '사건1', en: 'Case1' },
          description: { ko: '', en: '' },
          scenes: [
            { id: 'scene1', name: { ko: 'S1', en: 'S1' }, background: '', dimensions: { width: 1280, height: 720 }, hotspots: [], layers: [] },
          ],
          puzzles: {
            main: {
              id: 'pz-main',
              title: { ko: '메인', en: 'Main' },
              type: 'fill_in_blank',
              template: { segments: [{ id: 's1', type: 'slot', slotId: 'slot1' }] },
              answers: { slot1: { correctWordId: 'correct-word' } },
            },
            sub: [],
          },
          prerequisites: [],
          thumbnail: '',
        },
        // second case ensures that solving case1 gives case_completed, not game_completed
        {
          id: 'case2',
          title: { ko: '사건2', en: 'Case2' },
          description: { ko: '', en: '' },
          scenes: [
            { id: 'scene2', name: { ko: 'S2', en: 'S2' }, background: '', dimensions: { width: 1280, height: 720 }, hotspots: [], layers: [] },
          ],
          puzzles: {
            main: { id: 'pz-main2', title: { ko: '메인2', en: 'Main2' }, type: 'fill_in_blank', template: { segments: [] }, answers: {} },
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

function makeThinkingState(puzzleId = 'pz-main'): GameState & { type: 'thinking' } {
  return { type: 'thinking', caseId: 'case1', puzzleId, sub: { type: 'editing' } };
}

function makeSave(): SaveState {
  const save = createInitialSaveState(testDef);
  // First case is unlocked by default in sequential mode
  save.caseStates['case1'].puzzleStates['pz-main'] = {
    slotAssignments: { slot1: null },
    attemptCount: 0,
    solved: false,
  };
  return save;
}

// ── ASSIGN_WORD ───────────────────────────────────────────────────

describe('handleThinking ASSIGN_WORD', () => {
  it('assigns a word to a slot', () => {
    const save = makeSave();
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'ASSIGN_WORD', slotId: 'slot1', wordId: 'word-a' }, testDef);
    const updatedPuzzle = result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-main'];
    expect(updatedPuzzle?.slotAssignments?.['slot1']).toBe('word-a');
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });

  it('removes word from other slots when assigning the same word', () => {
    const save = makeSave();
    save.caseStates['case1'].puzzleStates['pz-main'].slotAssignments = { slot1: null, slot2: 'word-a' };
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'ASSIGN_WORD', slotId: 'slot1', wordId: 'word-a' }, testDef);
    const assignments = result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-main']?.slotAssignments;
    expect(assignments?.['slot1']).toBe('word-a');
    expect(assignments?.['slot2']).toBeNull();
  });
});

// ── UNASSIGN_WORD ─────────────────────────────────────────────────

describe('handleThinking UNASSIGN_WORD', () => {
  it('unassigns a word from a slot', () => {
    const save = makeSave();
    save.caseStates['case1'].puzzleStates['pz-main'].slotAssignments = { slot1: 'word-a' };
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'UNASSIGN_WORD', slotId: 'slot1' }, testDef);
    const assignments = result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-main']?.slotAssignments;
    expect(assignments?.['slot1']).toBeNull();
  });
});

// ── CLEAR_ALL_WORDS ───────────────────────────────────────────────

describe('handleThinking CLEAR_ALL_WORDS', () => {
  it('clears all slot assignments', () => {
    const save = makeSave();
    save.caseStates['case1'].puzzleStates['pz-main'].slotAssignments = { slot1: 'w1', slot2: 'w2' };
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'CLEAR_ALL_WORDS' }, testDef);
    const assignments = result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-main']?.slotAssignments;
    expect(assignments?.['slot1']).toBeNull();
    expect(assignments?.['slot2']).toBeNull();
  });
});

// ── VALIDATE_PUZZLE ───────────────────────────────────────────────

describe('handleThinking VALIDATE_PUZZLE', () => {
  it('marks puzzle as solved when correct answer provided', () => {
    const save = makeSave();
    save.caseStates['case1'].puzzleStates['pz-main'].slotAssignments = { slot1: 'correct-word' };
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    const pzState = result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-main'];
    expect(pzState?.solved).toBe(true);
    expect(pzState?.attemptCount).toBe(1);
    const nextState = result.nextState as GameState & { type: 'thinking' };
    expect(nextState.sub.type).toBe('solved');
  });

  it('marks puzzle as not solved when wrong answer', () => {
    const save = makeSave();
    save.caseStates['case1'].puzzleStates['pz-main'].slotAssignments = { slot1: 'wrong-word' };
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    const pzState = result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-main'];
    expect(pzState?.solved).toBe(false);
    const nextState = result.nextState as GameState & { type: 'thinking' };
    expect(nextState.sub.type).toBe('showing_result');
  });

  it('increments attempt count on each validation', () => {
    const save = makeSave();
    save.caseStates['case1'].puzzleStates['pz-main'].slotAssignments = { slot1: 'wrong-word' };
    save.caseStates['case1'].puzzleStates['pz-main'].attemptCount = 2;
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-main']?.attemptCount).toBe(3);
  });
});

// ── CLOSE_PUZZLE ──────────────────────────────────────────────────

describe('handleThinking CLOSE_PUZZLE', () => {
  it('returns to exploring state when puzzle not solved', () => {
    const save = makeSave();
    save.currentPosition = { caseId: 'case1', sceneId: 'scene1' };
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'CLOSE_PUZZLE' }, testDef);
    expect(result.nextState.type).toBe('exploring');
  });

  it('transitions to case_completed when main puzzle is solved (more cases remain)', () => {
    const save = makeSave();
    save.caseStates['case1'].status = 'completed';
    save.caseStates['case1'].puzzleStates['pz-main'].solved = true;
    // case2 is still locked — not all cases completed, so case_completed (not game_completed)
    save.caseStates['case2'] = {
      status: 'locked',
      visitedSceneIds: [],
      collectedWordIds: [],
      layerVisibility: {},
      puzzleStates: {},
    };
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'CLOSE_PUZZLE' }, testDef);
    expect(result.nextState.type).toBe('case_completed');
  });
});

// ── BACK_TO_SELECT ────────────────────────────────────────────────

describe('handleThinking BACK_TO_SELECT', () => {
  it('returns to case_select state', () => {
    const save = makeSave();
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'BACK_TO_SELECT' }, testDef);
    expect(result.nextState.type).toBe('case_select');
    expect(result.saveState?.currentPosition).toBeNull();
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });
});

// ── Solved puzzle guard ───────────────────────────────────────────

describe('handleThinking solved puzzle guard', () => {
  it('no transition for ASSIGN_WORD when puzzle already solved', () => {
    const save = makeSave();
    save.caseStates['case1'].puzzleStates['pz-main'].solved = true;
    const state = makeThinkingState();
    const result = handleThinking(state, save, { type: 'ASSIGN_WORD', slotId: 'slot1', wordId: 'w' }, testDef);
    expect(result.nextState).toBe(state);
    expect(result.effects).toEqual([]);
  });
});
