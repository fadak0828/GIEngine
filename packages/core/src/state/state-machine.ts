import type {
  GameState,
  GameEvent,
  SaveState,
  GameDefinition,
  StateTransitionResult,
  SideEffect,
  CaseState,
  Hotspot,
  HotspotAction,
} from '../models/types.js';
import { getAllCases, findCase, findScene, findPuzzle } from '../models/types.js';
import { validatePuzzle, validateSubPuzzle } from '../validator/validator.js';
import { createInitialSaveState } from '../save/initial-state.js';

/**
 * 상태 전이 함수.
 * 순수 함수: (현재상태, 세이브, 이벤트, 게임정의) → (다음상태, 세이브변경, 부수효과)
 */
export function transition(
  state: GameState,
  save: SaveState,
  event: GameEvent,
  def: GameDefinition
): StateTransitionResult {
  // 글로벌 이벤트 (어떤 상태에서든 처리)
  if (event.type === 'CHANGE_LOCALE') {
    return {
      nextState: state,
      saveState: { currentLocale: event.locale },
      effects: [{ type: 'save_game' }],
    };
  }

  if (event.type === 'RESET_GAME') {
    return {
      nextState: { type: 'case_select' },
      saveState: createInitialSaveState(def),
      effects: [{ type: 'save_game' }],
    };
  }

  switch (state.type) {
    case 'loading':
      return handleLoading(state, save, event, def);
    case 'case_select':
      return handleCaseSelect(state, save, event, def);
    case 'exploring':
      return handleExploring(state, save, event, def);
    case 'thinking':
      return handleThinking(state, save, event, def);
    case 'case_completed':
      return handleCaseCompleted(state, save, event, def);
    case 'game_completed':
      return handleGameCompleted(state, save, event, def);
    default:
      return noTransition(state);
  }
}

function noTransition(state: GameState): StateTransitionResult {
  return { nextState: state, effects: [] };
}

// --- Loading ---

function handleLoading(
  state: GameState & { type: 'loading' },
  _save: SaveState,
  event: GameEvent,
  _def: GameDefinition
): StateTransitionResult {
  if (event.type === 'ASSETS_LOADED') {
    return {
      nextState: { type: 'case_select' },
      effects: [],
    };
  }
  return noTransition(state);
}

// --- Case Select ---

function handleCaseSelect(
  state: GameState & { type: 'case_select' },
  save: SaveState,
  event: GameEvent,
  def: GameDefinition
): StateTransitionResult {
  if (event.type === 'SELECT_CASE') {
    const caseState = save.caseStates[event.caseId];
    if (!caseState || caseState.status === 'locked') {
      return noTransition(state);
    }

    const caseData = findCase(def, event.caseId);
    if (!caseData || caseData.scenes.length === 0) {
      return noTransition(state);
    }

    const firstSceneId = caseData.scenes[0].id;
    return {
      nextState: {
        type: 'exploring',
        caseId: event.caseId,
        sceneId: firstSceneId,
        sub: { type: 'idle' },
      },
      saveState: {
        currentPosition: { caseId: event.caseId, sceneId: firstSceneId },
      },
      effects: [{ type: 'save_game' }],
    };
  }
  return noTransition(state);
}

// --- Exploring helpers ---

/**
 * puzzle_overlay 닫기 공통 로직.
 * CLOSE_PUZZLE_OVERLAY와 CLOSE_PUZZLE(puzzle_overlay 컨텍스트) 양쪽에서 사용.
 */
function closePuzzleOverlayResult(
  state: GameState & { type: 'exploring' },
  save: SaveState,
  caseData: ReturnType<typeof findCase>,
  caseState: CaseState,
  def: GameDefinition
): StateTransitionResult {
  if (!caseData) return { nextState: state, effects: [] };

  // 메인 퍼즐이 방금 풀렸다면 → case_completed 또는 game_completed
  if (state.sub.type === 'puzzle_overlay' && state.sub.puzzleId === caseData.puzzles.main.id) {
    const closedPuzzleState = caseState.puzzleStates[state.sub.puzzleId];
    if (closedPuzzleState?.solved) {
      const allCases = getAllCases(def);
      const allCompleted = allCases.every(c => {
        const cs = save.caseStates[c.id];
        return cs && cs.status === 'completed';
      });

      if (allCompleted) {
        return { nextState: { type: 'game_completed' }, effects: [] };
      }

      return { nextState: { type: 'case_completed', caseId: state.caseId }, effects: [] };
    }
  }

  return {
    nextState: { ...state, sub: { type: 'idle' } },
    effects: [],
  };
}

// --- Exploring ---

