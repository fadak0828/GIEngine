/**
 * Unit tests for puzzle-handlers.ts (handleThinking)
 */
import { describe, it, expect } from 'vitest';
import { handleThinking } from '../src/state/puzzle-handlers.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type {
  GameDefinition,
  GameState,
  SaveState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CaseState,
  TimelinePuzzle,
  RelationshipPuzzle,
} from '../src/models/types.js';

// --- fixtures ---

const timelineSub: TimelinePuzzle = {
  id: 'pz-timeline',
  title: { ko: '타임라인', en: 'Timeline' },
  type: 'timeline',
  slots: [
    { slotId: 'tslot-1', label: { ko: '첫 번째', en: 'First' }, answerId: 'ev-morning' },
    { slotId: 'tslot-2', label: { ko: '두 번째', en: 'Second' }, answerId: 'ev-noon' },
    { slotId: 'tslot-3', label: { ko: '세 번째', en: 'Third' }, answerId: 'ev-night' },
  ],
};

const relationshipSub: RelationshipPuzzle = {
  id: 'pz-relationship',
  title: { ko: '관계도', en: 'Relationship' },
  type: 'relationship',
  nodes: [
    { id: 'n-alice', label: { ko: '앨리스', en: 'Alice' } },
    { id: 'n-bob', label: { ko: '밥', en: 'Bob' } },
  ],
  edges: [
    { fromNodeId: 'n-alice', toNodeId: 'n-bob', slotId: 'edge-ab', answerId: 'rel-suspect' },
    { fromNodeId: 'n-bob', toNodeId: 'n-alice', slotId: 'edge-ba', answerId: 'rel-alibi', symmetric: false },
  ],
};

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
            sub: [timelineSub, relationshipSub],
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

// ── Timeline SubPuzzle 통합 테스트 ────────────────────────────────

describe('handleThinking - Timeline SubPuzzle', () => {
  function makeTimelineSave(): SaveState {
    const save = createInitialSaveState(testDef);
    save.caseStates['case1'].puzzleStates['pz-timeline'] = {
      slotAssignments: { 'tslot-1': null, 'tslot-2': null, 'tslot-3': null },
      attemptCount: 0,
      solved: false,
    };
    return save;
  }

  it('정확한 순서 배정 후 VALIDATE_PUZZLE → solved', () => {
    const save = makeTimelineSave();
    save.caseStates['case1'].puzzleStates['pz-timeline'].slotAssignments = {
      'tslot-1': 'ev-morning',
      'tslot-2': 'ev-noon',
      'tslot-3': 'ev-night',
    };
    const state = makeThinkingState('pz-timeline');
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-timeline']?.solved).toBe(true);
    const nextState = result.nextState as GameState & { type: 'thinking' };
    expect(nextState.sub.type).toBe('solved');
  });

  it('잘못된 순서 배정 후 VALIDATE_PUZZLE → not solved', () => {
    const save = makeTimelineSave();
    save.caseStates['case1'].puzzleStates['pz-timeline'].slotAssignments = {
      'tslot-1': 'ev-noon',
      'tslot-2': 'ev-morning',
      'tslot-3': 'ev-night',
    };
    const state = makeThinkingState('pz-timeline');
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-timeline']?.solved).toBe(false);
    const nextState = result.nextState as GameState & { type: 'thinking' };
    expect(nextState.sub.type).toBe('showing_result');
  });

  it('충돌(중복) 배정 후 VALIDATE_PUZZLE → not solved', () => {
    const save = makeTimelineSave();
    save.caseStates['case1'].puzzleStates['pz-timeline'].slotAssignments = {
      'tslot-1': 'ev-morning',
      'tslot-2': 'ev-morning',  // 중복 충돌
      'tslot-3': 'ev-night',
    };
    const state = makeThinkingState('pz-timeline');
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-timeline']?.solved).toBe(false);
  });

  it('ASSIGN_WORD로 타임라인 슬롯에 단어 배정', () => {
    const save = makeTimelineSave();
    const state = makeThinkingState('pz-timeline');
    const result = handleThinking(
      state,
      save,
      { type: 'ASSIGN_WORD', slotId: 'tslot-1', wordId: 'ev-morning' },
      testDef
    );
    const assignments =
      result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-timeline']?.slotAssignments;
    expect(assignments?.['tslot-1']).toBe('ev-morning');
  });

  it('CLEAR_ALL_WORDS로 타임라인 슬롯 초기화', () => {
    const save = makeTimelineSave();
    save.caseStates['case1'].puzzleStates['pz-timeline'].slotAssignments = {
      'tslot-1': 'ev-morning',
      'tslot-2': 'ev-noon',
      'tslot-3': 'ev-night',
    };
    const state = makeThinkingState('pz-timeline');
    const result = handleThinking(state, save, { type: 'CLEAR_ALL_WORDS' }, testDef);
    const assignments =
      result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-timeline']?.slotAssignments;
    expect(Object.values(assignments ?? {}).every(v => v === null)).toBe(true);
  });

  it('시도 횟수 증가 확인', () => {
    const save = makeTimelineSave();
    save.caseStates['case1'].puzzleStates['pz-timeline'].slotAssignments = {
      'tslot-1': 'ev-wrong',
      'tslot-2': 'ev-noon',
      'tslot-3': 'ev-night',
    };
    save.caseStates['case1'].puzzleStates['pz-timeline'].attemptCount = 1;
    const state = makeThinkingState('pz-timeline');
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-timeline']?.attemptCount).toBe(2);
  });
});

