import type {
  GameDefinition,
  GameState,
  GameEvent,
  SaveState,
  SideEffect,
  Locale,
} from '@gi-engine/core';
import {
  transition,
  createInitialSaveState,
  I18nManager,
  SaveManager,
} from '@gi-engine/core';

import { Renderer } from './renderer/renderer.js';
import { InputHandler } from './input/input-handler.js';
import { KeyboardHandler } from './input/keyboard-handler.js';
import { DragDropManager } from './dragdrop/drag-drop-manager.js';
import { AudioManager } from './audio/audio-manager.js';

export interface GIEngineOptions {
  /** The DOM element to mount the engine into */
  container: HTMLElement;
  /** The full game definition JSON */
  definition: GameDefinition;
  /** Design width for responsive scaling (default: 1280) */
  designWidth?: number;
  /** Design height for responsive scaling (default: 720) */
  designHeight?: number;
  /** Locale override (default: first in supportedLocales) */
  locale?: Locale;
  /** Whether to load saved game or start fresh (default: true) */
  loadSave?: boolean;
}

/**
 * GIEngine — the main runtime controller for Golden Idol-style detective games.
 *
 * Initializes all subsystems (renderer, input, drag-drop, keyboard, audio),
 * manages state transitions through the core state machine, executes side effects,
 * and provides responsive scaling via CSS transforms.
 */
export class GIEngine {
  private container: HTMLElement;
  private definition: GameDefinition;
  private designWidth: number;
  private designHeight: number;

  // Core state
  private gameState: GameState;
  private saveState: SaveState;
  private i18n: I18nManager;
  private saveManager: SaveManager;

  // Subsystems
  private renderer: Renderer;
  private inputHandler: InputHandler;
  private keyboardHandler: KeyboardHandler;
  private dragDropManager: DragDropManager;
  private audioManager: AudioManager;

  // Auto-save
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;

  // Responsive scaling
  private resizeObserver: ResizeObserver | null = null;
  private resizeFallbackHandler: (() => void) | null = null;
  private scalerEl: HTMLElement;

  // Event listeners
  private eventListeners: Map<string, Set<(event: GameEvent) => void>> = new Map();

  constructor(opts: GIEngineOptions) {
    this.container = opts.container;
    this.definition = opts.definition;
    this.designWidth = opts.designWidth ?? 1280;
    this.designHeight = opts.designHeight ?? 720;

    // Ensure container has engine class
    this.container.classList.add('gi-engine');

    // Create inner scaler element for responsive transform scaling
    this.scalerEl = document.createElement('div');
    this.scalerEl.style.width = `${this.designWidth}px`;
    this.scalerEl.style.height = `${this.designHeight}px`;
    this.scalerEl.style.transformOrigin = 'top left';
    this.scalerEl.style.position = 'relative';
    this.scalerEl.style.overflow = 'hidden';
    this.container.appendChild(this.scalerEl);

    // I18n
    const locale = opts.locale ?? this.definition.supportedLocales[0] ?? 'ko';
    this.i18n = new I18nManager(locale);

    // Save state
    this.saveManager = new SaveManager(this.definition.id);
    const loadSave = opts.loadSave !== false;

    if (loadSave) {
      const raw = this.saveManager.load();
      const saved = raw ?? this.saveManager.migrate(raw);
      if (saved && saved.gameId === this.definition.id) {
        this.saveState = saved;
        this.i18n.setLocale(saved.currentLocale);
      } else {
        this.saveState = createInitialSaveState(this.definition);
      }
    } else {
      this.saveState = createInitialSaveState(this.definition);
    }

    // Initial game state
    this.gameState = { type: 'loading', progress: 0 };

    // Dispatch bound
    const dispatch = this.dispatch.bind(this);

    // Renderer
    this.renderer = new Renderer({
      container: this.scalerEl,
      i18n: this.i18n,
      assets: this.definition.assets,
      dispatch,
      onHotspotClick: (hotspotId: string) => {
        this.dispatch({ type: 'HOTSPOT_CLICK', hotspotId });
      },
    });

    // Input handler
    this.inputHandler = new InputHandler({
      container: this.scalerEl,
      dispatch,
    });

    // Keyboard handler
    this.keyboardHandler = new KeyboardHandler({
      container: this.scalerEl,
      dispatch,
      getState: () => this.gameState,
    });

    // Drag-drop
    this.dragDropManager = new DragDropManager({
      container: this.scalerEl,
      dispatch,
      i18n: this.i18n,
      getDeductionRenderer: () => this.renderer.getDeductionRenderer(),
      getSubPuzzleRenderer: () => this.renderer.getSubPuzzleRenderer(),
    });

    // Audio
    this.audioManager = new AudioManager({
      assets: this.definition.assets,
    });
  }

