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
import {
  noTransition,
  handleHotspotAction,
  hotspotActionToEffects,
  closePuzzleOverlayResult,
} from './hotspot-action-handlers.js';

/**
 * exploring 상태에서 발생하는 이벤트를 처리하는 핸들러.
 */
export function handleExploring(
  state: GameState & { type: 'exploring' },
  save: SaveState,
  event: GameEvent,
  def: GameDefinition
): StateTransitionResult {
  const caseData = findCase(def, state.caseId);
  if (!caseData) return noTransition(state);
  const caseState = save.caseStates[state.caseId];
  if (!caseState) return noTransition(state);

  switch (event.type) {
    case 'NAVIGATE_SCENE': {
      const targetScene = findScene(caseData, event.sceneId);
      if (!targetScene) return noTransition(state);

      const navEffects: SideEffect[] = [];

      // BGM 처리
      if (targetScene.bgmStop) {
        navEffects.push({ type: 'stop_bgm' });
      } else if (targetScene.bgm) {
        navEffects.push({ type: 'play_bgm', assetRef: targetScene.bgm, loop: true });
      }

      // onEnter 액션 처리
      if (targetScene.onEnter) {
        for (const action of targetScene.onEnter) {
          const onEnterEffects = hotspotActionToEffects(action);
          navEffects.push(...onEnterEffects);
        }
      }

      navEffects.push({ type: 'save_game' });

      return {
        nextState: {
          type: 'exploring',
          caseId: state.caseId,
          sceneId: event.sceneId,
          sub: { type: 'idle' },
        },
        saveState: {
          currentPosition: { caseId: state.caseId, sceneId: event.sceneId },
          caseStates: {
            ...save.caseStates,
            [state.caseId]: {
              ...caseState,
              visitedSceneIds: caseState.visitedSceneIds.includes(event.sceneId)
                ? caseState.visitedSceneIds
                : [...caseState.visitedSceneIds, event.sceneId],
            },
          },
        },
        effects: navEffects,
      };
    }

    case 'HOTSPOT_CLICK': {
      const scene = findScene(caseData, state.sceneId);
      if (!scene) return noTransition(state);
      const hotspot = scene.hotspots.find(h => h.id === event.hotspotId);
      if (!hotspot) return noTransition(state);

      const result = handleHotspotAction(state, save, def, hotspot, caseState);

      if (caseState.visitedHotspotIds.includes(event.hotspotId)) {
        return result;
      }

      const updatedCaseState: CaseState = {
        ...caseState,
        visitedHotspotIds: [...caseState.visitedHotspotIds, event.hotspotId],
      };

      return {
        ...result,
        saveState: {
          ...result.saveState,
          caseStates: {
            ...result.saveState?.caseStates,
            [state.caseId]: updatedCaseState,
          },
        },
      };
    }

    case 'COLLECT_WORD': {
      if (caseState.collectedWordIds.includes(event.wordId)) {
        return noTransition(state);
      }

      const updatedCaseState: CaseState = {
        ...caseState,
        collectedWordIds: [...caseState.collectedWordIds, event.wordId],
      };

      return {
        nextState: {
          ...state,
          sub: { type: 'word_collected', wordIds: [event.wordId] },
        },
        saveState: {
          caseStates: {
            ...save.caseStates,
            [state.caseId]: updatedCaseState,
          },
        },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'COLLECT_WORD_IN_POPUP': {
      // Only valid while in examining_text or examining_image sub-states
      if (state.sub.type !== 'examining_text' && state.sub.type !== 'examining_image') {
        return noTransition(state);
      }
      if (caseState.collectedWordIds.includes(event.wordId)) {
        // Already collected — return effect only for UI feedback, no save change
        return {
          nextState: state,
          effects: [{ type: 'word_collected_in_popup', wordId: event.wordId }],
        };
      }

      const popupUpdatedCaseState: CaseState = {
        ...caseState,
        collectedWordIds: [...caseState.collectedWordIds, event.wordId],
      };

      return {
        nextState: state,  // Sub-state does NOT change — popup stays open
        saveState: {
          caseStates: {
            ...save.caseStates,
            [state.caseId]: popupUpdatedCaseState,
          },
        },
        effects: [
          { type: 'word_collected_in_popup', wordId: event.wordId } as SideEffect,
          { type: 'save_game' },
        ],
      };
    }

    case 'TOGGLE_LAYER': {
      const layerVisible = caseState.layerVisibility[event.layerId];
      const newVisible = event.visible ?? !layerVisible;

      return {
        nextState: { ...state, sub: { type: 'idle' } },
        saveState: {
          caseStates: {
            ...save.caseStates,
            [state.caseId]: {
              ...caseState,
              layerVisibility: {
                ...caseState.layerVisibility,
                [event.layerId]: newVisible,
              },
            },
          },
        },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'OPEN_PUZZLE': {
      return {
        nextState: {
          type: 'thinking',
          caseId: state.caseId,
          puzzleId: event.puzzleId,
          sub: { type: 'editing' },
        },
        effects: [],
      };
    }

    case 'CLOSE_PUZZLE': {
      // DeductionRenderer의 돌아가기 버튼은 CLOSE_PUZZLE을 dispatch한다.
      // 퍼즐이 puzzle_overlay 서브스테이트로 열린 경우에도 이 이벤트가 올 수 있으므로
      // puzzle_overlay 상태일 때는 CLOSE_PUZZLE_OVERLAY와 동일하게 처리한다.
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      return closePuzzleOverlayResult(state, save, caseData, caseState, def);
    }

    case 'CLOSE_POPUP': {
      return {
        nextState: { ...state, sub: { type: 'idle' } },
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

    // Inner hotspot clicks within examining_image
    case 'INNER_HOTSPOT_CLICK': {
      if (state.sub.type !== 'examining_image' || !state.sub.innerHotspots) {
        return noTransition(state);
      }
      const innerHotspot = state.sub.innerHotspots.find(h => h.id === event.hotspotId);
      if (!innerHotspot) return noTransition(state);

      // word_reveal inside examining_image: collect without dismissing popup
      if (innerHotspot.action.type === 'word_reveal') {
        const newWords = innerHotspot.action.wordIds.filter(
          id => !caseState.collectedWordIds.includes(id)
        );
        if (newWords.length === 0) {
          return {
            nextState: state,
            effects: innerHotspot.action.wordIds.map(wordId => ({
              type: 'word_collected_in_popup' as const,
              wordId,
            })),
          };
        }

        const innerUpdatedCaseState: CaseState = {
          ...caseState,
          collectedWordIds: [...caseState.collectedWordIds, ...newWords],
        };

        return {
          nextState: state,  // Stay in examining_image
          saveState: {
            caseStates: {
              ...save.caseStates,
              [state.caseId]: innerUpdatedCaseState,
            },
          },
          effects: [
            ...newWords.map(wordId => ({
              type: 'word_collected_in_popup' as const,
              wordId,
            })),
            { type: 'save_game' } as SideEffect,
          ],
        };
      }

      // Non-word_reveal inner hotspots: delegate to handleHotspotAction (may change sub-state)
      return handleHotspotAction(state, save, def, innerHotspot, caseState);
    }

    // Task 5: Puzzle overlay in exploring state
    case 'OPEN_PUZZLE_OVERLAY': {
      const puzzle = findPuzzle(caseData.puzzles, event.puzzleId);
      if (!puzzle) return noTransition(state);

      return {
        nextState: {
          ...state,
          sub: { type: 'puzzle_overlay', puzzleId: event.puzzleId },
        },
        effects: [],
      };
    }

    case 'CLOSE_PUZZLE_OVERLAY': {
      return closePuzzleOverlayResult(state, save, caseData, caseState, def);
    }

    // Task 5: Puzzle word operations in puzzle_overlay sub-state
    case 'ASSIGN_WORD': {
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      const overlayPuzzleState = caseState.puzzleStates[state.sub.puzzleId];
      if (!overlayPuzzleState) return noTransition(state);

      const newAssignments = {
        ...overlayPuzzleState.slotAssignments,
        [event.slotId]: event.wordId,
      };
      // Remove word from other slots
      for (const [slotId, wordId] of Object.entries(newAssignments)) {
        if (slotId !== event.slotId && wordId === event.wordId) {
          newAssignments[slotId] = null;
        }
      }

      const updatedOverlayPuzzleState = { ...overlayPuzzleState, slotAssignments: newAssignments };
      const updatedOverlayCaseState: CaseState = {
        ...caseState,
        puzzleStates: {
          ...caseState.puzzleStates,
          [state.sub.puzzleId]: updatedOverlayPuzzleState,
        },
      };

      return {
        nextState: state,
        saveState: {
          caseStates: { ...save.caseStates, [state.caseId]: updatedOverlayCaseState },
        },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'UNASSIGN_WORD': {
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      const unassignPuzzleState = caseState.puzzleStates[state.sub.puzzleId];
      if (!unassignPuzzleState) return noTransition(state);

      const unassignAssignments = {
        ...unassignPuzzleState.slotAssignments,
        [event.slotId]: null,
      };

      const updatedUnassignPuzzleState = { ...unassignPuzzleState, slotAssignments: unassignAssignments };
      const updatedUnassignCaseState: CaseState = {
        ...caseState,
        puzzleStates: {
          ...caseState.puzzleStates,
          [state.sub.puzzleId]: updatedUnassignPuzzleState,
        },
      };

      return {
        nextState: state,
        saveState: {
          caseStates: { ...save.caseStates, [state.caseId]: updatedUnassignCaseState },
        },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'CLEAR_ALL_WORDS': {
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      const clearPuzzleState = caseState.puzzleStates[state.sub.puzzleId];
      if (!clearPuzzleState) return noTransition(state);

      const clearedSlots: Record<string, string | null> = {};
      for (const slotId of Object.keys(clearPuzzleState.slotAssignments)) {
        clearedSlots[slotId] = null;
      }

      const clearedOverlayPuzzleState = {
        ...clearPuzzleState,
        slotAssignments: clearedSlots,
        lastValidation: undefined,
      };
      const clearedOverlayCaseState: CaseState = {
        ...caseState,
        puzzleStates: {
          ...caseState.puzzleStates,
          [state.sub.puzzleId]: clearedOverlayPuzzleState,
        },
      };

      return {
        nextState: state,
        saveState: {
          caseStates: { ...save.caseStates, [state.caseId]: clearedOverlayCaseState },
        },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'VALIDATE_PUZZLE': {
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      const valPuzzle = findPuzzle(caseData.puzzles, state.sub.puzzleId);
      if (!valPuzzle) return noTransition(state);
      const valPuzzleState = caseState.puzzleStates[state.sub.puzzleId];
      if (!valPuzzleState) return noTransition(state);

      let valResult;
      if ('answers' in valPuzzle) {
        valResult = validatePuzzle(valPuzzle as any, valPuzzleState.slotAssignments);
      } else {
        valResult = validateSubPuzzle(valPuzzle as any, valPuzzleState.slotAssignments);
      }

      const updatedValPuzzleState = {
        ...valPuzzleState,
        lastValidation: valResult.slotResults,
        attemptCount: valPuzzleState.attemptCount + 1,
        solved: valResult.allCorrect,
      };

      const updatedValCaseState: CaseState = {
        ...caseState,
        puzzleStates: {
          ...caseState.puzzleStates,
          [state.sub.puzzleId]: updatedValPuzzleState,
        },
      };

      const valEffects: SideEffect[] = [];

      // 메인 퍼즐 완료 → 사건 완료 + 다음 사건 해금
      if (valResult.allCorrect && state.sub.puzzleId === caseData.puzzles.main.id) {
        updatedValCaseState.status = 'completed';

        if (def.settings.unlockMode === 'sequential') {
          const allCases = getAllCases(def);
          const currentIdx = allCases.findIndex(c => c.id === state.caseId);
          if (currentIdx >= 0 && currentIdx < allCases.length - 1) {
            const nextCase = allCases[currentIdx + 1];
            const nextCaseState = save.caseStates[nextCase.id];
            if (nextCaseState && nextCaseState.status === 'locked') {
              updatedValCaseState;
              const updatedSaveCases = {
                ...save.caseStates,
                [state.caseId]: updatedValCaseState,
                [nextCase.id]: { ...nextCaseState, status: 'unlocked' as const },
              };
              valEffects.push({ type: 'unlock_case', caseId: nextCase.id });
              valEffects.push({ type: 'save_game' });
              return {
                nextState: {
                  ...state,
                  sub: valResult.allCorrect
                    ? { type: 'puzzle_overlay' as const, puzzleId: state.sub.puzzleId, solved: true }
                    : state.sub,
                },
                saveState: { caseStates: updatedSaveCases },
                effects: valEffects,
              };
            }
          }
        }
      }

      valEffects.push({ type: 'save_game' });

      return {
        nextState: {
          ...state,
          sub: valResult.allCorrect
            ? { type: 'puzzle_overlay' as const, puzzleId: state.sub.puzzleId, solved: true }
            : state.sub,
        },
        saveState: {
          caseStates: { ...save.caseStates, [state.caseId]: updatedValCaseState },
        },
        effects: valEffects,
      };
    }

    default:
      return noTransition(state);
  }
}
