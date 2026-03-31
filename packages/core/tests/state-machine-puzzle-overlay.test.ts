/**
 * Tests for Task 5: Puzzle overlay in exploring state.
 */

import { describe, it, expect } from 'vitest';
import { transition } from '../src/state/state-machine.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition, GameState, SaveState } from '../src/models/types.js';

const testDef: GameDefinition = {
  id: 'puzzle-overlay-test',
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
              hotspots: [],
              layers: [],
            },
          ],
          puzzles: {
            main: {
              id: 'puzzle-main',
              title: { ko: '메인', en: 'Main' },
              type: 'fill_in_blank',
              template: { segments: [{ type: 'slot', slotId: 'slot-1' }] },
              answers: { 'slot-1': { correctWordId: 'word-answer' } },
            },
            sub: [
              {
                id: 'sub-puzzle-1',
                title: { ko: '서브', en: 'Sub' },
                type: 'scenario',
                template: {
                  segments: [
                    { type: 'slot', slotId: 'sub-slot-a' },
                    { type: 'slot', slotId: 'sub-slot-b' },
                  ],
                },
                answers: {
                  'sub-slot-a': { correctWordId: 'word-x' },
                  'sub-slot-b': { correctWordId: 'word-y' },
                },
              },
            ],
          },
        },
      ],
    },
  ],
  assets: { items: {} },
};

function makeSave(): SaveState {
  const save = createInitialSaveState(testDef);
  // Ensure sub-puzzle state exists
  save.caseStates['case-1'].puzzleStates['sub-puzzle-1'] = {
    solved: false,
    slotAssignments: { 'sub-slot-a': null, 'sub-slot-b': null },
    attemptCount: 0,
  };
  return save;
}

const exploring: GameState = {
  type: 'exploring',
  caseId: 'case-1',
  sceneId: 'scene-1',
  sub: { type: 'idle' },
};

describe('Puzzle overlay in exploring state (Task 5)', () => {
  it('OPEN_PUZZLE_OVERLAY transitions sub to puzzle_overlay', () => {
    const result = transition(exploring, makeSave(), { type: 'OPEN_PUZZLE_OVERLAY', puzzleId: 'sub-puzzle-1' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub).toEqual({ type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' });
    }
  });

  it('OPEN_PUZZLE_OVERLAY with non-existent puzzle returns no transition', () => {
    const result = transition(exploring, makeSave(), { type: 'OPEN_PUZZLE_OVERLAY', puzzleId: 'nonexistent' }, testDef);
    expect(result.nextState).toEqual(exploring);
  });

  it('CLOSE_PUZZLE_OVERLAY transitions sub back to idle', () => {
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' },
    };
    const result = transition(overlayState, makeSave(), { type: 'CLOSE_PUZZLE_OVERLAY' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('idle');
    }
  });

  it('OPEN_PUZZLE still transitions to thinking state (backward compat)', () => {
    const result = transition(exploring, makeSave(), { type: 'OPEN_PUZZLE', puzzleId: 'puzzle-main' }, testDef);
    expect(result.nextState.type).toBe('thinking');
    if (result.nextState.type === 'thinking') {
      expect(result.nextState.puzzleId).toBe('puzzle-main');
      expect(result.nextState.sub.type).toBe('editing');
    }
  });

  it('ASSIGN_WORD works in puzzle_overlay sub-state', () => {
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' },
    };
    const result = transition(overlayState, makeSave(), { type: 'ASSIGN_WORD', slotId: 'sub-slot-a', wordId: 'word-x' }, testDef);
    const ps = result.saveState?.caseStates?.['case-1']?.puzzleStates?.['sub-puzzle-1'];
    expect(ps?.slotAssignments['sub-slot-a']).toBe('word-x');
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });

  it('ASSIGN_WORD in puzzle_overlay removes word from other slots', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'].slotAssignments = {
      'sub-slot-a': 'word-x',
      'sub-slot-b': null,
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' },
    };
    const result = transition(overlayState, save, { type: 'ASSIGN_WORD', slotId: 'sub-slot-b', wordId: 'word-x' }, testDef);
    const ps = result.saveState?.caseStates?.['case-1']?.puzzleStates?.['sub-puzzle-1'];
    expect(ps?.slotAssignments['sub-slot-b']).toBe('word-x');
    expect(ps?.slotAssignments['sub-slot-a']).toBeNull();
  });

  it('ASSIGN_WORD in idle sub-state returns no transition', () => {
    const result = transition(exploring, makeSave(), { type: 'ASSIGN_WORD', slotId: 'sub-slot-a', wordId: 'word-x' }, testDef);
    expect(result.nextState).toEqual(exploring);
  });

  it('UNASSIGN_WORD works in puzzle_overlay sub-state', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'].slotAssignments = {
      'sub-slot-a': 'word-x',
      'sub-slot-b': null,
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' },
    };
    const result = transition(overlayState, save, { type: 'UNASSIGN_WORD', slotId: 'sub-slot-a' }, testDef);
    const ps = result.saveState?.caseStates?.['case-1']?.puzzleStates?.['sub-puzzle-1'];
    expect(ps?.slotAssignments['sub-slot-a']).toBeNull();
  });

  it('CLEAR_ALL_WORDS works in puzzle_overlay sub-state', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'].slotAssignments = {
      'sub-slot-a': 'word-x',
      'sub-slot-b': 'word-y',
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' },
    };
    const result = transition(overlayState, save, { type: 'CLEAR_ALL_WORDS' }, testDef);
    const ps = result.saveState?.caseStates?.['case-1']?.puzzleStates?.['sub-puzzle-1'];
    expect(ps?.slotAssignments['sub-slot-a']).toBeNull();
    expect(ps?.slotAssignments['sub-slot-b']).toBeNull();
  });

  it('VALIDATE_PUZZLE works in puzzle_overlay sub-state', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'].slotAssignments = {
      'sub-slot-a': 'word-x',
      'sub-slot-b': 'word-y',
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' },
    };
    const result = transition(overlayState, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    const ps = result.saveState?.caseStates?.['case-1']?.puzzleStates?.['sub-puzzle-1'];
    expect(ps?.solved).toBe(true);
    expect(ps?.attemptCount).toBe(1);
    // State stays in exploring with puzzle_overlay
    expect(result.nextState.type).toBe('exploring');
  });

  it('VALIDATE_PUZZLE correct answer sets solved flag in sub-state (celebration trigger)', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'].slotAssignments = {
      'sub-slot-a': 'word-x',
      'sub-slot-b': 'word-y',
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' },
    };
    const result = transition(overlayState, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    // Sub-state should have solved=true to trigger celebration in renderer
    if (result.nextState.type === 'exploring' && result.nextState.sub.type === 'puzzle_overlay') {
      expect(result.nextState.sub.solved).toBe(true);
    } else {
      throw new Error('Expected exploring/puzzle_overlay state');
    }
  });

  it('VALIDATE_PUZZLE incorrect answer does not set solved flag', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'].slotAssignments = {
      'sub-slot-a': 'word-wrong',
      'sub-slot-b': 'word-y',
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1' },
    };
    const result = transition(overlayState, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    if (result.nextState.type === 'exploring' && result.nextState.sub.type === 'puzzle_overlay') {
      expect(result.nextState.sub.solved).toBeUndefined();
    } else {
      throw new Error('Expected exploring/puzzle_overlay state');
    }
  });

  it('VALIDATE_PUZZLE correct on main puzzle marks case as completed', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['puzzle-main'] = {
      solved: false,
      slotAssignments: { 'slot-1': 'word-answer' },
      attemptCount: 0,
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'puzzle-main' },
    };
    const result = transition(overlayState, save, { type: 'VALIDATE_PUZZLE' }, testDef);
    expect(result.saveState?.caseStates?.['case-1']?.status).toBe('completed');
  });

  it('CLOSE_PUZZLE_OVERLAY after solving main puzzle (single case) transitions to game_completed', () => {
    // With only one case in testDef and it being completed → game_completed
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['puzzle-main'] = {
      solved: true,
      slotAssignments: { 'slot-1': 'word-answer' },
      attemptCount: 1,
    };
    save.caseStates['case-1'].status = 'completed';
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'puzzle-main', solved: true },
    };
    const result = transition(overlayState, save, { type: 'CLOSE_PUZZLE_OVERLAY' }, testDef);
    // Single-case game → all cases completed → game_completed
    expect(result.nextState.type).toBe('game_completed');
  });

  it('CLOSE_PUZZLE_OVERLAY after solving non-main puzzle returns to idle', () => {
    const save = makeSave();
    save.caseStates['case-1'].puzzleStates['sub-puzzle-1'] = {
      solved: true,
      slotAssignments: { 'sub-slot-a': 'word-x', 'sub-slot-b': 'word-y' },
      attemptCount: 1,
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'sub-puzzle-1', solved: true },
    };
    const result = transition(overlayState, save, { type: 'CLOSE_PUZZLE_OVERLAY' }, testDef);
    // Non-main puzzle → back to idle
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('idle');
    }
  });
});