function handleExploring(
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

      return handleHotspotAction(state, save, def, hotspot, caseState);
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

function handleHotspotAction(
  state: GameState & { type: 'exploring' },
  save: SaveState,
  def: GameDefinition,
  hotspot: Hotspot,
  caseState: CaseState
): StateTransitionResult {
  const action = hotspot.action;

  switch (action.type) {
    case 'examine': {
      return {
        nextState: {
          ...state,
          sub: {
            type: 'examining_text',
            content: action.content,
            title: action.title,
            highlightedWords: action.highlightedWords,
            collectibleWords: action.collectibleWords,
          },
        },
        effects: [],
      };
    }

    case 'examine_image': {
      return {
        nextState: {
          ...state,
          sub: {
            type: 'examining_image',
            image: action.image,
            caption: action.caption,
            innerHotspots: action.innerHotspots,
          },
        },
        effects: [],
      };
    }

    case 'word_reveal': {
      const newWords = action.wordIds.filter(id => !caseState.collectedWordIds.includes(id));
      if (newWords.length === 0) return noTransition(state);

      const updatedCaseState: CaseState = {
        ...caseState,
        collectedWordIds: [...caseState.collectedWordIds, ...newWords],
      };

      return {
        nextState: {
          ...state,
          sub: { type: 'word_collected', wordIds: newWords },
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

    case 'navigate':
      return {
        nextState: {
          ...state,
          sceneId: action.targetSceneId,
          sub: { type: 'idle' },
        },
        saveState: {
          currentPosition: { caseId: state.caseId, sceneId: action.targetSceneId },
        },
        effects: [{ type: 'save_game' }],
      };

    case 'toggle_layer': {
      const layerVisible = caseState.layerVisibility[action.layerId];
      const newVisible = action.visible ?? !layerVisible;

      return {
        nextState: { ...state, sub: { type: 'idle' } },
        saveState: {
          caseStates: {
            ...save.caseStates,
            [state.caseId]: {
              ...caseState,
              layerVisibility: {
                ...caseState.layerVisibility,
                [action.layerId]: newVisible,
              },
            },
          },
        },
        effects: [],
      };
    }

    case 'play_sound': {
      return {
        nextState: state,
        effects: [{ type: 'play_sound', assetRef: action.assetRef }],
      };
    }

    case 'composite': {
      if (action.actions.length === 0) return noTransition(state);

      // Process all sub-actions, accumulating state changes
      let currentResult: StateTransitionResult = noTransition(state);
      let accumulatedSaveState: Partial<SaveState> = {};
      const accumulatedEffects: SideEffect[] = [];

      // Track the working case state so each sub-action sees updates from previous ones
      let workingCaseState = caseState;

      for (const subAction of action.actions) {
        const virtualHotspot: Hotspot = { ...hotspot, action: subAction };
        const workingSave: SaveState = {
          ...save,
          caseStates: {
            ...save.caseStates,
            [state.caseId]: workingCaseState,
          },
          ...accumulatedSaveState,
        };

        const workingState = currentResult.nextState as GameState & { type: 'exploring' };
        const subResult = handleHotspotAction(
          workingState,
          workingSave,
          def,
          virtualHotspot,
          workingCaseState
        );

        // Merge results — last sub-action's nextState wins for the sub field
        currentResult = subResult;
        if (subResult.saveState?.caseStates?.[state.caseId]) {
          workingCaseState = subResult.saveState.caseStates[state.caseId] as CaseState;
        }
        if (subResult.saveState) {
          accumulatedSaveState = { ...accumulatedSaveState, ...subResult.saveState };
        }
        accumulatedEffects.push(...subResult.effects);
      }

      return {
        nextState: currentResult.nextState,
        saveState: accumulatedSaveState,
        effects: accumulatedEffects,
      };
    }

    default:
      return noTransition(state);
  }
}

// --- Thinking ---

function handleThinking(
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

      let saveUpdate: Partial<SaveState> = {
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

/**
 * onEnter 액션을 SideEffect로 변환.
 * UI 인터랙션이 필요한 액션(examine, navigate 등)은 onEnter에서 무시.
 */
function hotspotActionToEffects(action: HotspotAction): SideEffect[] {
  switch (action.type) {
    case 'play_sound':
      return [{ type: 'play_sound', assetRef: action.assetRef }];
    case 'delay':
      return [{ type: 'delay', duration: action.duration }];
    case 'toggle_layer':
      return [{ type: 'toggle_layer', layerId: action.layerId, visible: action.visible }];
    case 'composite':
      return action.actions.flatMap(a => hotspotActionToEffects(a));
    default:
      return [];
  }
}

// --- Case Completed ---

function handleCaseCompleted(
  state: GameState & { type: 'case_completed' },
  _save: SaveState,
  event: GameEvent,
  _def: GameDefinition
): StateTransitionResult {
  if (event.type === 'BACK_TO_SELECT') {
    return {
      nextState: { type: 'case_select' },
      effects: [],
    };
  }
  if (event.type === 'SELECT_CASE') {
    // 다음 사건으로 직접 이동
    return {
      nextState: { type: 'case_select' },
      effects: [],
    };
  }
  return noTransition(state);
}

// --- Game Completed ---

function handleGameCompleted(
  state: GameState & { type: 'game_completed' },
  _save: SaveState,
  event: GameEvent,
  _def: GameDefinition
): StateTransitionResult {
  if (event.type === 'BACK_TO_SELECT') {
    return {
      nextState: { type: 'case_select' },
      effects: [],
    };
  }
  return noTransition(state);
}
