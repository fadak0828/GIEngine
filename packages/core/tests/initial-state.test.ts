import { describe, it, expect } from 'vitest';
import { createInitialSaveState } from '../src/save/initial-state.js';
import type { GameDefinition } from '../src/models/types.js';

const minDef: GameDefinition = {
  id: 'test',
  version: '1.0',
  title: { ko: 'T', en: 'T' },
  description: { ko: '', en: '' },
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
      title: { ko: '1', en: '1' },
      cases: [
        {
          id: 'c1', title: { ko: '', en: '' }, description: { ko: '', en: '' },
          scenes: [{ id: 's1', name: { ko: '', en: '' }, background: '', dimensions: { width: 100, height: 100 }, hotspots: [], layers: [] }],
          puzzles: { main: { id: 'p1', title: { ko: '', en: '' }, type: 'fill_in_blank', template: { segments: [] }, answers: {} }, sub: [] },
          prerequisites: [], thumbnail: '',
        },
        {
          id: 'c2', title: { ko: '', en: '' }, description: { ko: '', en: '' },
          scenes: [{ id: 's2', name: { ko: '', en: '' }, background: '', dimensions: { width: 100, height: 100 }, hotspots: [], layers: [] }],
          puzzles: { main: { id: 'p2', title: { ko: '', en: '' }, type: 'fill_in_blank', template: { segments: [] }, answers: {} }, sub: [] },
          prerequisites: ['c1'], thumbnail: '',
        },
      ],
    },
  ],
  assets: { items: {} },
};

describe('createInitialSaveState', () => {
  it('첫 번째 사건만 unlocked', () => {
    const save = createInitialSaveState(minDef);
    expect(save.caseStates['c1'].status).toBe('unlocked');
    expect(save.caseStates['c2'].status).toBe('locked');
  });

  it('all_unlocked 모드에서 모든 사건 unlocked', () => {
    const unlockAllDef = { ...minDef, settings: { ...minDef.settings, unlockMode: 'all_unlocked' as const } };
    const save = createInitialSaveState(unlockAllDef);
    expect(save.caseStates['c1'].status).toBe('unlocked');
    expect(save.caseStates['c2'].status).toBe('unlocked');
  });

  it('퍼즐 초기 상태 확인', () => {
    const save = createInitialSaveState(minDef);
    expect(save.caseStates['c1'].puzzleStates['p1'].solved).toBe(false);
    expect(save.caseStates['c1'].puzzleStates['p1'].attemptCount).toBe(0);
  });

  it('기본 로케일은 supportedLocales[0]', () => {
    const save = createInitialSaveState(minDef);
    expect(save.currentLocale).toBe('ko');
  });

  it('gameId와 version이 올바르게 설정', () => {
    const save = createInitialSaveState(minDef);
    expect(save.gameId).toBe('test');
    expect(save.gameVersion).toBe('1.0');
  });
});
