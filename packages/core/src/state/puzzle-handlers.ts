import type {
  GameState,
  GameEvent,
  SaveState,
  GameDefinition,
  StateTransitionResult,
  SideEffect,
  CaseState,
} from '../models/types.js';
import { findCase, findScene, findPuzzle, getAllCases } from '../models/types.js';
import { validatePuzzle, validateSubPuzzle } from '../validator/validator.js';
import { noTransition } from './hotspot-action-handlers.js';

/**
 * thinking 상태(퍼즐 풀기 화면)에서 발생하는 이벤트를 처리하는 핸들러.
 */
export function handleThinking(
  state: GameState & { type: 'thinking' },
  save: SaveState,
  event: GameEvent,
  def: GameDefinition
): StateTransitionResult {
  const caseData = findCase(def, state.caseId);
  if (!caseData) return noTransition(state);
  const caseState = save.caseStates[state.caseId];
  if (!caseState) return noTransition(state);
  const puzzleState = caseState.puzzleStates[state.puzzleId];
  if (!puzzleState) return noTransition(state);

  // 이미 풀린 퍼즐은 변경 불가
  if (puzzleState.solved && event.type !== 'CLOSE_PUZZLE' && event.type !== 'BACK_TO_SELECT') {
    return noTransition(state);
  }

  switch (event.type) {
    case 'ASSIGN_WORD': {
      const newAssignments = {
        ...puzzleState.slotAssignments,
        [event.slotId]: event.wordId,
      };

      // 이 단어가 다른 슬롯에 있으면 제거
      for (const [slotId, wordId] of Object.entries(newAssignments)) {
        if (slotId !== event.slotId && wordId === event.wordId) {
          newAssignments[slotId] = null;
        }
      }

      const updatedPuzzleState = { ...puzzleState, slotAssignments: newAssignments };
      const updatedCaseState: CaseState = {
        ...caseState,
        puzzleStates: {
          ...caseState.puzzleStates,
          [state.puzzleId]: updatedPuzzleState,
        },
      };

      return {
        nextState: { ...state, sub: { type: 'editing' } },
        saveState: {
          caseStates: { ...save.caseStates, [state.caseId]: updatedCaseState },
        },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'UNASSIGN_WORD': {
      const newAssignments = {
        ...puzzleState.slotAssignments,
        [event.slotId]: null,
      };

      const updatedPuzzleState = { ...puzzleState, slotAssignments: newAssignments };
      const updatedCaseState: CaseState = {
        ...caseState,
        puzzleStates: {
          ...caseState.puzzleStates,
          [state.puzzleId]: updatedPuzzleState,
        },
      };

      return {
        nextState: { ...state, sub: { type: 'editing' } },
        saveState: {
          caseStates: { ...save.caseStates, [state.caseId]: updatedCaseState },
        },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'CLEAR_ALL_WORDS': {
      const clearedAssignments: Record<string, string | null> = {};
      for (const slotId of Object.keys(puzzleState.slotAssignments)) {
        clearedAssignments[slotId] = null;
      }

      const clearedPuzzleState = {
        ...puzzleState,
        slotAssignments: clearedAssignments,
        lastValidation: undefined,
      };
      const clearedCaseState: CaseState = {
        ...caseState,
        puzzleStates: {
          ...caseState.puzzleStates,
          [state.puzzleId]: clearedPuzzleState,
        },
      };

      return {
        nextState: { ...state, sub: { type: 'editing' } },
        saveState: {
          caseStates: { ...save.caseStates, [state.caseId]: clearedCaseState },
        },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'VALIDATE_PUZZLE': {
      const puzzle = findPuzzle(caseData.puzzles, state.puzzleId);
      if (!puzzle) return noTransition(state);

      let result;
      if ('answers' in puzzle) {
        result = validatePuzzle(puzzle as any, puzzleState.slotAssignments);
      } else {
        result = validateSubPuzzle(puzzle as any, puzzleState.slotAssignments);
      }

      const effects: SideEffect[] = [];

      const updatedPuzzleState = {
        ...puzzleState,
        lastValidation: result.slotResults,
        attemptCount: puzzleState.attemptCount + 1,
        solved: result.allCorrect,
      };

      const updatedCaseState: CaseState = {
        ...caseState,
        puzzleStates: {
          ...caseState.puzzleStates,
          [state.puzzleId]: updatedPuzzleState,
        },
      };

      const saveUpdate: Partial<SaveState> = {
        caseStates: { ...save.caseStates, [state.caseId]: updatedCaseState },
      };

      // 메인 퍼즐 완료 → 사건 완료 + 다음 사건 해금
      if (result.allCorrect && state.puzzleId === caseData.puzzles.main.id) {
        updatedCaseState.status = 'completed';

        // 다음 사건 해금
        if (def.settings.unlockMode === 'sequential') {
          const allCases = getAllCases(def);
          const currentIdx = allCases.findIndex(c => c.id === state.caseId);
          if (currentIdx >= 0 && currentIdx < allCases.length - 1) {
            const nextCase = allCases[currentIdx + 1];
            const nextCaseState = saveUpdate.caseStates![nextCase.id];
            if (nextCaseState && nextCaseState.status === 'locked') {
              saveUpdate.caseStates![nextCase.id] = {
                ...nextCaseState,
                status: 'unlocked',
              };
              effects.push({ type: 'unlock_case', caseId: nextCase.id });
            }
          }
        }
      }

      effects.push({ type: 'save_game' });

      return {
        nextState: {
          ...state,
          sub: result.allCorrect
            ? { type: 'solved' }
            : { type: 'showing_result', results: result },
        },
        saveState: saveUpdate,
        effects,
      };
    }

    case 'CLOSE_PUZZLE': {
      const scene = findScene(caseData, save.currentPosition?.sceneId ?? caseData.scenes[0].id);
      const sceneId = scene?.id ?? caseData.scenes[0].id;

      // 퍼즐이 방금 풀렸고 메인 퍼즐이라면 → case_completed
      if (puzzleState.solved && state.puzzleId === caseData.puzzles.main.id) {
        // 전체 게임 완료 체크
        const allCases = getAllCases(def);
        const allCompleted = allCases.every(c => {
          const cs = save.caseStates[c.id];
          return cs && cs.status === 'completed';
        });

        if (allCompleted) {
          return {
            nextState: { type: 'game_completed' },
            effects: [],
          };
        }

        return {
          nextState: { type: 'case_completed', caseId: state.caseId },
          effects: [],
        };
      }

      return {
        nextState: {
          type: 'exploring',
          caseId: state.caseId,
          sceneId,
          sub: { type: 'idle' },
        },
        effects: [],
      };
    }

    case 'BACK_TO_SELECT': {
      return {
        nextState: { type: 'case_select' },
        saveState: { currentPosition: null },
        effects: [{ type: 'save_game' }],
      };
    }

    default:
      return noTransition(state);
  }
}
