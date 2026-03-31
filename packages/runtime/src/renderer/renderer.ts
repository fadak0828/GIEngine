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
  SubPuzzle,
} from '@gi-engine/core';
import { I18nManager, getAllCases, findCase, findScene, findPuzzle } from '@gi-engine/core';

import { SceneRenderer } from './scene-renderer.js';
import { DeductionRenderer } from './deduction-renderer.js';
import { CaseSelectRenderer } from './case-select-renderer.js';
import { PopupRenderer } from './popup-renderer.js';
import { PuzzleBarRenderer } from './puzzle-bar-renderer.js';
import { SubPuzzleRenderer } from './sub-puzzle-renderer.js';
import { WordBankPanelRenderer } from './word-bank-panel-renderer.js';

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
  private lastSlotAssignments: Record<string, string | null> = {};
  private lastCollectedWordIds: string[] = [];
  // Tracks the sub-state reference currently shown in the popup.
  // Used to avoid destroying and recreating the popup on incremental
  // updates (e.g. word collection while the popup is already open).
  private lastExaminingSubState: object | null = null;
  private puzzleBarRenderer: PuzzleBarRenderer;
  private subPuzzleRenderer: SubPuzzleRenderer;
  private wordBankPanelRenderer: WordBankPanelRenderer;
  private puzzleOverlayEl: HTMLElement | null = null;

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

    this.puzzleBarRenderer = new PuzzleBarRenderer({
      container: this.container,
      i18n: this.i18n,
      assets: this.assets,
      dispatch: this.dispatch,
    });

    this.subPuzzleRenderer = new SubPuzzleRenderer({
      container: this.container,
      i18n: this.i18n,
      assets: this.assets,
      dispatch: this.dispatch,
    });

    this.wordBankPanelRenderer = new WordBankPanelRenderer({
      container: this.container,
      i18n: this.i18n,
    });
  }

  getDeductionRenderer(): DeductionRenderer {
    return this.deductionRenderer;
  }

  getPopupRenderer(): PopupRenderer {
    return this.popupRenderer;
  }

  getSubPuzzleRenderer(): SubPuzzleRenderer {
    return this.subPuzzleRenderer;
  }

  handleWordCollectedInPopup(wordId: string, def: GameDefinition): void {
    this.popupRenderer.markWordCollected(wordId);
    const wordDef = def.words?.[wordId];
    const wordName = wordDef ? this.i18n.resolveText(wordDef.display) : wordId;
    this.showWordToast(wordName);
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
    this.puzzleBarRenderer.destroy();
    this.subPuzzleRenderer.destroy();
    this.wordBankPanelRenderer.destroy();
    this.closePuzzleOverlay();
    this.removeControls();
    this.removeToast();
    this.currentView = '';
  }

  private clearView(except: string[]): void {
    if (!except.includes('scene')) this.sceneRenderer.destroy();
    if (!except.includes('deduction')) this.deductionRenderer.destroy();
    if (!except.includes('caseSelect')) this.caseSelectRenderer.destroy();
    if (!except.includes('popup')) this.popupRenderer.dismiss();
    if (!except.includes('puzzleBar')) this.puzzleBarRenderer.destroy();
    if (!except.includes('wordBank')) this.wordBankPanelRenderer.destroy();
    if (!except.includes('puzzleOverlay')) this.closePuzzleOverlay();
    this.removeCompletion();
    this.removeLoading();
    this.lastSlotAssignments = {};       // Reset diff state when view changes
    this.lastCollectedWordIds = [];      // Reset word tracking
    this.lastExaminingSubState = null;  // Reset popup sub-state tracking
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

    // Compute collected words and assigned IDs for word bank panel.
    const caseWords = this.collectWordsForCase(def, state.caseId, caseState);
    const assignedWordIds = this.collectAssignedWordIds(caseState);

    if (this.currentView !== `exploring:${state.sceneId}`) {
      this.clearView([]);
      this.currentView = `exploring:${state.sceneId}`;
      this.sceneRenderer.render(scene, caseState);
      this.renderControls(scene, state, def);
      // Full render of word bank panel on scene change.
      this.wordBankPanelRenderer.render(caseWords, assignedWordIds);
    } else {
      // Update layers in place
      this.sceneRenderer.updateLayerVisibility(caseState);
      // Incremental update — preserves expanded/collapsed state.
      this.wordBankPanelRenderer.updateWords(caseWords, assignedWordIds);
    }

    // Render puzzle bar at bottom (always visible during exploring)
    const caseData2 = findCase(def, state.caseId);
    if (caseData2 && caseData2.puzzles) {
      this.puzzleBarRenderer.render(caseData2.puzzles, caseState);
    }

    // Close puzzle overlay when not in puzzle_overlay sub-state
    if (state.sub.type !== 'puzzle_overlay') {
      this.closePuzzleOverlay();
    }

    // Handle sub-states
    switch (state.sub.type) {
      case 'idle':
        this.popupRenderer.dismiss();
        this.lastExaminingSubState = null;
        break;
      case 'examining_text':
        if (this.popupRenderer.isOpen() && this.lastExaminingSubState === state.sub) {
          // Same popup already open (e.g. after collecting a word in-popup).
          // Do incremental word-mark update instead of destroy+recreate to avoid flicker.
          for (const wordId of caseState.collectedWordIds) {
            if (!this.lastCollectedWordIds.includes(wordId)) {
              this.popupRenderer.markWordCollected(wordId);
            }
          }
          this.lastCollectedWordIds = [...caseState.collectedWordIds];
        } else {
          this.lastExaminingSubState = state.sub;
          this.lastCollectedWordIds = [...caseState.collectedWordIds];
          this.popupRenderer.showTextPopup(
            state.sub.content,
            state.sub.title,
            state.sub.highlightedWords,
            state.sub.collectibleWords,
            caseState.collectedWordIds,
            (wordId: string) => {
              this.dispatch({ type: 'COLLECT_WORD_IN_POPUP', wordId });
            }
          );
        }
        break;
      case 'examining_image':
        if (this.popupRenderer.isOpen() && this.lastExaminingSubState === state.sub) {
          // Same image popup already open — no content change needed.
          // (word collection in image popups is handled via markWordCollected side-effect)
        } else {
          this.lastExaminingSubState = state.sub;
          this.popupRenderer.showImagePopup(
            state.sub.image,
            state.sub.caption,
            state.sub.innerHotspots,
            (hotspotId: string) => {
              this.dispatch({ type: 'INNER_HOTSPOT_CLICK', hotspotId });
            }
          );
        }
        break;
      case 'word_collected': {
        this.popupRenderer.dismiss();
        const wordNames = state.sub.wordIds.map(wid => {
          const wordDef = def.words?.[wid];
          return wordDef ? this.i18n.resolveText(wordDef.display) : wid;
        });
        if (wordNames.length === 1) {
          this.showWordToast(wordNames[0]);
        } else {
          this.showWordToast(wordNames.join(', '), wordNames.length);
        }
        break;
      }
      case 'puzzle_overlay': {
        this.popupRenderer.dismiss();
        this.renderPuzzleOverlay(state.sub.puzzleId, state, save, def);
        break;
      }
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

    // Compute which words are currently assigned to any slot
    const assignedWordIds = new Set<string>();
    for (const wordId of Object.values(puzzleState.slotAssignments)) {
      if (wordId) assignedWordIds.add(wordId);
    }

    if (this.currentView !== `thinking:${state.puzzleId}`) {
      // First visit to this puzzle: full mount
      this.clearView([]);
      this.removeControls();
      this.currentView = `thinking:${state.puzzleId}`;
      // Snapshot current assignments so the diff starts clean
      this.lastSlotAssignments = { ...puzzleState.slotAssignments };

      if ('template' in puzzle) {
        this.deductionRenderer.render(
          puzzle as Puzzle,
          puzzleState,
          caseWords,
          assignedWordIds
        );
      }
    } else {
      // Repeat visit (e.g. after ASSIGN_WORD / UNASSIGN_WORD dispatch):
      // Apply incremental DOM updates — do NOT re-mount the deduction UI
      const current = puzzleState.slotAssignments;

      for (const slotId of Object.keys(current)) {
        const newWordId = current[slotId] ?? null;
        const oldWordId = this.lastSlotAssignments[slotId] ?? null;
        if (newWordId !== oldWordId) {
          this.deductionRenderer.updateSlotContent(slotId, newWordId, caseWords);
          this.lastSlotAssignments[slotId] = newWordId;
        }
      }

      // Also handle slots that existed in lastSlotAssignments but were removed
      // (e.g. if the puzzle template changed — defensive)
      for (const slotId of Object.keys(this.lastSlotAssignments)) {
        if (!(slotId in current)) {
          this.deductionRenderer.updateSlotContent(slotId, null, caseWords);
          delete this.lastSlotAssignments[slotId];
        }
      }

      // Sync word bank assigned state for all words
      for (const word of caseWords) {
        this.deductionRenderer.updateWordBankItem(word.id, assignedWordIds.has(word.id));
      }
    }

    // Sub-state handling (same position as before — after the mount/update branch)
    if (state.sub.type === 'showing_result') {
      this.deductionRenderer.showValidationResults(state.sub.results);
    } else if (state.sub.type === 'solved') {
      // Show all-correct validation results + celebration overlay
      const allCorrectResults: ValidationResult = {
        allCorrect: true,
        slotResults: {},
      };
      for (const slotId of Object.keys(puzzleState.slotAssignments)) {
        allCorrectResults.slotResults[slotId] = 'correct';
      }
      this.deductionRenderer.showValidationResults(allCorrectResults);
      this.deductionRenderer.showSolvedCelebration(() => {
        this.dispatch({ type: 'CLOSE_PUZZLE' });
      });
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

  // --- Puzzle Overlay ---

  private renderPuzzleOverlay(
    puzzleId: string,
    state: GameState & { type: 'exploring' },
    save: SaveState,
    def: GameDefinition
  ): void {
    const caseData = findCase(def, state.caseId);
    if (!caseData) return;
    const caseState = save.caseStates[state.caseId];
    if (!caseState) return;

    const puzzle = findPuzzle(caseData.puzzles, puzzleId);
    if (!puzzle) return;
    const puzzleState = caseState.puzzleStates[puzzleId];
    if (!puzzleState) return;

    // Collect words
    const caseWords = this.collectWordsForCase(def, state.caseId, caseState);
    const assignedWordIds = new Set<string>();
    for (const wordId of Object.values(puzzleState.slotAssignments)) {
      if (wordId) assignedWordIds.add(wordId);
    }

    // Create or reuse overlay
    if (!this.puzzleOverlayEl) {
      const overlay = document.createElement('div');
      overlay.className = 'gi-puzzle-overlay';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'gi-puzzle-overlay-close';
      closeBtn.textContent = '\u00D7';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.addEventListener('click', () => {
        this.dispatch({ type: 'CLOSE_PUZZLE_OVERLAY' });
      });
      overlay.appendChild(closeBtn);

      const content = document.createElement('div');
      content.className = 'gi-puzzle-overlay-content';
      overlay.appendChild(content);

      this.puzzleOverlayEl = overlay;
      this.container.appendChild(overlay);
    }

    const content = this.puzzleOverlayEl.querySelector<HTMLElement>('.gi-puzzle-overlay-content');
    if (!content) return;

    if ('template' in puzzle && puzzle.type === 'fill_in_blank') {
      this.subPuzzleRenderer.destroy();
      content.innerHTML = '';

      const tempDeduction = new DeductionRenderer({
        container: content,
        i18n: this.i18n,
        assets: this.assets,
        dispatch: this.dispatch,
      });
      tempDeduction.render(puzzle as Puzzle, puzzleState, caseWords, assignedWordIds);

      // 방금 정답을 맞힌 경우 축하 오버레이 표시
      if (state.sub.type === 'puzzle_overlay' && state.sub.solved) {
        const allCorrectResults: ValidationResult = { allCorrect: true, slotResults: {} };
        for (const slotId of Object.keys(puzzleState.slotAssignments)) {
          allCorrectResults.slotResults[slotId] = 'correct';
        }
        tempDeduction.showValidationResults(allCorrectResults);
        tempDeduction.showSolvedCelebration(() => {
          this.dispatch({ type: 'CLOSE_PUZZLE_OVERLAY' });
        });
      }
    } else {
      content.innerHTML = '';
      this.subPuzzleRenderer = new SubPuzzleRenderer({
        container: content,
        i18n: this.i18n,
        assets: this.assets,
        dispatch: this.dispatch,
      });
      this.subPuzzleRenderer.render(puzzle as SubPuzzle, puzzleState, caseWords, assignedWordIds);
    }
  }

  private closePuzzleOverlay(): void {
    this.subPuzzleRenderer.destroy();
    if (this.puzzleOverlayEl) {
      this.puzzleOverlayEl.remove();
      this.puzzleOverlayEl = null;
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

  private showWordToast(wordDisplay: string, count?: number): void {
    this.removeToast();

    const toast = document.createElement('div');
    toast.className = 'gi-toast gi-toast--word';

    const icon = document.createElement('span');
    icon.className = 'gi-toast-icon';
    icon.textContent = '\u2728';
    toast.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'gi-toast-text';
    if (count && count > 1) {
      text.textContent = `${count}개 단어 획득: ${wordDisplay}`;
    } else {
      text.textContent = `「${wordDisplay}」 획득!`;
    }
    toast.appendChild(text);

    this.toastEl = toast;
    this.container.appendChild(toast);

    this.toastTimeout = setTimeout(() => {
      toast.classList.add('gi-toast--exit');
      setTimeout(() => this.removeToast(), 300);
    }, 2500);
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
   * Primary path: look up from the global words dictionary (def.words).
   * Fallback: scan scenes in the current case for word_reveal actions.
   * Last resort: emit warning and use ID as display label.
   */
  private collectWordsForCase(
    def: GameDefinition,
    caseId: string,
    caseState: CaseState
  ): Word[] {
    const results: Word[] = [];
    // Lazily built fallback map for games without def.words (computed once, reused)
    let fallbackMap: Map<string, Word> | null = null;

    for (const wordId of caseState.collectedWordIds) {
      // Primary path: look up from the global words dictionary
      // Covers all cases — including words collected cross-case
      const wordDef = def.words?.[wordId];
      if (wordDef) {
        results.push({
          id: wordId,
          display: wordDef.display,
          category: wordDef.category,
          hint: wordDef.hint,
          caseId,
        });
        continue;
      }

      // Fallback path: scan scenes in the current case for word_reveal actions
      // Preserves backward compatibility with game definitions that lack def.words
      if (fallbackMap === null) {
        fallbackMap = new Map<string, Word>();
        const caseData = findCase(def, caseId);
        if (caseData) {
          for (const scene of caseData.scenes) {
            for (const hotspot of scene.hotspots) {
              this.extractWordsFromAction(hotspot.action, def, caseId, fallbackMap);
            }
          }
        }
      }
      const found = fallbackMap.get(wordId);
      if (found) {
        results.push(found);
        continue;
      }

      // Last resort: emit warning and use ID as display label
      // Prevents silent data loss — the word appears but with a visible broken label
      console.warn(`[GIEngine] No word definition found for collected word: "${wordId}"`);
      results.push({
        id: wordId,
        display: { ko: wordId, en: wordId },
        caseId,
      });
    }

    return results;
  }

  /**
   * Collect the set of word IDs that are currently assigned to any puzzle
   * slot in this case.  Used by the word-bank panel to grey out used words.
   */
  private collectAssignedWordIds(caseState: CaseState): Set<string> {
    const ids = new Set<string>();
    for (const puzzleState of Object.values(caseState.puzzleStates)) {
      for (const wordId of Object.values(puzzleState.slotAssignments)) {
        if (wordId) ids.add(wordId);
      }
    }
    return ids;
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
