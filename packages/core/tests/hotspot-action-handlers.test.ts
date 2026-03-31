/**
 * Unit tests for hotspot-action-handlers.ts
 * Tests noTransition, hotspotActionToEffects, handleHotspotAction, closePuzzleOverlayResult
 */
import { describe, it, expect } from 'vitest';
import {
  noTransition,
  hotspotActionToEffects,
  handleHotspotAction,
  closePuzzleOverlayResult,
} from '../src/state/hotspot-action-handlers.js';
import type {
  GameState,
  SaveState,
  GameDefinition,
  CaseState,
  Hotspot,
} from '../src/models/types.js';

// --- minimal fixtures ---

const baseDef: GameDefinition = {
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
          scenes: [{ id: 'scene1', name: { ko: 'S1', en: 'S1' }, background: '', dimensions: { width: 1280, height: 720 }, hotspots: [], layers: [] }],
          puzzles: {
            main: {
              id: 'puzzle-main',
              title: { ko: '메인', en: 'Main' },
              type: 'fill_in_blank',
              template: { segments: [] },
              answers: {},
            },
            sub: [],
          },
          prerequisites: [],
          thumbnail: '',
        },
        // second case to prevent game_completed when case1 completes
        {
          id: 'case2',
          title: { ko: '사건2', en: 'Case2' },
          description: { ko: '', en: '' },
          scenes: [{ id: 'scene2', name: { ko: 'S2', en: 'S2' }, background: '', dimensions: { width: 1280, height: 720 }, hotspots: [], layers: [] }],
          puzzles: {
            main: { id: 'puzzle-main2', title: { ko: '메인2', en: 'Main2' }, type: 'fill_in_blank', template: { segments: [] }, answers: {} },
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

const exploringState: GameState & { type: 'exploring' } = {
  type: 'exploring',
  caseId: 'case1',
  sceneId: 'scene1',
  sub: { type: 'idle' },
};

const baseCaseState: CaseState = {
  status: 'unlocked',
  visitedSceneIds: ['scene1'],
  collectedWordIds: [],
  layerVisibility: {},
  puzzleStates: {
    'puzzle-main': {
      slotAssignments: {},
      attemptCount: 0,
      solved: false,
    },
  },
};

const baseSave: SaveState = {
  gameId: 'g',
  version: '1.0.0',
  currentLocale: 'ko',
  currentPosition: { caseId: 'case1', sceneId: 'scene1' },
  caseStates: { case1: baseCaseState },
};

// ── noTransition ──────────────────────────────────────────────────

describe('noTransition', () => {
  it('returns the same state with empty effects', () => {
    const result = noTransition(exploringState);
    expect(result.nextState).toBe(exploringState);
    expect(result.effects).toEqual([]);
    expect(result.saveState).toBeUndefined();
  });
});

// ── hotspotActionToEffects ────────────────────────────────────────

describe('hotspotActionToEffects', () => {
  it('converts play_sound to a play_sound SideEffect', () => {
    const effects = hotspotActionToEffects({ type: 'play_sound', assetRef: 'snd/bell.mp3' });
    expect(effects).toEqual([{ type: 'play_sound', assetRef: 'snd/bell.mp3' }]);
  });

  it('converts delay to a delay SideEffect', () => {
    const effects = hotspotActionToEffects({ type: 'delay', duration: 500 });
    expect(effects).toEqual([{ type: 'delay', duration: 500 }]);
  });

  it('converts toggle_layer to a toggle_layer SideEffect', () => {
    const effects = hotspotActionToEffects({ type: 'toggle_layer', layerId: 'layer1', visible: true });
    expect(effects).toEqual([{ type: 'toggle_layer', layerId: 'layer1', visible: true }]);
  });

  it('returns empty array for examine action (UI only)', () => {
    const effects = hotspotActionToEffects({ type: 'examine', content: { ko: '텍스트', en: 'text' } });
    expect(effects).toEqual([]);
  });

  it('returns empty array for navigate action (UI only)', () => {
    const effects = hotspotActionToEffects({ type: 'navigate', targetSceneId: 'scene2' });
    expect(effects).toEqual([]);
  });

  it('flattens composite into multiple effects', () => {
    const effects = hotspotActionToEffects({
      type: 'composite',
      actions: [
        { type: 'play_sound', assetRef: 'click.mp3' },
        { type: 'toggle_layer', layerId: 'L1', visible: false },
      ],
    });
    expect(effects).toHaveLength(2);
    expect(effects[0]).toEqual({ type: 'play_sound', assetRef: 'click.mp3' });
    expect(effects[1]).toEqual({ type: 'toggle_layer', layerId: 'L1', visible: false });
  });

  it('handles nested composite recursively', () => {
    const effects = hotspotActionToEffects({
      type: 'composite',
      actions: [
        {
          type: 'composite',
          actions: [{ type: 'play_sound', assetRef: 'a.mp3' }],
        },
        { type: 'delay', duration: 100 },
      ],
    });
    expect(effects).toHaveLength(2);
    expect(effects[0].type).toBe('play_sound');
    expect(effects[1].type).toBe('delay');
  });
});

// ── handleHotspotAction ───────────────────────────────────────────

describe('handleHotspotAction', () => {
  const makeHotspot = (action: Hotspot['action']): Hotspot => ({
    id: 'h1',
    name: 'Test Hotspot',
    area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
    action,
    cursor: 'pointer',
    ariaLabel: { ko: '핫스팟', en: 'Hotspot' },
  });

  it('examine: enters examining_text sub-state', () => {
    const hotspot = makeHotspot({ type: 'examine', content: { ko: '단서', en: 'Clue' }, title: { ko: '제목', en: 'Title' } });
    const result = handleHotspotAction(exploringState, baseSave, baseDef, hotspot, baseCaseState);
    expect(result.nextState.type).toBe('exploring');
    const state = result.nextState as GameState & { type: 'exploring' };
    expect(state.sub.type).toBe('examining_text');
    expect(result.effects).toEqual([]);
  });

  it('examine_image: enters examining_image sub-state', () => {
    const hotspot = makeHotspot({ type: 'examine_image', image: 'img/photo.png' });
    const result = handleHotspotAction(exploringState, baseSave, baseDef, hotspot, baseCaseState);
    const state = result.nextState as GameState & { type: 'exploring' };
    expect(state.sub.type).toBe('examining_image');
  });

  it('word_reveal: collects new word and enters word_collected sub-state', () => {
    const hotspot = makeHotspot({ type: 'word_reveal', wordIds: ['w1'] });
    const result = handleHotspotAction(exploringState, baseSave, baseDef, hotspot, baseCaseState);
    const state = result.nextState as GameState & { type: 'exploring' };
    expect(state.sub.type).toBe('word_collected');
    expect(result.saveState?.caseStates?.['case1']?.collectedWordIds).toContain('w1');
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });

  it('word_reveal: no transition if already collected', () => {
    const caseStateWithWord: CaseState = { ...baseCaseState, collectedWordIds: ['w1'] };
    const hotspot = makeHotspot({ type: 'word_reveal', wordIds: ['w1'] });
    const result = handleHotspotAction(exploringState, baseSave, baseDef, hotspot, caseStateWithWord);
    expect(result.nextState).toBe(exploringState);
    expect(result.effects).toEqual([]);
  });

  it('navigate: changes sceneId and saves', () => {
    const hotspot = makeHotspot({ type: 'navigate', targetSceneId: 'scene2' });
    const result = handleHotspotAction(exploringState, baseSave, baseDef, hotspot, baseCaseState);
    const state = result.nextState as GameState & { type: 'exploring' };
    expect(state.sceneId).toBe('scene2');
    expect(result.effects).toContainEqual({ type: 'save_game' });
  });

  it('toggle_layer: toggles layer visibility in save state', () => {
    const hotspot = makeHotspot({ type: 'toggle_layer', layerId: 'layer1' });
    const result = handleHotspotAction(exploringState, baseSave, baseDef, hotspot, baseCaseState);
    const newCaseState = result.saveState?.caseStates?.['case1'];
    expect(newCaseState?.layerVisibility?.['layer1']).toBe(true);
  });

  it('play_sound: emits play_sound effect without changing state', () => {
    const hotspot = makeHotspot({ type: 'play_sound', assetRef: 'sfx/ding.mp3' });
    const result = handleHotspotAction(exploringState, baseSave, baseDef, hotspot, baseCaseState);
    expect(result.nextState).toBe(exploringState);
    expect(result.effects).toContainEqual({ type: 'play_sound', assetRef: 'sfx/ding.mp3' });
  });

  it('composite: accumulates effects from sub-actions', () => {
    const hotspot = makeHotspot({
      type: 'composite',
      actions: [
        { type: 'play_sound', assetRef: 'click.mp3' },
        { type: 'word_reveal', wordIds: ['w2'] },
      ],
    });
    const result = handleHotspotAction(exploringState, baseSave, baseDef, hotspot, baseCaseState);
    expect(result.effects.some(e => e.type === 'play_sound')).toBe(true);
    expect(result.effects.some(e => e.type === 'save_game')).toBe(true);
  });
});

// ── closePuzzleOverlayResult ──────────────────────────────────────

describe('closePuzzleOverlayResult', () => {
  const overlayState: GameState & { type: 'exploring' } = {
    type: 'exploring',
    caseId: 'case1',
    sceneId: 'scene1',
    sub: { type: 'puzzle_overlay', puzzleId: 'puzzle-main' },
  };

  it('returns to idle if main puzzle not yet solved', () => {
    const result = closePuzzleOverlayResult(overlayState, baseSave, baseDef.acts[0].cases[0], baseCaseState, baseDef);
    const state = result.nextState as GameState & { type: 'exploring' };
    expect(state.sub.type).toBe('idle');
  });

  it('transitions to case_completed when main puzzle is solved (more cases remain)', () => {
    const solvedCaseState: CaseState = {
      ...baseCaseState,
      status: 'completed',
      puzzleStates: {
        'puzzle-main': { slotAssignments: {}, attemptCount: 1, solved: true },
      },
    };
    const lockedCase2State: CaseState = {
      status: 'locked',
      visitedSceneIds: [],
      collectedWordIds: [],
      layerVisibility: {},
      puzzleStates: {},
    };
    const solvedSave: SaveState = {
      ...baseSave,
      caseStates: { case1: solvedCaseState, case2: lockedCase2State },
    };
    const result = closePuzzleOverlayResult(overlayState, solvedSave, baseDef.acts[0].cases[0], solvedCaseState, baseDef);
    expect(result.nextState.type).toBe('case_completed');
  });
});
