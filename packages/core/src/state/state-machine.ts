import type {
  GameState,
  GameEvent,
  SaveState,
  GameDefinition,
  StateTransitionResult,
} from '../models/types.js';
import { createInitialSaveState } from '../save/initial-state.js';
import { noTransition } from './hotspot-action-handlers.js';
import {
  handleLoading,
  handleCaseSelect,
  handleCaseCompleted,
  handleGameCompleted,
} from './save-state-handlers.js';
import { handleExploring } from './exploration-handlers.js';
import { handleThinking } from './puzzle-handlers.js';

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
