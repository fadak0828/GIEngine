/**
 * Unit tests for SaveManager.migrate()
 * Verifies backward-compatible migration of old save data schemas.
 */
import { describe, it, expect } from 'vitest';
import { SaveManager } from '../src/save/save-manager.js';

function makeMgr() {
  return new SaveManager('test-game');
}

describe('SaveManager.migrate()', () => {
  it('returns null for null input', () => {
    expect(makeMgr().migrate(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(makeMgr().migrate('string')).toBeNull();
    expect(makeMgr().migrate(42)).toBeNull();
  });

  it('returns null when gameId is missing', () => {
    expect(makeMgr().migrate({ caseStates: {} })).toBeNull();
  });

  it('returns null when caseStates is missing', () => {
    expect(makeMgr().migrate({ gameId: 'test-game' })).toBeNull();
  });

  it('fills in missing top-level fields', () => {
    const result = makeMgr().migrate({
      gameId: 'test-game',
      caseStates: {},
    });
    expect(result).not.toBeNull();
    expect(result!.currentLocale).toBe('ko');
    expect(result!.gameVersion).toBe('0.0.0');
    expect(typeof result!.savedAt).toBe('string');
    expect(result!.currentPosition).toBeNull();
    expect(result!.flags).toEqual({});
  });

  it('fills visitedHotspotIds when missing from a case state', () => {
    const result = makeMgr().migrate({
      gameId: 'test-game',
      caseStates: {
        'case-1': {
          status: 'unlocked',
          collectedWordIds: [],
          puzzleStates: {},
          visitedSceneIds: [],
          // visitedHotspotIds intentionally absent
          layerVisibility: {},
        },
      },
    });
    expect(result).not.toBeNull();
    expect(result!.caseStates['case-1'].visitedHotspotIds).toEqual([]);
  });

  it('preserves existing visitedHotspotIds', () => {
    const result = makeMgr().migrate({
      gameId: 'test-game',
      caseStates: {
        'case-1': {
          status: 'unlocked',
          collectedWordIds: [],
          puzzleStates: {},
          visitedSceneIds: [],
          visitedHotspotIds: ['hs-1', 'hs-2'],
          layerVisibility: {},
        },
      },
    });
    expect(result!.caseStates['case-1'].visitedHotspotIds).toEqual(['hs-1', 'hs-2']);
  });

  it('fills multiple missing array fields across multiple cases', () => {
    const result = makeMgr().migrate({
      gameId: 'test-game',
      caseStates: {
        'case-1': { status: 'unlocked', puzzleStates: {} },
        'case-2': { status: 'locked', puzzleStates: {} },
      },
    });
    expect(result!.caseStates['case-1'].visitedHotspotIds).toEqual([]);
    expect(result!.caseStates['case-1'].visitedSceneIds).toEqual([]);
    expect(result!.caseStates['case-1'].collectedWordIds).toEqual([]);
    expect(result!.caseStates['case-1'].layerVisibility).toEqual({});
    expect(result!.caseStates['case-2'].visitedHotspotIds).toEqual([]);
  });
});