// ─── CLOSE_PUZZLE in puzzle_overlay context (regression test for back-button bug) ─

describe('CLOSE_PUZZLE dispatched from DeductionRenderer in puzzle_overlay context', () => {
  it('CLOSE_PUZZLE in puzzle_overlay → returns to idle (same as CLOSE_PUZZLE_OVERLAY)', () => {
    // DeductionRenderer의 돌아가기 버튼은 CLOSE_PUZZLE을 dispatch하는데,
    // 메인 퍼즐이 puzzle_overlay로 열린 경우 state는 exploring이므로
    // CLOSE_PUZZLE이 처리되지 않아 버튼이 동작하지 않는 버그 재현.
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'puzzle-main' },
    };
    const result = transition(overlayState, makeSave(), { type: 'CLOSE_PUZZLE' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    if (result.nextState.type === 'exploring') {
      expect(result.nextState.sub.type).toBe('idle');
    }
  });

  it('CLOSE_PUZZLE in puzzle_overlay with solved main puzzle → case_completed', () => {
    const save = makeSave();
    save.caseStates['case-1'].status = 'completed';
    save.caseStates['case-1'].puzzleStates['puzzle-main'] = {
      solved: true,
      slotAssignments: { 'slot-1': 'word-answer' },
      attemptCount: 1,
    };
    const overlayState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'puzzle_overlay', puzzleId: 'puzzle-main', solved: true },
    };
    const result = transition(overlayState, save, { type: 'CLOSE_PUZZLE' }, testDef);
    // Single-case game → all cases completed → game_completed
    expect(result.nextState.type).toBe('game_completed');
  });

  it('CLOSE_PUZZLE outside puzzle_overlay → no transition', () => {
    // puzzle_overlay 서브스테이트가 아닐 때는 CLOSE_PUZZLE을 무시해야 함
    const idleState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1',
      sub: { type: 'idle' },
    };
    const result = transition(idleState, makeSave(), { type: 'CLOSE_PUZZLE' }, testDef);
    expect(result.nextState).toEqual(idleState);
  });
});
