import type {
  PuzzleSet,
  Puzzle,
  SubPuzzle,
  CaseState,
  AssetManifest,
  GameEvent,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface PuzzleBarRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
}

/**
 * Renders a bottom bar with puzzle tabs during exploring state.
 * Each tab represents a puzzle (main + sub). Clicking opens a puzzle overlay.
 */
export class PuzzleBarRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;
  private barEl: HTMLElement | null = null;

  constructor(opts: PuzzleBarRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;
  }

  render(puzzles: PuzzleSet, caseState: CaseState): void {
    this.destroy();

    const bar = document.createElement('div');
    bar.className = 'gi-puzzle-bar';

    // Main puzzle tab
    const mainTab = this.createTab(
      puzzles.main,
      caseState.puzzleStates[puzzles.main.id]?.solved ?? false,
      this.getPuzzleIcon(puzzles.main.type)
    );
    bar.appendChild(mainTab);

    // Sub puzzle tabs
    for (const sub of puzzles.sub) {
      const subTab = this.createTab(
        sub,
        caseState.puzzleStates[sub.id]?.solved ?? false,
        this.getPuzzleIcon(sub.type)
      );
      bar.appendChild(subTab);
    }

    this.barEl = bar;
    this.container.appendChild(bar);
  }

  destroy(): void {
    if (this.barEl) {
      this.barEl.remove();
      this.barEl = null;
    }
  }

  updateSolvedState(puzzleId: string, solved: boolean): void {
    if (!this.barEl) return;
    const tab = this.barEl.querySelector<HTMLElement>(`[data-puzzle-id="${puzzleId}"]`);
    if (tab) {
      tab.classList.toggle('gi-puzzle-tab--solved', solved);
    }
  }

  private createTab(puzzle: Puzzle | SubPuzzle, solved: boolean, icon: string): HTMLElement {
    const tab = document.createElement('button');
    tab.className = 'gi-puzzle-tab';
    tab.dataset.puzzleId = puzzle.id;
    tab.setAttribute('aria-label', this.i18n.resolveText(puzzle.title));

    if (solved) {
      tab.classList.add('gi-puzzle-tab--solved');
    }

    const iconEl = document.createElement('span');
    iconEl.className = 'gi-puzzle-tab-icon';
    iconEl.textContent = icon;
    tab.appendChild(iconEl);

    const label = document.createElement('span');
    label.className = 'gi-puzzle-tab-label';
    label.textContent = this.i18n.resolveText(puzzle.title);
    tab.appendChild(label);

    tab.addEventListener('click', () => {
      this.dispatch({ type: 'OPEN_PUZZLE_OVERLAY', puzzleId: puzzle.id });
    });

    return tab;
  }

  private getPuzzleIcon(type: string): string {
    switch (type) {
      case 'fill_in_blank': return '\uD83D\uDD0D';
      case 'character_id': return '\uD83D\uDC64';
      case 'timeline': return '\u23F3';
      case 'relationship': return '\uD83D\uDD17';
      case 'scenario': return '\uD83D\uDCDC';
      default: return '\u2753';
    }
  }
}