  /**
   * Start the engine. Call this after construction to begin the game.
   */
  async start(): Promise<void> {
    // Attach input handlers
    this.inputHandler.attach();
    this.keyboardHandler.attach();
    this.dragDropManager.attach();

    // Setup responsive scaling
    this.setupResponsiveScaling();

    // Unlock audio on first user interaction
    const unlockAudio = () => {
      this.audioManager.unlock();
      this.container.removeEventListener('pointerdown', unlockAudio);
      this.container.removeEventListener('keydown', unlockAudio);
    };
    this.container.addEventListener('pointerdown', unlockAudio);
    this.container.addEventListener('keydown', unlockAudio);

    // Make container focusable for keyboard events
    if (!this.container.hasAttribute('tabindex')) {
      this.container.tabIndex = 0;
    }

    // Initial render
    this.render();

    // Simulate asset loading
    await this.loadAssets();

    // Transition to case_select or resume
    this.dispatch({ type: 'ASSETS_LOADED' });

    // If there's a saved position, resume
    if (this.saveState.currentPosition) {
      const { caseId, sceneId } = this.saveState.currentPosition;
      this.dispatch({ type: 'SELECT_CASE', caseId });
      if (sceneId) {
        this.dispatch({ type: 'NAVIGATE_SCENE', sceneId });
      }
    }

    // Setup auto-save
    const interval = this.definition.settings.autoSaveInterval;
    if (interval > 0) {
      this.autoSaveInterval = setInterval(() => {
        this.saveManager.save(this.saveState);
      }, interval);
    }
  }

  /**
   * Dispatch a game event through the state machine.
   */
  dispatch(event: GameEvent): void {
    const result = transition(
      this.gameState,
      this.saveState,
      event,
      this.definition
    );

    // Update state
    this.gameState = result.nextState;

    // Merge save state changes
    if (result.saveState) {
      this.saveState = { ...this.saveState, ...result.saveState };
      this.saveState.savedAt = new Date().toISOString();
    }

    // Execute side effects (delay SideEffect handled via scheduleDelayedEffects)
    const hasDelay = result.effects.some(e => e.type === 'delay');
    if (hasDelay) {
      this.scheduleDelayedEffects(result.effects);
    } else {
      for (const effect of result.effects) {
        this.executeSideEffect(effect);
      }
    }

    // Re-render
    this.render();

    // Notify listeners
    this.notifyListeners(event);

    // Debug logging
    if (this.definition.settings.debug) {
      console.log('[GIEngine] Event:', event.type, '-> State:', this.gameState.type);
    }
  }

