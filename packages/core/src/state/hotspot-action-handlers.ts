import type {
  GameState,
  SaveState,
  GameDefinition,
  StateTransitionResult,
  SideEffect,
  CaseState,
  Hotspot,
  HotspotAction,
} from '../models/types.js';
import { getAllCases, findCase, findScene } from '../models/types.js';

/**
 * 아무 전이도 없는 경우의 기본 반환값.
 * 여러 핸들러 모듈이 공유하는 유틸리티.
 */
export function noTransition(state: GameState): StateTransitionResult {
  return { nextState: state, effects: [] };
}

/**
 * onEnter 액션을 SideEffect로 변환.
 * UI 인터랙션이 필요한 액션(examine, navigate 등)은 onEnter에서 무시.
 */
export function hotspotActionToEffects(action: HotspotAction): SideEffect[] {
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

/**
 * hotspot 액션 처리 유틸리티.
 * exploring 상태에서 hotspot 클릭 또는 inner hotspot 클릭 시 사용.
 */
export function handleHotspotAction(
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

    case 'navigate': {
      const navCaseData = findCase(def, state.caseId);
      const targetScene = navCaseData ? findScene(navCaseData, action.targetSceneId) : undefined;

      const navEffects: SideEffect[] = [];

      if (targetScene) {
        if (targetScene.bgmStop) {
          navEffects.push({ type: 'stop_bgm' });
        } else if (targetScene.bgm) {
          navEffects.push({ type: 'play_bgm', assetRef: targetScene.bgm, loop: true });
        }
        if (targetScene.onEnter) {
          for (const enterAction of targetScene.onEnter) {
            navEffects.push(...hotspotActionToEffects(enterAction));
          }
        }
      }

      navEffects.push({ type: 'save_game' });

      const navUpdatedCaseState: CaseState = {
        ...caseState,
        visitedSceneIds: caseState.visitedSceneIds.includes(action.targetSceneId)
          ? caseState.visitedSceneIds
          : [...caseState.visitedSceneIds, action.targetSceneId],
      };

      return {
        nextState: {
          ...state,
          sceneId: action.targetSceneId,
          sub: { type: 'idle' },
        },
        saveState: {
          currentPosition: { caseId: state.caseId, sceneId: action.targetSceneId },
          caseStates: {
            ...save.caseStates,
            [state.caseId]: navUpdatedCaseState,
          },
        },
        effects: navEffects,
      };
    }

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

/**
 * puzzle_overlay 닫기 공통 로직.
 * CLOSE_PUZZLE_OVERLAY와 CLOSE_PUZZLE(puzzle_overlay 컨텍스트) 양쪽에서 사용.
 */
export function closePuzzleOverlayResult(
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
