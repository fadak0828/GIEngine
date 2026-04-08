/**
 * Unit tests for save-state-handlers.ts
 * Tests handleLoading, handleCaseSelect, handleCaseCompleted, handleGameCompleted
 */
import { describe, it, expect } from 'vitest';
import {
  handleLoading,
  handleCaseSelect,
  handleCaseCompleted,
  handleGameCompleted,
} from '../src/state/save-state-handlers.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition, GameState } from '../src/models/types.js';

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
            main: { id: 'pz1', title: { ko: '퍼즐', en: 'Puzzle' }, type: 'fill_in_blank', template: { segments: [] }, answers: {} },
            sub: [],
          },
          prerequisites: [],
          thumbnail: '',
        },
        {
          id: 'case2',
          title: { ko: '사건2', en: 'Case2' },
          description: { ko: '', en: '' },
          scenes: [
            { id: 'scene2', name: { ko: 'S2', en: 'S2' }, background: '', dimensions: { width: 1280, height: 720 }, hotspots: [], layers: [] },
          ],
          puzzles: {
            main: { id: 'pz2', title: { ko: '퍼즐2', en: 'Puzzle2' }, type: 'fill_in_blank', template: { segments: [] }, answers: {} },
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

const save = createInitialSaveState(testDef);

// ── handleLoading ─────────────────────────────────────────────────

describe('handleLoading', () => {
  const loadingState: GameState & { type: 'loading' } = { type: 'loading' };

  it('transitions to case_select on ASSETS_LOADED', () => {
    const result = handleLoading(loadingState, save, { type: 'ASSETS_LOADED' }, testDef);
    expect(result.nextState.type).toBe('case_select');
    expect(result.effects).toEqual([]);
  });

  it('no transition for unrecognised events', () => {
    const result = handleLoading(loadingState, save, { type: 'BACK_TO_SELECT' }, testDef);
    expect(result.nextState).toBe(loadingState);
  });
});

// ── handleCaseSelect ──────────────────────────────────────────────

describe('handleCaseSelect', () => {
  const caseSelectState: GameState & { type: 'case_select' } = { type: 'case_select' };

  it('transitions to exploring when unlocked case is selected', () => {
    const save2 = createInitialSaveState(testDef);
    save2.caseStates['case1'].status = 'unlocked';
    const result = handleCaseSelect(caseSelectState, save2, { type: 'SELECT_CASE', caseId: 'case1' }, testDef);
    expect(result.nextState.type).toBe('exploring');
    const state = result.nextState as GameState & { type: 'exploring' };
    expect(state.caseId).toBe('case1');
    expect(state.sceneId).toBe('scene1');
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });

  it('no transition for locked case', () => {
    const lockedSave = createInitialSaveState(testDef);
    // case2 is locked by default in sequential mode (first case is unlocked)
    const result = handleCaseSelect(caseSelectState, lockedSave, { type: 'SELECT_CASE', caseId: 'case2' }, testDef);
    expect(result.nextState.type).toBe('case_select');
  });

  it('no transition for unknown case id', () => {
    const result = handleCaseSelect(caseSelectState, save, { type: 'SELECT_CASE', caseId: 'unknown' }, testDef);
    expect(result.nextState.type).toBe('case_select');
  });

  it('no transition for non-SELECT_CASE events', () => {
    const result = handleCaseSelect(caseSelectState, save, { type: 'BACK_TO_SELECT' }, testDef);
    expect(result.nextState).toBe(caseSelectState);
  });
});

// ── handleCaseCompleted ───────────────────────────────────────────

describe('handleCaseCompleted', () => {
  const caseCompletedState: GameState & { type: 'case_completed' } = { type: 'case_completed', caseId: 'case1' };

  it('transitions to case_select on BACK_TO_SELECT', () => {
    const result = handleCaseCompleted(caseCompletedState, save, { type: 'BACK_TO_SELECT' }, testDef);
    expect(result.nextState.type).toBe('case_select');
  });

  it('transitions to case_select on SELECT_CASE', () => {
    const result = handleCaseCompleted(caseCompletedState, save, { type: 'SELECT_CASE', caseId: 'case1' }, testDef);
    expect(result.nextState.type).toBe('case_select');
  });

  it('no transition for other events', () => {
    const result = handleCaseCompleted(caseCompletedState, save, { type: 'ASSETS_LOADED' }, testDef);
    expect(result.nextState).toBe(caseCompletedState);
  });
});

// ── handleGameCompleted ───────────────────────────────────────────

describe('handleGameCompleted', () => {
  const gameCompletedState: GameState & { type: 'game_completed' } = { type: 'game_completed' };

  it('transitions to case_select on BACK_TO_SELECT', () => {
    const result = handleGameCompleted(gameCompletedState, save, { type: 'BACK_TO_SELECT' }, testDef);
    expect(result.nextState.type).toBe('case_select');
  });

  it('no transition for unrecognised events', () => {
    const result = handleGameCompleted(gameCompletedState, save, { type: 'ASSETS_LOADED' }, testDef);
    expect(result.nextState).toBe(gameCompletedState);
  });
});
