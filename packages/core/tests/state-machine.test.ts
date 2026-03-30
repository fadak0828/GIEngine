import { describe, it, expect } from 'vitest';
import { transition } from '../src/state/state-machine.js';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition, GameState, SaveState } from '../src/models/types.js';

// --- 테스트용 미니 게임 정의 ---
const testDef: GameDefinition = {
  id: 'test-game',
  version: '1.0.0',
  title: { ko: '테스트 게임', en: 'Test Game' },
  description: { ko: '설명', en: 'Desc' },
  supportedLocales: ['ko', 'en'],
  settings: {
    validationFeedbackDuration: 2000,
    autoSaveInterval: 5000,
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
          scenes: [
            {
              id: 'scene-1a',
              name: { ko: '거실', en: 'Living Room' },
              background: 'bg-living',
              dimensions: { width: 1920, height: 1080 },
              hotspots: [
                {
                  id: 'hotspot-letter',
                  area: { type: 'rect', x: 100, y: 200, width: 50, height: 50 },
                  action: { type: 'examine', content: { ko: '편지 내용', en: 'Letter content' } },
                  cursor: 'pointer',
                  ariaLabel: { ko: '편지', en: 'Letter' },
                },
                {
                  id: 'hotspot-word',
                  area: { type: 'rect', x: 200, y: 300, width: 30, height: 30 },
                  action: { type: 'word_reveal', wordIds: ['word-knife'] },
                  cursor: 'pointer',
                  ariaLabel: { ko: '칼', en: 'Knife' },
                },
                {
                  id: 'hotspot-door',
                  area: { type: 'rect', x: 500, y: 100, width: 100, height: 200 },
                  action: { type: 'navigate', targetSceneId: 'scene-1b' },
                  cursor: 'pointer',
                  ariaLabel: { ko: '문', en: 'Door' },
                },
              ],
              layers: [],
            },
            {
              id: 'scene-1b',
              name: { ko: '서재', en: 'Study' },
              background: 'bg-study',
              dimensions: { width: 1920, height: 1080 },
              hotspots: [],
              layers: [],
            },
          ],
          puzzles: {
            main: {
              id: 'puzzle-main-1',
              title: { ko: '메인 퍼즐', en: 'Main Puzzle' },
              type: 'fill_in_blank',
              template: {
                segments: [
                  { type: 'slot', slotId: 'slot-killer' },
                  { type: 'text', content: { ko: '이(가)', en: '' } },
                  { type: 'slot', slotId: 'slot-weapon' },
                  { type: 'text', content: { ko: '으로 범행', en: '' } },
                ],
              },
              answers: {
                'slot-killer': { correctWordId: 'word-john' },
                'slot-weapon': { correctWordId: 'word-knife', partiallyCorrectWordIds: ['word-rope'] },
              },
            },
            sub: [],
          },
          prerequisites: [],
          thumbnail: 'thumb-1',
        },
        {
          id: 'case-2',
          title: { ko: '사건 2', en: 'Case 2' },
          description: { ko: '', en: '' },
          scenes: [
            {
              id: 'scene-2a',
              name: { ko: '정원', en: 'Garden' },
              background: 'bg-garden',
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
          prerequisites: ['case-1'],
          thumbnail: 'thumb-2',
        },
      ],
    },
  ],
  assets: { items: {} },
};

function makeSave(): SaveState {
  return createInitialSaveState(testDef);
}

