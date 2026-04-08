/**
 * Unit tests for exploration-handlers.ts
 * Tests handleExploring directly (not via transition).
 */
import { describe, it, expect } from 'vitest';
import { handleExploring } from '../src/state/exploration-handlers.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition, GameState, SaveState } from '../src/models/types.js';

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
            {
              id: 'scene1',
              name: { ko: 'S1', en: 'S1' },
              background: 'bg1',
              dimensions: { width: 1280, height: 720 },
              hotspots: [
                {
                  id: 'hs-word',
                  area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
                  action: { type: 'word_reveal', wordIds: ['word-a'] },
                  cursor: 'pointer',
                  ariaLabel: { ko: '단어', en: 'Word' },
                },
                {
                  id: 'hs-nav',
                  area: { type: 'rect', x: 10, y: 0, width: 10, height: 10 },
                  action: { type: 'navigate', targetSceneId: 'scene2' },
                  cursor: 'pointer',
                  ariaLabel: { ko: '이동', en: 'Navigate' },
                },
              ],
              layers: [{ id: 'layer1', name: { ko: '레이어1', en: 'Layer1' }, src: 'l1.png', visible: true }],
            },
            {
              id: 'scene2',
              name: { ko: 'S2', en: 'S2' },
              background: 'bg2',
              bgm: 'bgm-track',
              dimensions: { width: 1280, height: 720 },
              hotspots: [],
              layers: [],
            },
            {
              id: 'scene3',
              name: { ko: 'S3', en: 'S3' },
              background: 'bg3',
              bgmStop: true,
              dimensions: { width: 1280, height: 720 },
              hotspots: [],
              layers: [],
            },
          ],
          puzzles: {
            main: {
              id: 'pz1',
              title: { ko: '퍼즐', en: 'Puzzle' },
              type: 'fill_in_blank',
              template: { segments: [] },
              answers: {},
            },
            sub: [
              {
                id: 'sub-pz1',
                title: { ko: '서브퍼즐', en: 'Sub Puzzle' },
                type: 'fill_in_blank',
                template: { segments: [] },
                parentId: 'pz1',
                answers: {},
              },
            ],
          },
          prerequisites: [],
          thumbnail: '',
        },
      ],
    },
  ],
  assets: { items: {} },
};

function makeExploringState(sceneId = 'scene1'): GameState & { type: 'exploring' } {
  return { type: 'exploring', caseId: 'case1', sceneId, sub: { type: 'idle' } };
}

function makeSave(): SaveState {
  return createInitialSaveState(testDef);
}

// ── NAVIGATE_SCENE ────────────────────────────────────────────────

describe('handleExploring — NAVIGATE_SCENE', () => {
  it('씬 전환 후 nextState 업데이트', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'NAVIGATE_SCENE', sceneId: 'scene2' }, testDef);
    expect(result.nextState).toMatchObject({ type: 'exploring', sceneId: 'scene2', sub: { type: 'idle' } });
  });

  it('방문한 씬 ID가 visitedSceneIds에 추가됨', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'NAVIGATE_SCENE', sceneId: 'scene2' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.visitedSceneIds).toContain('scene2');
  });

  it('이미 방문한 씬은 중복 추가 안 됨', () => {
    const save = makeSave();
    save.caseStates['case1']!.visitedSceneIds = ['scene2'];
    const result = handleExploring(makeExploringState(), save, { type: 'NAVIGATE_SCENE', sceneId: 'scene2' }, testDef);
    const visited = result.saveState?.caseStates?.['case1']?.visitedSceneIds ?? [];
    expect(visited.filter(id => id === 'scene2').length).toBe(1);
  });

  it('bgm이 있는 씬 → play_bgm 이펙트', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'NAVIGATE_SCENE', sceneId: 'scene2' }, testDef);
    expect(result.effects).toContainEqual({ type: 'play_bgm', assetRef: 'bgm-track', loop: true });
  });

  it('bgmStop이 있는 씬 → stop_bgm 이펙트', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'NAVIGATE_SCENE', sceneId: 'scene3' }, testDef);
    expect(result.effects).toContainEqual({ type: 'stop_bgm' });
  });

  it('존재하지 않는 씬 → noTransition', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'NAVIGATE_SCENE', sceneId: 'no-such-scene' }, testDef);
    expect(result.nextState).toEqual(makeExploringState());
    expect(result.effects).toEqual([]);
  });
});

// ── COLLECT_WORD ──────────────────────────────────────────────────

describe('handleExploring — COLLECT_WORD', () => {
  it('새 단어 수집 → collectedWordIds에 추가', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'COLLECT_WORD', wordId: 'word-a' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.collectedWordIds).toContain('word-a');
  });

  it('이미 수집된 단어 → noTransition', () => {
    const save = makeSave();
    save.caseStates['case1']!.collectedWordIds = ['word-a'];
    const result = handleExploring(makeExploringState(), save, { type: 'COLLECT_WORD', wordId: 'word-a' }, testDef);
    expect(result.nextState).toMatchObject({ sub: { type: 'idle' } });
    expect(result.saveState).toBeUndefined();
  });

  it('수집 후 sub 상태가 word_collected로 변경', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'COLLECT_WORD', wordId: 'word-new' }, testDef);
    expect(result.nextState).toMatchObject({ sub: { type: 'word_collected', wordIds: ['word-new'] } });
  });
});

