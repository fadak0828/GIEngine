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
        effects: [{ type: 'save_game' }],
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
          sub: { type: 'word_collected', wordId: event.wordId },
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
    case 'examine':
      return {
        nextState: {
          ...state,
          sub: {
            type: 'examining_text',
            content: action.content,
            title: action.title,
            highlightedWords: action.highlightedWords,
          },
        },
        effects: [],
      };

    case 'examine_image':
      return {
        nextState: {
          ...state,
          sub: {
            type: 'examining_image',
            image: action.image,
            caption: action.caption,
          },
        },
        effects: [],
      };

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
          sub: { type: 'word_collected', wordId: newWords[0] },
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

    case 'composite':
      // 복합 동작: 첫 번째 동작만 즉시 실행 (나머지는 런타임에서 순차 처리)
      if (action.actions.length > 0) {
        const first = action.actions[0];
        const virtualHotspot: Hotspot = { ...hotspot, action: first };
        return handleHotspotAction(state, save, def, virtualHotspot, caseState);
      }
      return noTransition(state);

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
