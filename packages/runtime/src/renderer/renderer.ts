import type {
  GameDefinition,
  GameState,
  SaveState,
  Case,
  Scene,
  Puzzle,
  Word,
  CaseState,
  PuzzleState,
  GameEvent,
  AssetManifest,
  ValidationResult,
} from '@gi-engine/core';
import { I18nManager, getAllCases, findCase, findScene, findPuzzle } from '@gi-engine/core';

import { SceneRenderer } from './scene-renderer.js';
import { DeductionRenderer } from './deduction-renderer.js';
import { CaseSelectRenderer } from './case-select-renderer.js';
import { PopupRenderer } from './popup-renderer.js';

export interface RendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
  onHotspotClick: (hotspotId: string) => void;
}

export class Renderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;

  private sceneRenderer: SceneRenderer;
  private deductionRenderer: DeductionRenderer;
  private caseSelectRenderer: CaseSelectRenderer;
  private popupRenderer: PopupRenderer;

  private controlsEl: HTMLElement | null = null;
  private toastEl: HTMLElement | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentView: string = '';

  constructor(opts: RendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;

    this.sceneRenderer = new SceneRenderer({
      container: this.container,
      i18n: this.i18n,
      assets: this.assets,
      onHotspotClick: opts.onHotspotClick,
    });

    this.deductionRenderer = new DeductionRenderer({
      container: this.container,
      i18n: this.i18n,
      assets: this.assets,
      dispatch: this.dispatch,
    });

    this.caseSelectRenderer = new CaseSelectRenderer({
      container: this.container,
      i18n: this.i18n,
      assets: this.assets,
      dispatch: this.dispatch,
    });

    this.popupRenderer = new PopupRenderer({
      container: this.container,
      i18n: this.i18n,
      assets: this.assets,
      dispatch: this.dispatch,
    });
  }

  getDeductionRenderer(): DeductionRenderer {
    return this.deductionRenderer;
  }

  getPopupRenderer(): PopupRenderer {
    return this.popupRenderer;
  }

  update(state: GameState, save: SaveState, def: GameDefinition): void {
    switch (state.type) {
      case 'loading':
        this.renderLoading(state.progress);
        break;
      case 'case_select':
        this.renderCaseSelect(def, save);
        break;
      case 'exploring':
        this.renderExploring(state, save, def);
        break;
      case 'thinking':
        this.renderThinking(state, save, def);
        break;
      case 'case_completed':
        this.renderCaseCompleted(state, def);
        break;
      case 'game_completed':
        this.renderGameCompleted();
        break;
    }
  }

  destroy(): void {
    this.sceneRenderer.destroy();
    this.deductionRenderer.destroy();
    this.caseSelectRenderer.destroy();
    this.popupRenderer.dismiss();
    this.removeControls();
    this.removeToast();
    this.currentView = '';
  }

  private clearView(except: string[]): void {
    if (!except.includes('scene')) this.sceneRenderer.destroy();
    if (!except.includes('deduction')) this.deductionRenderer.destroy();
    if (!except.includes('caseSelect')) this.caseSelectRenderer.destroy();
    if (!except.includes('popup')) this.popupRenderer.dismiss();
    this.removeCompletion();
    this.removeLoading();
  }

  // --- Loading ---

  private renderLoading(progress: number): void {
    if (this.currentView !== 'loading') {
      this.clearView([]);
      this.currentView = 'loading';
    }

    let loadingEl = this.container.querySelector<HTMLElement>('.gi-loading');
    if (!loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.className = 'gi-loading';

      const text = document.createElement('div');
      text.className = 'gi-loading-text';
      text.textContent = this.i18n.resolveKey('ui.loading');
      loadingEl.appendChild(text);

      const bar = document.createElement('div');
      bar.className = 'gi-loading-bar';
      const fill = document.createElement('div');
      fill.className = 'gi-loading-fill';
      bar.appendChild(fill);
      loadingEl.appendChild(bar);

      this.container.appendChild(loadingEl);
    }

    const fill = loadingEl.querySelector<HTMLElement>('.gi-loading-fill');
    if (fill) {
      fill.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    }
  }

  private removeLoading(): void {
    const el = this.container.querySelector('.gi-loading');
    if (el) el.remove();
  }

  // --- Case Select ---

  private renderCaseSelect(def: GameDefinition, save: SaveState): void {
    if (this.currentView !== 'caseSelect') {
      this.clearView([]);
      this.removeControls();
      this.currentView = 'caseSelect';
    }
    const cases = getAllCases(def);
    this.caseSelectRenderer.render(cases, save);
  }

  // --- Exploring ---

  private renderExploring(
    state: GameState & { type: 'exploring' },
    save: SaveState,
    def: GameDefinition
  ): void {
    const caseData = findCase(def, state.caseId);
    if (!caseData) return;
    const scene = findScene(caseData, state.sceneId);
    if (!scene) return;
    const caseState = save.caseStates[state.caseId];
    if (!caseState) return;

    if (this.currentView !== `exploring:${state.sceneId}`) {
      this.clearView([]);
      this.currentView = `exploring:${state.sceneId}`;
      this.sceneRenderer.render(scene, caseState);
      this.renderControls(scene, state, def);
    } else {
      // Update layers in place
      this.sceneRenderer.updateLayerVisibility(caseState);
    }

    // Handle sub-states
    switch (state.sub.type) {
      case 'idle':
        this.popupRenderer.dismiss();
        break;
      case 'examining_text':
        this.popupRenderer.showTextPopup(
          state.sub.content,
          state.sub.title,
          state.sub.highlightedWords
        );
        break;
      case 'examining_image':
        this.popupRenderer.showImagePopup(
          state.sub.image,
          state.sub.caption
        );
        break;
      case 'word_collected':
        this.popupRenderer.dismiss();
        this.showToast(this.i18n.resolveKey('ui.word_collected'));
        break;
      case 'transitioning':
        // Will be handled by next state update
        break;
    }
  }

  // --- Thinking (Puzzle) ---

  private renderThinking(
    state: GameState & { type: 'thinking' },
    save: SaveState,
    def: GameDefinition
  ): void {
    const caseData = findCase(def, state.caseId);
    if (!caseData) return;
    const caseState = save.caseStates[state.caseId];
    if (!caseState) return;

    const puzzle = findPuzzle(caseData.puzzles, state.puzzleId);
    if (!puzzle) return;
    const puzzleState = caseState.puzzleStates[state.puzzleId];
    if (!puzzleState) return;

    // Collect words for this case from the game definition
    const caseWords = this.collectWordsForCase(def, state.caseId, caseState);

    // Compute which words are assigned to slots
    const assignedWordIds = new Set<string>();
    for (const wordId of Object.values(puzzleState.slotAssignments)) {
      if (wordId) assignedWordIds.add(wordId);
    }

    if (this.currentView !== `thinking:${state.puzzleId}`) {
      this.clearView([]);
      this.removeControls();
      this.currentView = `thinking:${state.puzzleId}`;

      if ('template' in puzzle) {
        this.deductionRenderer.render(
          puzzle as Puzzle,
          puzzleState,
          caseWords,
          assignedWordIds
        );
      }
    }

    // Handle sub-states
    if (state.sub.type === 'showing_result') {
      this.deductionRenderer.showValidationResults(state.sub.results);
    }
  }

  // --- Case Completed ---

  private renderCaseCompleted(
    state: GameState & { type: 'case_completed' },
    def: GameDefinition
  ): void {
    if (this.currentView !== `caseCompleted:${state.caseId}`) {
      this.clearView([]);
      this.removeControls();
      this.currentView = `caseCompleted:${state.caseId}`;

      const el = document.createElement('div');
      el.className = 'gi-completion';
      el.dataset.view = 'caseCompleted';

      const title = document.createElement('h1');
      title.className = 'gi-completion-title';
      title.textContent = this.i18n.resolveKey('ui.case_complete_title');
      el.appendChild(title);

      const caseData = findCase(def, state.caseId);
      if (caseData) {
        const subtitle = document.createElement('p');
        subtitle.className = 'gi-completion-subtitle';
        subtitle.textContent = this.i18n.resolveText(caseData.title);
        el.appendChild(subtitle);
      }

      const btn = document.createElement('button');
      btn.className = 'gi-btn gi-btn--primary';
      btn.textContent = this.i18n.resolveKey('ui.back');
      btn.addEventListener('click', () => this.dispatch({ type: 'BACK_TO_SELECT' }));
      el.appendChild(btn);

      this.container.appendChild(el);
    }
  }

  // --- Game Completed ---

  private renderGameCompleted(): void {
    if (this.currentView !== 'gameCompleted') {
      this.clearView([]);
      this.removeControls();
      this.currentView = 'gameCompleted';

      const el = document.createElement('div');
      el.className = 'gi-completion';
      el.dataset.view = 'gameCompleted';

      const title = document.createElement('h1');
      title.className = 'gi-completion-title';
      title.textContent = this.i18n.resolveKey('ui.game_complete');
      el.appendChild(title);

      const btn = document.createElement('button');
      btn.className = 'gi-btn gi-btn--primary';
      btn.textContent = this.i18n.resolveKey('ui.back');
      btn.addEventListener('click', () => this.dispatch({ type: 'BACK_TO_SELECT' }));
      el.appendChild(btn);

      this.container.appendChild(el);
    }
  }

  private removeCompletion(): void {
    const els = this.container.querySelectorAll('.gi-completion');
    for (const el of els) el.remove();
  }

  // --- Controls HUD ---

  private renderControls(
    scene: Scene,
    state: GameState & { type: 'exploring' },
    def: GameDefinition
  ): void {
    this.removeControls();

    const controls = document.createElement('div');
    controls.className = 'gi-controls';

    // Left side
    const left = document.createElement('div');
    left.className = 'gi-controls-left';

    const backBtn = document.createElement('button');
    backBtn.className = 'gi-hud-btn';
    backBtn.textContent = this.i18n.resolveKey('ui.back');
    backBtn.addEventListener('click', () => this.dispatch({ type: 'BACK_TO_SELECT' }));
    left.appendChild(backBtn);

    const sceneName = document.createElement('span');
    sceneName.className = 'gi-scene-name';
    sceneName.textContent = this.i18n.resolveText(scene.name);
    left.appendChild(sceneName);

    controls.appendChild(left);

    // Right side
    const right = document.createElement('div');
    right.className = 'gi-controls-right';

    // Puzzle button
    const caseData = findCase(def, state.caseId);
    if (caseData && caseData.puzzles?.main) {
      const puzzleBtn = document.createElement('button');
      puzzleBtn.className = 'gi-hud-btn';
      puzzleBtn.textContent = this.i18n.resolveKey('ui.thinking');
      puzzleBtn.addEventListener('click', () => {
        this.dispatch({ type: 'OPEN_PUZZLE', puzzleId: caseData.puzzles.main.id });
      });
      right.appendChild(puzzleBtn);
    }

    controls.appendChild(right);

    this.controlsEl = controls;
    this.container.appendChild(controls);
  }

  private removeControls(): void {
    if (this.controlsEl) {
      this.controlsEl.remove();
      this.controlsEl = null;
    }
  }

  // --- Toast ---

  private showToast(message: string): void {
    this.removeToast();

    const toast = document.createElement('div');
    toast.className = 'gi-toast';
    toast.textContent = message;
    this.toastEl = toast;
    this.container.appendChild(toast);

    this.toastTimeout = setTimeout(() => {
      this.removeToast();
    }, 2000);
  }

  private removeToast(): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    if (this.toastEl) {
      this.toastEl.remove();
      this.toastEl = null;
    }
  }

  // --- Helpers ---

  /**
   * Collect all Word objects that the player has collected for a specific case.
   * Words are defined per-case in the game definition's acts.
   * We find all words referenced by word_reveal hotspot actions in the case's scenes.
   */
  private collectWordsForCase(
    def: GameDefinition,
    caseId: string,
    caseState: CaseState
  ): Word[] {
    const caseData = findCase(def, caseId);
    if (!caseData) return [];

    // Build a word map from all scenes' word_reveal actions
    const wordMap = new Map<string, Word>();

    const extractWords = (scenes: Scene[]) => {
      for (const scene of scenes) {
        for (const hotspot of scene.hotspots) {
          this.extractWordsFromAction(hotspot.action, def, caseId, wordMap);
        }
      }
    };

    extractWords(caseData.scenes);

    // Return only collected words
    return caseState.collectedWordIds
      .map(id => wordMap.get(id))
      .filter((w): w is Word => w !== undefined);
  }

  private extractWordsFromAction(
    action: any,
    def: GameDefinition,
    caseId: string,
    wordMap: Map<string, Word>
  ): void {
    if (action.type === 'word_reveal') {
      for (const wordId of action.wordIds) {
        if (!wordMap.has(wordId)) {
          const wordDef = def.words?.[wordId];
          if (!wordDef) {
            console.warn(`[GIEngine] Word definition missing for id: "${wordId}". Using id as label.`);
          }
          wordMap.set(wordId, {
            id: wordId,
            display: wordDef?.display ?? { ko: wordId, en: wordId },
            category: wordDef?.category,
            caseId,
          });
        }
      }
    } else if (action.type === 'composite') {
      for (const sub of action.actions) {
        this.extractWordsFromAction(sub, def, caseId, wordMap);
      }
    } else if (action.type === 'examine_image' && action.innerHotspots) {
      for (const h of action.innerHotspots) {
        this.extractWordsFromAction(h.action, def, caseId, wordMap);
      }
    }
  }
}
