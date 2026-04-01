import './styles/main.css';

export { GIEngine } from './engine.js';
export type { GIEngineOptions } from './engine.js';

// Re-export subsystems for advanced usage
export { Renderer } from './renderer/renderer.js';
export { SceneRenderer } from './renderer/scene-renderer.js';
export { DeductionRenderer } from './renderer/deduction-renderer.js';
export { CaseSelectRenderer } from './renderer/case-select-renderer.js';
export { PopupRenderer } from './renderer/popup-renderer.js';
export { InputHandler } from './input/input-handler.js';
export { KeyboardHandler } from './input/keyboard-handler.js';
export { DragDropManager } from './dragdrop/drag-drop-manager.js';
export { AudioManager } from './audio/audio-manager.js';
export { WordBankPanelRenderer } from './renderer/word-bank-panel-renderer.js';

// Default export
export { GIEngine as default } from './engine.js';

// IIFE boot contract — called by exported HTML template or editor preview
import type { GameDefinition } from '@gi-engine/core';
import { GIEngine as _GIEngine } from './engine.js';

export interface GIEngineBootOptions {
  /** Start the game at a specific case/scene (skips case_select screen) */
  startAt?: { caseId?: string; sceneId?: string };
  /** Whether to load saved game state (default: true) */
  loadSave?: boolean;
}

if (typeof window !== 'undefined') {
  (window as any).__giEngineBoot__ = async function(
    root: HTMLElement,
    gameData: GameDefinition,
    options?: GIEngineBootOptions
  ): Promise<void> {
    root.innerHTML = '';
    const engine = new _GIEngine({
      container: root,
      definition: gameData,
      loadSave: options?.loadSave !== false,
    });
    await engine.start();

    // Navigate to explicit start position (used by editor preview)
    if (options?.startAt?.caseId) {
      engine.dispatch({ type: 'SELECT_CASE', caseId: options.startAt.caseId });
      if (options.startAt.sceneId) {
        engine.dispatch({ type: 'NAVIGATE_SCENE', sceneId: options.startAt.sceneId });
      }
    }
  };
}
