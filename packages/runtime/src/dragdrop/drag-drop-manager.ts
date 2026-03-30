import type { GameEvent, Word } from '@gi-engine/core';
import type { DeductionRenderer } from '../renderer/deduction-renderer.js';
import type { SubPuzzleRenderer } from '../renderer/sub-puzzle-renderer.js';
import { I18nManager } from '@gi-engine/core';

export interface DragDropManagerOptions {
  container: HTMLElement;
  dispatch: (event: GameEvent) => void;
  i18n: I18nManager;
  getDeductionRenderer: () => DeductionRenderer;
  getSubPuzzleRenderer?: () => SubPuzzleRenderer;
}

interface DragState {
  wordId: string;
  sourceSlotId?: string;
  ghost: HTMLElement;
  originElement: HTMLElement;
}

/**
 * PointerEvent-based drag and drop for word bank items and slot reassignment.
 * Works with both mouse and touch.
 */
export class DragDropManager {
  private container: HTMLElement;
  private dispatch: (event: GameEvent) => void;
  private i18n: I18nManager;
  private getDeductionRenderer: () => DeductionRenderer;

  private dragState: DragState | null = null;
  private currentDropTarget: HTMLElement | null = null;

  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;

  constructor(opts: DragDropManagerOptions) {
    this.container = opts.container;
    this.dispatch = opts.dispatch;
    this.i18n = opts.i18n;
    this.getDeductionRenderer = opts.getDeductionRenderer;

    this.onPointerDownBound = this.onPointerDown.bind(this);
    this.onPointerMoveBound = this.onPointerMove.bind(this);
    this.onPointerUpBound = this.onPointerUp.bind(this);
  }

  attach(): void {
    this.container.addEventListener('pointerdown', this.onPointerDownBound);
  }

  detach(): void {
    this.container.removeEventListener('pointerdown', this.onPointerDownBound);
    this.cancelDrag();
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.dragState) return;

    const target = e.target as HTMLElement;

    // Check if clicking on a word in the word bank
    const wordEl = target.closest<HTMLElement>('.gi-word');
    if (wordEl && !wordEl.classList.contains('gi-word--assigned')) {
      const wordId = wordEl.dataset.wordId;
      if (!wordId) return;

      e.preventDefault();
      this.startDrag(wordId, wordEl, e, undefined);
      return;
    }

    // Check if clicking on a filled slot (to re-drag word out)
    const slotEl = target.closest<HTMLElement>('.gi-slot--filled');
    if (slotEl) {
      const wordId = slotEl.dataset.wordId;
      const slotId = slotEl.dataset.slotId;
      if (!wordId || !slotId) return;

      e.preventDefault();
      this.startDrag(wordId, slotEl, e, slotId);
      return;
    }
  }

  private startDrag(
    wordId: string,
    originElement: HTMLElement,
    e: PointerEvent,
    sourceSlotId: string | undefined
  ): void {
    // Create ghost element
    const ghost = document.createElement('div');
    ghost.className = 'gi-ghost';
    ghost.textContent = originElement.textContent || wordId;
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    document.body.appendChild(ghost);

    // Mark source as dragging
    originElement.classList.add('gi-word--dragging');

    this.dragState = {
      wordId,
      sourceSlotId,
      ghost,
      originElement,
    };

    // Capture pointer on the container so we get events even outside
    this.container.setPointerCapture(e.pointerId);
    this.container.addEventListener('pointermove', this.onPointerMoveBound);
    this.container.addEventListener('pointerup', this.onPointerUpBound);
    this.container.addEventListener('pointercancel', this.onPointerUpBound);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragState) return;

    e.preventDefault();
    const { ghost } = this.dragState;
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;

    // Find drop target
    // Temporarily hide ghost to hit-test underneath
    ghost.style.pointerEvents = 'none';
    ghost.style.display = 'none';
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    ghost.style.display = '';
    ghost.style.pointerEvents = 'none';

    const slotEl = elementBelow?.closest<HTMLElement>('.gi-slot');

    // Update drop target highlighting
    if (this.currentDropTarget && this.currentDropTarget !== slotEl) {
      this.currentDropTarget.classList.remove('gi-slot--drag-over');
    }

    if (slotEl && slotEl !== this.currentDropTarget) {
      slotEl.classList.add('gi-slot--drag-over');
    }

    this.currentDropTarget = slotEl || null;
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.dragState) return;

    const { wordId, sourceSlotId, ghost, originElement } = this.dragState;

    // Clean up ghost
    ghost.remove();
    originElement.classList.remove('gi-word--dragging');

    // Clean up pointer
    try {
      this.container.releasePointerCapture(e.pointerId);
    } catch {
      // May fail if pointer was already released
    }
    this.container.removeEventListener('pointermove', this.onPointerMoveBound);
    this.container.removeEventListener('pointerup', this.onPointerUpBound);
    this.container.removeEventListener('pointercancel', this.onPointerUpBound);

    // Clear drop target highlighting
    if (this.currentDropTarget) {
      this.currentDropTarget.classList.remove('gi-slot--drag-over');
    }

    // Find the element under the pointer
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const targetSlot = elementBelow?.closest<HTMLElement>('.gi-slot');
    const targetSlotId = targetSlot?.dataset.slotId;

    if (targetSlotId) {
      // Dropped on a slot
      // If dragging from another slot, unassign from source first
      if (sourceSlotId && sourceSlotId !== targetSlotId) {
        this.dispatch({ type: 'UNASSIGN_WORD', slotId: sourceSlotId });
      }
      this.dispatch({ type: 'ASSIGN_WORD', slotId: targetSlotId, wordId });
    } else if (sourceSlotId) {
      // Dropped outside any slot while dragging from a slot = unassign
      this.dispatch({ type: 'UNASSIGN_WORD', slotId: sourceSlotId });
    }
    // Dropped outside any slot from word bank = no-op (returns to bank)

    this.dragState = null;
    this.currentDropTarget = null;
  }

  private cancelDrag(): void {
    if (!this.dragState) return;

    const { ghost, originElement } = this.dragState;
    ghost.remove();
    originElement.classList.remove('gi-word--dragging');

    if (this.currentDropTarget) {
      this.currentDropTarget.classList.remove('gi-slot--drag-over');
    }

    this.dragState = null;
    this.currentDropTarget = null;
  }
}
