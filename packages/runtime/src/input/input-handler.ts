import type { GameEvent } from '@gi-engine/core';

export interface InputHandlerOptions {
  container: HTMLElement;
  dispatch: (event: GameEvent) => void;
}

/**
 * Handles mouse/pointer click events on hotspots within the scene.
 * Hotspot clicks are delegated from the scene renderer, but this handler
 * manages the container-level click detection for dismissing popups.
 */
export class InputHandler {
  private container: HTMLElement;
  private dispatch: (event: GameEvent) => void;
  private boundHandlers: Array<{ el: EventTarget; type: string; fn: EventListener }> = [];

  constructor(opts: InputHandlerOptions) {
    this.container = opts.container;
    this.dispatch = opts.dispatch;
  }

  attach(): void {
    // Scene-level click: clicking the background (not a hotspot) while a popup
    // is open will close it. Hotspot clicks are handled by the scene renderer.
    const sceneClick = (e: Event) => {
      const target = e.target as HTMLElement;
      // If clicking the scene background directly (not a hotspot or popup)
      if (
        target.classList.contains('gi-scene-bg') ||
        target.classList.contains('gi-scene')
      ) {
        // Close popup if open (the engine handles this via state)
        this.dispatch({ type: 'CLOSE_POPUP' });
      }
    };

    this.container.addEventListener('click', sceneClick);
    this.boundHandlers.push({ el: this.container, type: 'click', fn: sceneClick });
  }

  detach(): void {
    for (const { el, type, fn } of this.boundHandlers) {
      el.removeEventListener(type, fn);
    }
    this.boundHandlers = [];
  }
}
