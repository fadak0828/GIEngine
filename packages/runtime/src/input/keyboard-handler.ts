import type { GameEvent, GameState } from '@gi-engine/core';

export interface KeyboardHandlerOptions {
  container: HTMLElement;
  dispatch: (event: GameEvent) => void;
  getState: () => GameState;
}

/**
 * Keyboard accessibility handler.
 * - Tab navigation between hotspots/slots
 * - Enter to activate hotspot or select word
 * - Escape to close popup or exit puzzle
 */
export class KeyboardHandler {
  private container: HTMLElement;
  private dispatch: (event: GameEvent) => void;
  private getState: () => GameState;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(opts: KeyboardHandlerOptions) {
    this.container = opts.container;
    this.dispatch = opts.dispatch;
    this.getState = opts.getState;

    this.onKeyDownBound = this.onKeyDown.bind(this);
  }

  attach(): void {
    this.container.addEventListener('keydown', this.onKeyDownBound);
  }

  detach(): void {
    this.container.removeEventListener('keydown', this.onKeyDownBound);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const state = this.getState();

    switch (e.key) {
      case 'Escape':
        this.handleEscape(state);
        break;
      case 'Tab':
        this.handleTab(e, state);
        break;
      case 'Enter':
      case ' ':
        this.handleActivate(e, state);
        break;
    }
  }

  private handleEscape(state: GameState): void {
    switch (state.type) {
      case 'exploring':
        if (state.sub.type === 'examining_text' || state.sub.type === 'examining_image') {
          this.dispatch({ type: 'CLOSE_POPUP' });
        }
        break;
      case 'thinking':
        this.dispatch({ type: 'CLOSE_PUZZLE' });
        break;
    }
  }

  private handleTab(e: KeyboardEvent, state: GameState): void {
    // Collect all focusable elements within the current view
    const focusables = this.getFocusableElements(state);
    if (focusables.length === 0) return;

    const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);

    if (e.shiftKey) {
      // Move backwards
      const nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
      e.preventDefault();
      focusables[nextIndex].focus();
    } else {
      // Move forward
      const nextIndex = currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1;
      e.preventDefault();
      focusables[nextIndex].focus();
    }
  }

  private handleActivate(e: KeyboardEvent, state: GameState): void {
    const target = e.target as HTMLElement;

    // Hotspot activation
    if (target.classList.contains('gi-hotspot')) {
      const hotspotId = target.dataset.hotspotId;
      if (hotspotId) {
        e.preventDefault();
        this.dispatch({ type: 'HOTSPOT_CLICK', hotspotId });
      }
      return;
    }

    // Word activation in thinking mode (keyboard-based word-to-slot assignment)
    if (state.type === 'thinking' && target.classList.contains('gi-word')) {
      if (target.classList.contains('gi-word--assigned')) return;
      const wordId = target.dataset.wordId;
      if (!wordId) return;

      e.preventDefault();

      // Find the first empty slot and assign the word there
      const slots = this.container.querySelectorAll<HTMLElement>('.gi-slot--empty');
      if (slots.length > 0) {
        const slotId = slots[0].dataset.slotId;
        if (slotId) {
          this.dispatch({ type: 'ASSIGN_WORD', slotId, wordId });
        }
      }
      return;
    }

    // Slot click to unassign (Enter on a filled slot)
    if (state.type === 'thinking' && target.classList.contains('gi-slot') && target.classList.contains('gi-slot--filled')) {
      const slotId = target.dataset.slotId;
      if (slotId) {
        e.preventDefault();
        this.dispatch({ type: 'UNASSIGN_WORD', slotId });
      }
      return;
    }
  }

  private getFocusableElements(state: GameState): HTMLElement[] {
    const selector: string[] = [];

    switch (state.type) {
      case 'exploring':
        selector.push('.gi-hotspot', '.gi-hud-btn');
        break;
      case 'thinking':
        selector.push('.gi-slot', '.gi-word:not(.gi-word--assigned)', '.gi-btn');
        break;
      case 'case_select':
        selector.push('.gi-case-card:not(.gi-case-card--locked)');
        break;
      default:
        selector.push('.gi-btn');
        break;
    }

    // Also include popup close
    if (this.container.querySelector('.gi-popup')) {
      selector.push('.gi-popup-close');
    }

    return Array.from(
      this.container.querySelectorAll<HTMLElement>(selector.join(', '))
    );
  }
}