describe('StateMachine', () => {
  describe('Loading → CaseSelect', () => {
    it('ASSETS_LOADED로 case_select 상태로 전이', () => {
      const state: GameState = { type: 'loading', progress: 100 };
      const result = transition(state, makeSave(), { type: 'ASSETS_LOADED' }, testDef);
      expect(result.nextState.type).toBe('case_select');
    });

    it('loading 상태에서 다른 이벤트는 무시', () => {
      const state: GameState = { type: 'loading', progress: 50 };
      const result = transition(state, makeSave(), { type: 'SELECT_CASE', caseId: 'case-1' }, testDef);
      expect(result.nextState.type).toBe('loading');
    });
  });

  describe('CaseSelect → Exploring', () => {
    it('해금된 사건 선택 → exploring 전이', () => {
      const state: GameState = { type: 'case_select' };
      const result = transition(state, makeSave(), { type: 'SELECT_CASE', caseId: 'case-1' }, testDef);
      expect(result.nextState.type).toBe('exploring');
      if (result.nextState.type === 'exploring') {
        expect(result.nextState.caseId).toBe('case-1');
        expect(result.nextState.sceneId).toBe('scene-1a');
      }
    });

    it('잠긴 사건 선택 → 상태 변경 없음', () => {
      const state: GameState = { type: 'case_select' };
      const result = transition(state, makeSave(), { type: 'SELECT_CASE', caseId: 'case-2' }, testDef);
      expect(result.nextState.type).toBe('case_select');
    });
  });

  describe('Exploring', () => {
    const exploringState: GameState = {
      type: 'exploring',
      caseId: 'case-1',
      sceneId: 'scene-1a',
      sub: { type: 'idle' },
    };

    it('핫스팟 클릭(examine) → examining_text 서브상태', () => {
      const result = transition(exploringState, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hotspot-letter' }, testDef);
      if (result.nextState.type === 'exploring') {
        expect(result.nextState.sub.type).toBe('examining_text');
      }
    });

    it('핫스팟 클릭(word_reveal) → 단어 수집', () => {
      const result = transition(exploringState, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hotspot-word' }, testDef);
      if (result.nextState.type === 'exploring') {
        expect(result.nextState.sub.type).toBe('word_collected');
      }
      expect(result.saveState?.caseStates?.['case-1']?.collectedWordIds).toContain('word-knife');
    });

    it('핫스팟 클릭(navigate) → 씬 전환', () => {
      const result = transition(exploringState, makeSave(), { type: 'HOTSPOT_CLICK', hotspotId: 'hotspot-door' }, testDef);
      if (result.nextState.type === 'exploring') {
        expect(result.nextState.sceneId).toBe('scene-1b');
      }
    });

    it('NAVIGATE_SCENE → 씬 전환', () => {
      const result = transition(exploringState, makeSave(), { type: 'NAVIGATE_SCENE', sceneId: 'scene-1b' }, testDef);
      if (result.nextState.type === 'exploring') {
        expect(result.nextState.sceneId).toBe('scene-1b');
      }
    });

    it('OPEN_PUZZLE → thinking 모드 전이', () => {
      const result = transition(exploringState, makeSave(), { type: 'OPEN_PUZZLE', puzzleId: 'puzzle-main-1' }, testDef);
      expect(result.nextState.type).toBe('thinking');
    });

    it('BACK_TO_SELECT → case_select 전이', () => {
      const result = transition(exploringState, makeSave(), { type: 'BACK_TO_SELECT' }, testDef);
      expect(result.nextState.type).toBe('case_select');
    });

    it('COLLECT_WORD → 단어 수집', () => {
      const result = transition(exploringState, makeSave(), { type: 'COLLECT_WORD', wordId: 'word-new' }, testDef);
      expect(result.saveState?.caseStates?.['case-1']?.collectedWordIds).toContain('word-new');
    });

    it('이미 수집된 단어 → 상태 변경 없음', () => {
      const save = makeSave();
      save.caseStates['case-1'].collectedWordIds = ['word-existing'];
      const result = transition(exploringState, save, { type: 'COLLECT_WORD', wordId: 'word-existing' }, testDef);
      expect(result.nextState).toEqual(exploringState);
    });
  });

  describe('Thinking (추론 모드)', () => {
    const thinkingState: GameState = {
      type: 'thinking',
      caseId: 'case-1',
      puzzleId: 'puzzle-main-1',
      sub: { type: 'editing' },
    };

    it('ASSIGN_WORD → 슬롯에 단어 배치', () => {
      const result = transition(thinkingState, makeSave(), { type: 'ASSIGN_WORD', slotId: 'slot-killer', wordId: 'word-john' }, testDef);
      const puzzleState = result.saveState?.caseStates?.['case-1']?.puzzleStates?.['puzzle-main-1'];
      expect(puzzleState?.slotAssignments['slot-killer']).toBe('word-john');
    });

    it('UNASSIGN_WORD → 슬롯에서 단어 제거', () => {
      const save = makeSave();
      save.caseStates['case-1'].puzzleStates['puzzle-main-1'].slotAssignments = { 'slot-killer': 'word-john' };
      const result = transition(thinkingState, save, { type: 'UNASSIGN_WORD', slotId: 'slot-killer' }, testDef);
      const puzzleState = result.saveState?.caseStates?.['case-1']?.puzzleStates?.['puzzle-main-1'];
      expect(puzzleState?.slotAssignments['slot-killer']).toBeNull();
    });

    it('VALIDATE_PUZZLE (전체 정답) → solved + 다음 사건 해금', () => {
      const save = makeSave();
      save.caseStates['case-1'].puzzleStates['puzzle-main-1'].slotAssignments = {
        'slot-killer': 'word-john',
        'slot-weapon': 'word-knife',
      };
      const result = transition(thinkingState, save, { type: 'VALIDATE_PUZZLE' }, testDef);
      if (result.nextState.type === 'thinking') {
        expect(result.nextState.sub.type).toBe('solved');
      }
      // 다음 사건 해금 확인
      expect(result.saveState?.caseStates?.['case-2']?.status).toBe('unlocked');
    });

    it('VALIDATE_PUZZLE (오답) → showing_result', () => {
      const save = makeSave();
      save.caseStates['case-1'].puzzleStates['puzzle-main-1'].slotAssignments = {
        'slot-killer': 'word-wrong',
        'slot-weapon': 'word-wrong2',
      };
      const result = transition(thinkingState, save, { type: 'VALIDATE_PUZZLE' }, testDef);
      if (result.nextState.type === 'thinking') {
        expect(result.nextState.sub.type).toBe('showing_result');
      }
    });

    it('VALIDATE_PUZZLE (부분 정답) → partial 결과 포함', () => {
      const save = makeSave();
      save.caseStates['case-1'].puzzleStates['puzzle-main-1'].slotAssignments = {
        'slot-killer': 'word-john',
        'slot-weapon': 'word-rope', // partiallyCorrect
      };
      const result = transition(thinkingState, save, { type: 'VALIDATE_PUZZLE' }, testDef);
      if (result.nextState.type === 'thinking' && result.nextState.sub.type === 'showing_result') {
        expect(result.nextState.sub.results.slotResults['slot-killer']).toBe('correct');
        expect(result.nextState.sub.results.slotResults['slot-weapon']).toBe('partial');
      }
    });

    it('CLOSE_PUZZLE (풀린 메인 퍼즐) → case_completed', () => {
      const save = makeSave();
      save.caseStates['case-1'].puzzleStates['puzzle-main-1'].solved = true;
      const result = transition(thinkingState, save, { type: 'CLOSE_PUZZLE' }, testDef);
      expect(result.nextState.type).toBe('case_completed');
    });

    it('CLOSE_PUZZLE (미풀 퍼즐) → exploring 복귀', () => {
      const result = transition(thinkingState, makeSave(), { type: 'CLOSE_PUZZLE' }, testDef);
      expect(result.nextState.type).toBe('exploring');
    });
  });

  describe('글로벌 이벤트', () => {
    it('CHANGE_LOCALE → 언어 변경', () => {
      const state: GameState = { type: 'case_select' };
      const result = transition(state, makeSave(), { type: 'CHANGE_LOCALE', locale: 'en' }, testDef);
      expect(result.saveState?.currentLocale).toBe('en');
    });
  });

  describe('CaseCompleted', () => {
    it('BACK_TO_SELECT → case_select', () => {
      const state: GameState = { type: 'case_completed', caseId: 'case-1' };
      const result = transition(state, makeSave(), { type: 'BACK_TO_SELECT' }, testDef);
      expect(result.nextState.type).toBe('case_select');
    });
  });
});
