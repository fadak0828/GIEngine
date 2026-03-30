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

// Default export
export { GIEngine as default } from './engine.js';

// IIFE boot contract — called by exported HTML template
import type { GameDefinition } from '@gi-engine/core';
import { GIEngine as _GIEngine } from './engine.js';

if (typeof window !== 'undefined') {
  (window as any).__giEngineBoot__ = async function(
    root: HTMLElement,
    gameData: GameDefinition
  ): Promise<void> {
    root.innerHTML = '';
    const engine = new _GIEngine({
      container: root,
      definition: gameData,
      loadSave: true,
    });
    await engine.start();
  };
}