// ── COLLECT_WORD_IN_POPUP ─────────────────────────────────────────

describe('handleExploring — COLLECT_WORD_IN_POPUP', () => {
  it('examining_text 상태에서 새 단어 수집', () => {
    const state = { ...makeExploringState(), sub: { type: 'examining_text' as const, content: { ko: '내용', en: 'Content' } } };
    const result = handleExploring(state, makeSave(), { type: 'COLLECT_WORD_IN_POPUP', wordId: 'word-a' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.collectedWordIds).toContain('word-a');
    expect(result.effects).toContainEqual({ type: 'word_collected_in_popup', wordId: 'word-a' });
  });

  it('이미 수집된 단어 → 팝업 피드백만 (saveState 없음)', () => {
    const state = { ...makeExploringState(), sub: { type: 'examining_text' as const, content: { ko: '내용', en: 'Content' } } };
    const save = makeSave();
    save.caseStates['case1']!.collectedWordIds = ['word-a'];
    const result = handleExploring(state, save, { type: 'COLLECT_WORD_IN_POPUP', wordId: 'word-a' }, testDef);
    expect(result.saveState).toBeUndefined();
    expect(result.effects).toContainEqual({ type: 'word_collected_in_popup', wordId: 'word-a' });
  });

  it('idle 상태에서 COLLECT_WORD_IN_POPUP → noTransition', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'COLLECT_WORD_IN_POPUP', wordId: 'word-a' }, testDef);
    expect(result.nextState).toEqual(makeExploringState());
    expect(result.effects).toEqual([]);
  });
});

// ── TOGGLE_LAYER ──────────────────────────────────────────────────

describe('handleExploring — TOGGLE_LAYER', () => {
  it('초기 미설정 레이어 토글 → true (undefined → !undefined)', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'TOGGLE_LAYER', layerId: 'layer1' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.layerVisibility?.['layer1']).toBe(true);
  });

  it('visible=true 레이어 토글 → false', () => {
    const save = makeSave();
    save.caseStates['case1']!.layerVisibility['layer1'] = true;
    const result = handleExploring(makeExploringState(), save, { type: 'TOGGLE_LAYER', layerId: 'layer1' }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.layerVisibility?.['layer1']).toBe(false);
  });

  it('visible 명시적 설정', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'TOGGLE_LAYER', layerId: 'layer1', visible: true }, testDef);
    expect(result.saveState?.caseStates?.['case1']?.layerVisibility?.['layer1']).toBe(true);
  });
});

// ── CLOSE_POPUP ───────────────────────────────────────────────────

describe('handleExploring — CLOSE_POPUP', () => {
  it('sub 상태를 idle로 리셋', () => {
    const state = { ...makeExploringState(), sub: { type: 'examining_text' as const, content: { ko: '내용', en: 'Content' } } };
    const result = handleExploring(state, makeSave(), { type: 'CLOSE_POPUP' }, testDef);
    expect(result.nextState).toMatchObject({ sub: { type: 'idle' } });
    expect(result.effects).toEqual([]);
  });
});

// ── OPEN_PUZZLE / BACK_TO_SELECT ──────────────────────────────────

describe('handleExploring — OPEN_PUZZLE', () => {
  it('thinking 상태로 전이', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'OPEN_PUZZLE', puzzleId: 'pz1' }, testDef);
    expect(result.nextState).toMatchObject({ type: 'thinking', puzzleId: 'pz1' });
  });
});

describe('handleExploring — BACK_TO_SELECT', () => {
  it('case_select 상태로 전이', () => {
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'BACK_TO_SELECT' }, testDef);
    expect(result.nextState).toMatchObject({ type: 'case_select' });
    expect(result.saveState?.currentPosition).toBeNull();
  });
});

// ── 알 수 없는 이벤트 ─────────────────────────────────────────────

describe('handleExploring — unknown event', () => {
  it('알 수 없는 이벤트 → noTransition', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = handleExploring(makeExploringState(), makeSave(), { type: 'ASSETS_LOADED' } as any, testDef);
    expect(result.nextState).toEqual(makeExploringState());
    expect(result.effects).toEqual([]);
  });
});

// ── 잘못된 caseId ─────────────────────────────────────────────────

describe('handleExploring — invalid caseId', () => {
  it('케이스가 없으면 noTransition', () => {
    const state: GameState & { type: 'exploring' } = { type: 'exploring', caseId: 'no-case', sceneId: 'scene1', sub: { type: 'idle' } };
    const result = handleExploring(state, makeSave(), { type: 'NAVIGATE_SCENE', sceneId: 'scene2' }, testDef);
    expect(result.nextState).toEqual(state);
    expect(result.effects).toEqual([]);
  });
});