  /**
   * Register an event listener.
   */
  on(eventType: string, callback: (event: GameEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Get current game state (read-only).
   */
  getState(): GameState {
    return this.gameState;
  }

  /**
   * Get current save state (read-only).
   */
  getSaveState(): SaveState {
    return this.saveState;
  }

  /**
   * Change locale at runtime.
   */
  setLocale(locale: Locale): void {
    this.dispatch({ type: 'CHANGE_LOCALE', locale });
    this.i18n.setLocale(locale);
    // Force full re-render to update all text
    this.renderer.destroy();
    this.render();
  }

  /**
   * Toggle audio mute.
   */
  toggleMute(): boolean {
    return this.audioManager.toggleMute();
  }

  /**
   * Reset the game to initial state.
   */
  reset(): void {
    this.saveState = createInitialSaveState(this.definition);
    this.gameState = { type: 'case_select' };
    this.saveManager.save(this.saveState);
    this.renderer.destroy();
    this.render();
  }

  /**
   * Destroy the engine and clean up all resources.
   */
  destroy(): void {
    // Stop auto-save
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    // Detach input
    this.inputHandler.detach();
    this.keyboardHandler.detach();
    this.dragDropManager.detach();

    // Destroy subsystems
    this.renderer.destroy();
    this.audioManager.destroy();

    // Remove resize observer / fallback handler
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeFallbackHandler) {
      window.removeEventListener('resize', this.resizeFallbackHandler);
      this.resizeFallbackHandler = null;
    }

    // Clean up DOM
    this.scalerEl.remove();
    this.container.classList.remove('gi-engine');

    // Clear event listeners
    this.eventListeners.clear();
  }

  // --- Private Methods ---

  private render(): void {
    this.renderer.update(this.gameState, this.saveState, this.definition);
  }

  private executeSideEffect(effect: SideEffect): void {
    switch (effect.type) {
      case 'play_sound':
        this.audioManager.playSfx(effect.assetRef);
        break;
      case 'save_game':
        this.saveManager.save(this.saveState);
        break;
      case 'show_popup':
        if (effect.content.image) {
          this.renderer.getPopupRenderer().showImagePopup(
            effect.content.image,
            effect.content.body
          );
        } else {
          this.renderer.getPopupRenderer().showTextPopup(
            effect.content.body,
            effect.content.title
          );
        }
        break;
      case 'close_popup':
        this.renderer.getPopupRenderer().dismiss();
        break;
      case 'animation':
        this.playAnimation(effect.target, effect.animation);
        break;
      case 'unlock_case':
        // Handled via save state update
        if (this.definition.settings.debug) {
          console.log('[GIEngine] Case unlocked:', effect.caseId);
        }
        break;
      case 'play_bgm':
        this.audioManager.playBgm(effect.assetRef, effect.fadeDuration ?? 1.0);
        break;
      case 'stop_bgm':
        this.audioManager.stopBgm(effect.fadeDuration ?? 0.5);
        break;
      case 'word_collected_in_popup':
        this.renderer.handleWordCollectedInPopup(effect.wordId, this.definition);
        break;
      case 'toggle_layer': {
        const gs = this.gameState;
        if (gs.type !== 'exploring' && gs.type !== 'thinking') break;
        const caseState = this.saveState.caseStates[gs.caseId];
        if (!caseState) break;
        const current = caseState.layerVisibility[effect.layerId] ?? false;
        const newVisible = effect.visible ?? !current;
        this.saveState = {
          ...this.saveState,
          caseStates: {
            ...this.saveState.caseStates,
            [gs.caseId]: {
              ...caseState,
              layerVisibility: {
                ...caseState.layerVisibility,
                [effect.layerId]: newVisible,
              },
            },
          },
        };
        this.render();
        break;
      }
      case 'delay':
        // v0.1: delay type is supported in ActionSequence; runtime defers
        // subsequent scheduled effects via setTimeout when processing onEnter.
        // No synchronous action needed here — see scheduleDelayedEffects().
        break;
    }
  }

  /**
   * 지연이 포함된 효과 목록을 순서대로 실행.
   * delay SideEffect가 있으면 이후 효과들을 해당 시간(ms) 후에 처리.
   */
  scheduleDelayedEffects(effects: SideEffect[]): void {
    let accumulated = 0;
    for (const effect of effects) {
      if (effect.type === 'delay') {
        accumulated += effect.duration;
      } else {
        const delay = accumulated;
        const eff = effect;
        if (delay > 0) {
          setTimeout(() => this.executeSideEffect(eff), delay);
        } else {
          this.executeSideEffect(eff);
        }
      }
    }
  }

  private playAnimation(target: string, animation: string): void {
    const el = this.scalerEl.querySelector<HTMLElement>(`[data-layer-id="${target}"]`);
    if (!el) return;

    el.style.animation = animation;
    el.addEventListener('animationend', () => {
      el.style.animation = '';
    }, { once: true });
  }

  private notifyListeners(event: GameEvent): void {
    // Notify specific event type listeners
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(event); } catch (e) {
          console.warn('[GIEngine] Listener error:', e);
        }
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.eventListeners.get('*');
    if (wildcardListeners) {
      for (const cb of wildcardListeners) {
        try { cb(event); } catch (e) {
          console.warn('[GIEngine] Listener error:', e);
        }
      }
    }
  }

  private async loadAssets(): Promise<void> {
    // Preload images
    const imageAssets = Object.values(this.definition.assets.items)
      .filter(a => a.type === 'image' && a.src && !a.inline);

    const total = imageAssets.length || 1;
    let loaded = 0;

    this.gameState = { type: 'loading', progress: 0 };
    this.render();

    const loadPromises = imageAssets.map(asset => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          loaded++;
          this.gameState = { type: 'loading', progress: loaded / total };
          this.render();
          resolve();
        };
        img.onerror = () => {
          loaded++;
          this.gameState = { type: 'loading', progress: loaded / total };
          this.render();
          resolve(); // Don't fail on missing assets
        };
        img.src = asset.src;
      });
    });

    await Promise.all(loadPromises);
  }

  private setupResponsiveScaling(): void {
    const updateScale = () => {
      const containerWidth = this.container.clientWidth;
      const containerHeight = this.container.clientHeight;

      if (containerWidth === 0 || containerHeight === 0) return;

      const scaleX = containerWidth / this.designWidth;
      const scaleY = containerHeight / this.designHeight;
      const scale = Math.min(scaleX, scaleY);

      this.scalerEl.style.transform = `scale(${scale})`;

      // Center the scaler
      const scaledWidth = this.designWidth * scale;
      const scaledHeight = this.designHeight * scale;
      const offsetX = (containerWidth - scaledWidth) / 2;
      const offsetY = (containerHeight - scaledHeight) / 2;
      this.scalerEl.style.marginLeft = `${offsetX}px`;
      this.scalerEl.style.marginTop = `${offsetY}px`;
    };

    // Initial scale
    updateScale();

    // Watch for container resize
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(updateScale);
      this.resizeObserver.observe(this.container);
    } else {
      // Fallback to window resize — store reference for cleanup in destroy()
      this.resizeFallbackHandler = updateScale;
      window.addEventListener('resize', updateScale);
    }
  }
}
