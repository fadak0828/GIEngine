import type { GameDefinition, SaveState, CaseState, PuzzleState } from '../models/types.js';
import { getAllCases } from '../models/types.js';

/**
 * 새 게임 시작 시 초기 SaveState를 생성한다.
 * 첫 번째 사건만 unlocked, 나머지는 locked (또는 all_unlocked 모드).
 */
export function createInitialSaveState(def: GameDefinition): SaveState {
  const cases = getAllCases(def);
  const caseStates: Record<string, CaseState> = {};

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const isFirst = i === 0;
    const status =
      def.settings.unlockMode === 'all_unlocked'
        ? 'unlocked'
        : isFirst
          ? 'unlocked'
          : 'locked';

    const puzzleStates: Record<string, PuzzleState> = {};

    // 메인 퍼즐
    puzzleStates[c.puzzles.main.id] = createInitialPuzzleState(c.puzzles.main);

    // 서브 퍼즐
    for (const sub of c.puzzles.sub) {
      puzzleStates[sub.id] = createInitialPuzzleState(sub);
    }

    caseStates[c.id] = {
      status,
      collectedWordIds: [],
      puzzleStates,
      visitedSceneIds: [],
      visitedHotspotIds: [],
      layerVisibility: {},
    };
  }

  return {
    gameId: def.id,
    gameVersion: def.version,
    savedAt: new Date().toISOString(),
    currentLocale: def.supportedLocales[0] ?? 'ko',
    caseStates,
    currentPosition: null,
    flags: {},
  };
}

function createInitialPuzzleState(_puzzle: { id: string }): PuzzleState {
  return {
    solved: false,
    slotAssignments: {},
    attemptCount: 0,
  };
}
