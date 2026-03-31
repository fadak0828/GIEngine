import type {
  GameState,
  GameEvent,
  SaveState,
  GameDefinition,
  StateTransitionResult,
} from '../models/types.js';
import { findCase } from '../models/types.js';
import { noTransition } from './hotspot-action-handlers.js';

/**
 * loading 상태 처리.
 */
export function handleLoading(
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

/**
 * case_select 상태 처리.
 */
export function handleCaseSelect(
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

/**
 * case_completed 상태 처리.
 */
export function handleCaseCompleted(
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

/**
 * game_completed 상태 처리.
 */
export function handleGameCompleted(
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
