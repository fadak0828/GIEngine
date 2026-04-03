import type { Hint, HintConfig, GameEvent } from '@gi-engine/core';
import { HintRenderer } from './hint-renderer.js';

export interface HintManagerOptions {
  container: HTMLElement;
  i18n: import('@gi-engine/core').I18nManager;
  dispatch: (event: GameEvent) => void;
}

interface PuzzleHintState {
  hintsUsed: number;
  lastHintTime: number;
  cooldownRemaining: number;
}

export class HintManager {
  private container: HTMLElement;
  private i18n: import('@gi-engine/core').I18nManager;
  private dispatch: (event: GameEvent) => void;
  private renderer: HintRenderer;
  private defaultConfig: HintConfig = {
    maxHints: 3,
    cooldownSec: 30,
    scorePenalty: 0,
  };
  private puzzleStates: Map<string, PuzzleHintState> = new Map();
  private hints: Map<string, Hint[]> = new Map();
  private cooldownIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(opts: HintManagerOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.dispatch = opts.dispatch;

    this.renderer = new HintRenderer({
      container: this.container,
      i18n: this.i18n,
      onHintRequest: (level) => this.requestHint(level),
      onClose: () => this.renderer.dismiss(),
    });
  }

  setHints(puzzleId: string, hints: Hint[]): void {
    this.hints.set(puzzleId, hints);
  }

  getHintButton(puzzleId: string, config?: HintConfig): HTMLElement {
    const cfg = { ...this.defaultConfig, ...config };
    const state = this.getOrCreateState(puzzleId);

    return this.renderer.showHintButton(
      puzzleId,
      cfg.maxHints - state.hintsUsed,
      state.cooldownRemaining
    );
  }

  requestHint(level: 1 | 2 | 3, puzzleId?: string): void {
    const currentPuzzleId = puzzleId ?? this.getCurrentPuzzleId();
    if (!currentPuzzleId) return;

    const state = this.getOrCreateState(currentPuzzleId);
    const hints = this.hints.get(currentPuzzleId) ?? [];
    const availableHints = hints.filter(h => h.level === level);

    if (availableHints.length === 0) {
      availableHints.push(...hints.filter(h => h.level === level));
    }

    const hint = this.selectBestHint(availableHints, level);
    if (!hint) return;

    const config = this.defaultConfig;

    if (state.hintsUsed >= config.maxHints) {
      return;
    }

    state.hintsUsed++;
    state.lastHintTime = Date.now();

    this.renderer.showHint(hint, config.maxHints - state.hintsUsed, config.scorePenalty);

    this.startCooldown(currentPuzzleId, config.cooldownSec);

    if (config.scorePenalty && config.scorePenalty > 0) {
      this.dispatch({
        type: 'APPLY_HINT_PENALTY',
        puzzleId: currentPuzzleId,
        penalty: config.scorePenalty,
      });
    }
  }

  private selectBestHint(hints: Hint[], requestedLevel: 1 | 2 | 3): Hint | undefined {
    const levelHints = hints.filter(h => h.level === requestedLevel);
    if (levelHints.length > 0) {
      return levelHints[0];
    }

    const nearbyLevels = [1, 2, 3].filter(l => Math.abs(l - requestedLevel) === 1);
    for (const l of nearbyLevels) {
      const found = hints.find(h => h.level === l);
      if (found) return found;
    }

    return hints[0];
  }

  private getOrCreateState(puzzleId: string): PuzzleHintState {
    if (!this.puzzleStates.has(puzzleId)) {
      this.puzzleStates.set(puzzleId, {
        hintsUsed: 0,
        lastHintTime: 0,
        cooldownRemaining: 0,
      });
    }
    return this.puzzleStates.get(puzzleId)!;
  }

  private startCooldown(puzzleId: string, cooldownSec: number): void {
    if (this.cooldownIntervals.has(puzzleId)) {
      clearInterval(this.cooldownIntervals.get(puzzleId)!);
    }

    const state = this.getOrCreateState(puzzleId);
    state.cooldownRemaining = cooldownSec;

    this.renderer.showCooldown(cooldownSec);

    const interval = setInterval(() => {
      state.cooldownRemaining--;
      if (state.cooldownRemaining <= 0) {
        state.cooldownRemaining = 0;
        clearInterval(interval);
        this.cooldownIntervals.delete(puzzleId);
      }
    }, 1000);

    this.cooldownIntervals.set(puzzleId, interval);
  }

  resetPuzzle(puzzleId: string): void {
    this.puzzleStates.delete(puzzleId);
    if (this.cooldownIntervals.has(puzzleId)) {
      clearInterval(this.cooldownIntervals.get(puzzleId)!);
      this.cooldownIntervals.delete(puzzleId);
    }
  }

  destroy(): void {
    for (const interval of this.cooldownIntervals.values()) {
      clearInterval(interval);
    }
    this.cooldownIntervals.clear();
    this.renderer.dismiss();
  }

  private getCurrentPuzzleId(): string | undefined {
    return undefined;
  }
}