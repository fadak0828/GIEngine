import type {
  Scene,
  Hotspot,
  HotspotArea,
  SceneLayer,
  CaseState,
  GameDefinition,
  AssetManifest,
  VisibilityCondition,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface SceneRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  onHotspotClick: (hotspotId: string) => void;
}

export class SceneRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private onHotspotClick: (hotspotId: string) => void;
  /** The scene content element (background + layers + hotspots). */
  private sceneEl: HTMLElement | null = null;
  /**
   * When scrollable, a viewport wrapper div that clips the scene content
   * and receives the drag/pan pointer events.
   */
  private viewportEl: HTMLElement | null = null;
  private currentScene: Scene | null = null;
  /** Current pan offset in pixels (only used in scrollable mode). */
  private panOffset = { x: 0, y: 0 };
  /** Cleanup function for pan pointer-event listeners. */
  private panHandlerCleanup: (() => void) | null = null;
  /**
   * Set to true during a drag-pan gesture so that the subsequent click
   * event on a hotspot button is suppressed.
   */
  private didPanDrag = false;

  // Zoom state (for non-scrollable scenes)
  private zoom = 1;
  private zoomPanX = 0;
  private zoomPanY = 0;
  private zoomWrapperEl: HTMLElement | null = null;
  private zoomIndicatorEl: HTMLElement | null = null;
  private zoomIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: SceneRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.onHotspotClick = opts.onHotspotClick;
  }

  render(scene: Scene, caseState: CaseState): void {
    this.destroy();
    this.currentScene = scene;

    // Reset zoom state
    this.zoom = 1;
    this.zoomPanX = 0;
    this.zoomPanY = 0;

    const el = document.createElement('div');
    el.className = 'gi-scene';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', this.i18n.resolveText(scene.name));

    this.buildSceneContent(el, scene, caseState);
    this.sceneEl = el;

    if (scene.scrollable) {
      // Panning mode: fixed-size scene content inside a clipping viewport.
      el.style.position = 'absolute';
      el.style.width = `${scene.dimensions.width}px`;
      el.style.height = `${scene.dimensions.height}px`;
      el.style.transform = 'translate(0px, 0px)';
      el.classList.add('gi-scene--scrollable');

      const viewport = document.createElement('div');
      viewport.className = 'gi-scene-viewport';
      viewport.appendChild(el);
      this.viewportEl = viewport;
      this.container.appendChild(viewport);
      this.setupPanHandlers(viewport, el, scene);
    } else {
      // Zoom mode for non-scrollable scenes
      const zoomWrapper = document.createElement('div');
      zoomWrapper.className = 'gi-scene-zoom-wrapper';
      this.zoomWrapperEl = zoomWrapper;
      zoomWrapper.style.position = 'relative';
      zoomWrapper.style.overflow = 'hidden';
      zoomWrapper.style.cursor = 'zoom-in';

      // Zoom indicator
      this.zoomIndicatorEl = document.createElement('div');
      this.zoomIndicatorEl.className = 'gi-scene-zoom-indicator';
      this.zoomIndicatorEl.style.cssText = [
        'position:absolute',
        'bottom:8px',
        'right:8px',
        'background:rgba(0,0,0,0.55)',
        'color:#fff',
        'font-size:11px',
        'padding:2px 6px',
        'border-radius:3px',
        'pointer-events:none',
        'opacity:0',
        'transition:opacity 0.2s',
        'z-index:10',
      ].join(';');
      zoomWrapper.appendChild(this.zoomIndicatorEl);

      zoomWrapper.appendChild(el);
      this.container.appendChild(zoomWrapper);
      this.setupZoomHandlers(zoomWrapper, el, scene);
      // 초기 transform 명시적 적용
      el.style.transform = `translate(0px, 0px) scale(1)`;
      el.style.transformOrigin = '0 0';
    }
  }

  /**
   * 줌 상태를 1x 배율과 (0,0) 패닝으로 강제 초기화합니다.
   * 씬 전환 시 호출하여 이전 씬의 줌/팬 상태가 유출되지 않도록 합니다.
   */
  resetZoomState(): void {
    this.zoom = 1;
    this.zoomPanX = 0;
    this.zoomPanY = 0;
    if (this.sceneEl && this.zoomWrapperEl) {
      this.sceneEl.style.transform = `translate(0px, 0px) scale(1)`;
      this.sceneEl.style.transformOrigin = '0 0';
      this.zoomWrapperEl.style.cursor = 'zoom-in';
    }
  }

  private showZoomIndicator(): void {
    if (!this.zoomIndicatorEl) return;
    this.zoomIndicatorEl.textContent = `${Math.round(this.zoom * 100)}%`;
    this.zoomIndicatorEl.style.opacity = '1';
    if (this.zoomIndicatorTimer) clearTimeout(this.zoomIndicatorTimer);
    this.zoomIndicatorTimer = setTimeout(() => {
      if (this.zoomIndicatorEl) this.zoomIndicatorEl.style.opacity = '0';
    }, 1200);
  }

  private setupZoomHandlers(zoomWrapper: HTMLElement, sceneContent: HTMLElement, scene: Scene): void {
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 2.5;

    const applyZoomTransform = () => {
      sceneContent.style.transform = `translate(${this.zoomPanX}px, ${this.zoomPanY}px) scale(${this.zoom})`;
      sceneContent.style.transformOrigin = '0 0';
      zoomWrapper.style.cursor = this.zoom > 1 ? 'grab' : 'zoom-in';
    };

    const clampZoomPan = () => {
      const wrapperW = zoomWrapper.clientWidth;
      const wrapperH = zoomWrapper.clientHeight;
      const scaledW = wrapperW * this.zoom;
      const scaledH = wrapperH * this.zoom;
      const maxPanX = 0;
      const minPanX = Math.min(0, wrapperW - scaledW);
      const maxPanY = 0;
      const minPanY = Math.min(0, wrapperH - scaledH);
      this.zoomPanX = Math.max(minPanX, Math.min(maxPanX, this.zoomPanX));
      this.zoomPanY = Math.max(minPanY, Math.min(maxPanY, this.zoomPanY));
    };

    // Wheel: zoom around cursor position
    zoomWrapper.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = zoomWrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      const prevZoom = this.zoom;
      this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom + delta));

      if (this.zoom !== prevZoom) {
        const ratio = this.zoom / prevZoom;
        this.zoomPanX = mouseX - ratio * (mouseX - this.zoomPanX);
        this.zoomPanY = mouseY - ratio * (mouseY - this.zoomPanY);
        clampZoomPan();
        applyZoomTransform();
        this.showZoomIndicator();
      }
    }, { passive: false });

    // Double-click: reset to 1x
    zoomWrapper.addEventListener('dblclick', () => {
      this.zoom = 1;
      this.zoomPanX = 0;
      this.zoomPanY = 0;
      applyZoomTransform();
      this.showZoomIndicator();
    });

    // Drag panning when zoomed
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panStartX = 0;
    let panStartY = 0;

    zoomWrapper.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.zoom <= 1) return;
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panStartX = this.zoomPanX;
      panStartY = this.zoomPanY;
      zoomWrapper.setPointerCapture(e.pointerId);
      zoomWrapper.style.cursor = 'grabbing';
    });

    zoomWrapper.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isDragging) return;
      this.zoomPanX = panStartX + (e.clientX - dragStartX);
      this.zoomPanY = panStartY + (e.clientY - dragStartY);
      clampZoomPan();
      applyZoomTransform();
    });

    const stopDrag = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      zoomWrapper.style.cursor = this.zoom > 1 ? 'grab' : 'zoom-in';
    };

    zoomWrapper.addEventListener('pointerup', stopDrag);
    zoomWrapper.addEventListener('pointercancel', stopDrag);
  }

  applyTransition(type: 'fade' | 'slide_left' | 'slide_right' | 'instant' | 'dissolve' | 'wipe_left' | 'wipe_right'): void {
    if (!this.sceneEl || type === 'instant') return;
    const cls = `gi-scene--${type.replace('_', '-')}-enter`;
    this.sceneEl.classList.add(cls);
    this.sceneEl.addEventListener('animationend', () => {
      this.sceneEl?.classList.remove(cls);
    }, { once: true });
  }

  destroy(): void {
    if (this.panHandlerCleanup) {
      this.panHandlerCleanup();
      this.panHandlerCleanup = null;
    }
    if (this.zoomWrapperEl) {
      this.zoomWrapperEl.remove();
      this.zoomWrapperEl = null;
    }
    if (this.viewportEl) {
      this.viewportEl.remove();
      this.viewportEl = null;
    }
    if (this.sceneEl) {
      this.sceneEl.remove();
      this.sceneEl = null;
    }
    this.currentScene = null;
    this.panOffset = { x: 0, y: 0 };
    this.didPanDrag = false;
    // Remove any orphaned gi-scene-zoom-wrapper elements left in the container
    const orphanWrappers = this.container.querySelectorAll('.gi-scene-zoom-wrapper');
    for (const wrapper of orphanWrappers) {
      wrapper.remove();
    }
    const orphanViewports = this.container.querySelectorAll('.gi-scene-viewport');
    for (const viewport of orphanViewports) {
      viewport.remove();
    }
    const orphanScenes = this.container.querySelectorAll('.gi-scene');
    for (const scene of orphanScenes) {
      scene.remove();
    }
  }

  updateLayerVisibility(caseState: CaseState): void {
    if (!this.sceneEl || !this.currentScene) return;
    const layers = this.sceneEl.querySelectorAll<HTMLElement>('[data-layer-id]');
    for (const layerEl of layers) {
      const layerId = layerEl.dataset.layerId!;
      const layer = this.currentScene.layers.find(l => l.id === layerId);
      if (!layer) continue;
      const visible = caseState.layerVisibility[layerId] ?? layer.visible;
      layerEl.classList.toggle('gi-layer--hidden', !visible);
    }
  }

  // ── private: scene content ──────────────────────────────────────

  private buildSceneContent(el: HTMLElement, scene: Scene, caseState: CaseState): void {
    // Background image
    const bgSrc = this.resolveAssetSrc(scene.background);
    if (bgSrc) {
      const bg = document.createElement('img');
      bg.className = 'gi-scene-bg';
      bg.src = bgSrc;
      bg.alt = '';
      bg.draggable = false;
      el.appendChild(bg);
    }

    // Layers
    for (const layer of scene.layers) {
      const layerEl = this.createLayer(layer, caseState);
      el.appendChild(layerEl);
    }

    // Hotspots
    for (const hotspot of scene.hotspots) {
      if (hotspot.condition && !this.evaluateCondition(hotspot.condition, caseState)) {
        continue;
      }
      const hsEl = this.createHotspot(hotspot, scene, caseState);
      el.appendChild(hsEl);
    }
  }

  // ── private: panning ────────────────────────────────────────────

  private setupPanHandlers(
    viewport: HTMLElement,
    content: HTMLElement,
    scene: Scene
  ): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startOffsetX = 0;
    let startOffsetY = 0;

    const onPointerDown = (e: PointerEvent) => {
      // Let hotspot buttons handle their own events.
      if ((e.target as HTMLElement).closest('.gi-hotspot')) return;
      isDragging = true;
      this.didPanDrag = false;
      startX = e.clientX;
      startY = e.clientY;
      startOffsetX = this.panOffset.x;
      startOffsetY = this.panOffset.y;
      viewport.setPointerCapture(e.pointerId);
      viewport.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.didPanDrag = true;
      }

      // Clamp so the scene content never scrolls outside its bounds.
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const sw = scene.dimensions.width;
      const sh = scene.dimensions.height;
      const minX = Math.min(0, vw - sw);
      const minY = Math.min(0, vh - sh);

      const newX = Math.max(minX, Math.min(0, startOffsetX + dx));
      const newY = Math.max(minY, Math.min(0, startOffsetY + dy));
      this.panOffset = { x: newX, y: newY };
      content.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const onPointerUp = (_e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      viewport.releasePointerCapture(_e.pointerId);
      viewport.style.cursor = 'grab';
    };

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.style.cursor = 'grab';
    viewport.style.overflow = 'hidden';

    this.panHandlerCleanup = () => {
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
    };
  }

  // ── private: layer / hotspot creation ───────────────────────────

  private createLayer(layer: SceneLayer, caseState: CaseState): HTMLElement {
    const el = document.createElement('div');
    el.className = 'gi-layer';
    el.dataset.layerId = layer.id;
    el.style.left = `${layer.position.x}px`;
    el.style.top = `${layer.position.y}px`;
    el.style.zIndex = String(layer.zIndex);

    const visible = caseState.layerVisibility[layer.id] ?? layer.visible;
    if (!visible) {
      el.classList.add('gi-layer--hidden');
    }

    const src = this.resolveAssetSrc(layer.image);
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
    }

    return el;
  }

  private createHotspot(hotspot: Hotspot, scene: Scene, caseState: CaseState): HTMLElement {
    const el = document.createElement('button');
    el.className = 'gi-hotspot';
    if (caseState.visitedHotspotIds.includes(hotspot.id)) {
      el.classList.add('gi-hotspot--visited');
    }
    el.dataset.hotspotId = hotspot.id;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', this.i18n.resolveText(hotspot.ariaLabel));
    el.style.cursor = hotspot.cursor || 'pointer';
    el.tabIndex = 0;

    this.applyHotspotArea(el, hotspot.area, scene.dimensions);

    el.addEventListener('click', (e) => {
      // Suppress click if the user was dragging the scene (pan gesture).
      if (this.didPanDrag) {
        this.didPanDrag = false;
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      this.onHotspotClick(hotspot.id);
    });

    return el;
  }

  private applyHotspotArea(
    el: HTMLElement,
    area: HotspotArea,
    sceneDims: { width: number; height: number }
  ): void {
    const w = sceneDims.width;
    const h = sceneDims.height;

    switch (area.type) {
      case 'rect': {
        el.style.left = `${(area.x / w) * 100}%`;
        el.style.top = `${(area.y / h) * 100}%`;
        el.style.width = `${(area.width / w) * 100}%`;
        el.style.height = `${(area.height / h) * 100}%`;
        break;
      }
      case 'circle': {
        const diameter = area.radius * 2;
        el.style.left = `${((area.cx - area.radius) / w) * 100}%`;
        el.style.top = `${((area.cy - area.radius) / h) * 100}%`;
        el.style.width = `${(diameter / w) * 100}%`;
        el.style.height = `${(diameter / h) * 100}%`;
        el.style.borderRadius = '50%';
        el.style.clipPath = 'circle(50%)';
        break;
      }
      case 'polygon': {
        // Compute bounding box of polygon
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [px, py] of area.points) {
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
        el.style.left = `${(minX / w) * 100}%`;
        el.style.top = `${(minY / h) * 100}%`;
        el.style.width = `${((maxX - minX) / w) * 100}%`;
        el.style.height = `${((maxY - minY) / h) * 100}%`;

        // Build clip-path polygon relative to bounding box
        const bw = maxX - minX || 1;
        const bh = maxY - minY || 1;
        const points = area.points
          .map(([px, py]) => `${((px - minX) / bw) * 100}% ${((py - minY) / bh) * 100}%`)
          .join(', ');
        el.style.clipPath = `polygon(${points})`;
        break;
      }
    }
  }

  private evaluateCondition(cond: VisibilityCondition, cs: CaseState): boolean {
    switch (cond.type) {
      case 'layer_visible':
        return cs.layerVisibility[cond.layerId] === true;
      case 'word_collected':
        return cs.collectedWordIds.includes(cond.wordId);
      case 'puzzle_solved':
        return cs.puzzleStates[cond.puzzleId]?.solved === true;
      case 'and':
        return cond.conditions.every(c => this.evaluateCondition(c, cs));
      case 'or':
        return cond.conditions.some(c => this.evaluateCondition(c, cs));
      case 'not':
        return !this.evaluateCondition(cond.condition, cs);
      default:
        return true;
    }
  }

  private resolveAssetSrc(ref: string): string {
    const asset = this.assets.items[ref];
    if (!asset) return ref; // fallback: treat ref as direct URL
    if (asset.inline) {
      // If inline is already a full data URI, use it directly
      if (asset.inline.startsWith('data:')) return asset.inline;
      // Otherwise, reconstruct data URI from raw base64 + mimeType
      const mime = asset.mimeType || 'application/octet-stream';
      return `data:${mime};base64,${asset.inline}`;
    }
    return asset.src;
  }
}