// ── Relationship SubPuzzle 통합 테스트 ──────────────────────────────

describe('handleThinking - Relationship SubPuzzle', () => {
  function makeRelSave(): SaveState {
    const save = createInitialSaveState(testDef);
    save.caseStates['case1'].puzzleStates['pz-relationship'] = {
      slotAssignments: { 'edge-ab': null, 'edge-ba': null },
      attemptCount: 0,
      solved: false,
    };
    return save;
  }

  it('정확한 관계 배정 후 VALIDATE_PUZZLE → solved', () => {
    const save = makeRelSave();
    save.caseStates['case1'].puzzleStates['pz-relationship'].slotAssignments = {
      'edge-ab': 'rel-suspect',
      'edge-ba': 'rel-alibi',
    };
    const state = makeThinkingState('pz-relationship');
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-relationship']?.solved).toBe(true);
    const nextState = result.nextState as GameState & { type: 'thinking' };
    expect(nextState.sub.type).toBe('solved');
  });

  it('잘못된 관계 배정 후 VALIDATE_PUZZLE → not solved', () => {
    const save = makeRelSave();
    save.caseStates['case1'].puzzleStates['pz-relationship'].slotAssignments = {
      'edge-ab': 'rel-wrong',
      'edge-ba': 'rel-alibi',
    };
    const state = makeThinkingState('pz-relationship');
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-relationship']?.solved).toBe(false);
    const nextState = result.nextState as GameState & { type: 'thinking' };
    expect(nextState.sub.type).toBe('showing_result');
  });

  it('미배정 상태로 VALIDATE_PUZZLE → not solved', () => {
    const save = makeRelSave();
    const state = makeThinkingState('pz-relationship');
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-relationship']?.solved).toBe(false);
  });

  it('ASSIGN_WORD로 엣지에 관계 배정', () => {
    const save = makeRelSave();
    const state = makeThinkingState('pz-relationship');
    const result = handleThinking(
      state,
      save,
      { type: 'ASSIGN_WORD', slotId: 'edge-ab', wordId: 'rel-suspect' },
      testDef
    );
    const assignments =
      result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-relationship']?.slotAssignments;
    expect(assignments?.['edge-ab']).toBe('rel-suspect');
  });

  it('UNASSIGN_WORD로 엣지 관계 해제', () => {
    const save = makeRelSave();
    save.caseStates['case1'].puzzleStates['pz-relationship'].slotAssignments = {
      'edge-ab': 'rel-suspect',
      'edge-ba': 'rel-alibi',
    };
    const state = makeThinkingState('pz-relationship');
    const result = handleThinking(
      state,
      save,
      { type: 'UNASSIGN_WORD', slotId: 'edge-ab' },
      testDef
    );
    const assignments =
      result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-relationship']?.slotAssignments;
    expect(assignments?.['edge-ab']).toBeNull();
    expect(assignments?.['edge-ba']).toBe('rel-alibi');
  });

  it('시도 횟수 증가 확인', () => {
    const save = makeRelSave();
    save.caseStates['case1'].puzzleStates['pz-relationship'].attemptCount = 3;
    const state = makeThinkingState('pz-relationship');
    const result = handleThinking(state, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.puzzleStates?.['pz-relationship']?.attemptCount).toBe(4);
  });
});
