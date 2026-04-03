/**
 * Unit tests for SceneRenderer — scrollable / panning behaviour
 *
 * Covers:
 *  - Non-scrollable scene: renders gi-scene directly in container (no viewport wrapper)
 *  - Scrollable scene: wraps scene in gi-scene-viewport, scene gets gi-scene--scrollable
 *  - destroy() cleans up the viewport element
 *  - updateLayerVisibility() works in both scrollable and non-scrollable modes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { I18nManager } from '@gi-engine/core';
import type { Scene, CaseState } from '@gi-engine/core';
import { SceneRenderer } from '../src/renderer/scene-renderer.js';

// ── helpers ────────────────────────────────────────────────────────

function makeI18n(): I18nManager {
  return new I18nManager('ko');
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    name: { ko: '테스트 씬', en: 'Test Scene' },
    background: '',
    dimensions: { width: 1920, height: 1080 },
    hotspots: [],
    layers: [],
    ...overrides,
  };
}

function makeCaseState(): CaseState {
  return {
    status: 'unlocked',
    collectedWordIds: [],
    puzzleStates: {},
    visitedSceneIds: [],
    layerVisibility: {},
  };
}

function makeRenderer(container: HTMLElement): SceneRenderer {
  return new SceneRenderer({
    container,
    i18n: makeI18n(),
    assets: { items: {} },
    onHotspotClick: () => {},
  });
}

// ── tests ──────────────────────────────────────────────────────────

describe('SceneRenderer — non-scrollable (default)', () => {
  let container: HTMLElement;
  let renderer: SceneRenderer;

  beforeEach(() => {
    container = makeContainer();
    renderer = makeRenderer(container);
  });

  it('renders gi-scene directly without a viewport wrapper', () => {
    renderer.render(makeScene(), makeCaseState());
    expect(container.querySelector('.gi-scene-viewport')).toBeNull();
    expect(container.querySelector('.gi-scene')).not.toBeNull();
  });

  it('gi-scene is wrapped in gi-scene-zoom-wrapper for non-scrollable scene', () => {
    renderer.render(makeScene(), makeCaseState());
    const sceneEl = container.querySelector('.gi-scene');
    const zoomWrapper = container.querySelector('.gi-scene-zoom-wrapper');
    expect(sceneEl!.parentElement).toBe(zoomWrapper);
    expect(zoomWrapper!.parentElement).toBe(container);
  });

  it('destroy() removes the gi-scene element', () => {
    renderer.render(makeScene(), makeCaseState());
    renderer.destroy();
    expect(container.querySelector('.gi-scene')).toBeNull();
  });
});

describe('SceneRenderer — scrollable: true', () => {
  let container: HTMLElement;
  let renderer: SceneRenderer;

  beforeEach(() => {
    container = makeContainer();
    renderer = makeRenderer(container);
  });

  it('wraps scene in gi-scene-viewport when scrollable is true', () => {
    renderer.render(makeScene({ scrollable: true }), makeCaseState());
    const viewport = container.querySelector('.gi-scene-viewport');
    expect(viewport).not.toBeNull();
    const scene = container.querySelector('.gi-scene');
    expect(scene).not.toBeNull();
    expect(scene!.parentElement).toBe(viewport);
  });

  it('gi-scene has gi-scene--scrollable class when scrollable', () => {
    renderer.render(makeScene({ scrollable: true }), makeCaseState());
    const scene = container.querySelector('.gi-scene');
    expect(scene!.classList.contains('gi-scene--scrollable')).toBe(true);
  });

  it('gi-scene is sized to scene dimensions in pixels', () => {
    renderer.render(makeScene({ scrollable: true, dimensions: { width: 2560, height: 1440 } }), makeCaseState());
    const scene = container.querySelector<HTMLElement>('.gi-scene');
    expect(scene!.style.width).toBe('2560px');
    expect(scene!.style.height).toBe('1440px');
  });

  it('gi-scene-viewport is a direct child of container', () => {
    renderer.render(makeScene({ scrollable: true }), makeCaseState());
    const viewport = container.querySelector('.gi-scene-viewport');
    expect(viewport!.parentElement).toBe(container);
  });

  it('destroy() removes the viewport (not just the scene)', () => {
    renderer.render(makeScene({ scrollable: true }), makeCaseState());
    renderer.destroy();
    expect(container.querySelector('.gi-scene-viewport')).toBeNull();
    expect(container.querySelector('.gi-scene')).toBeNull();
  });
});

describe('SceneRenderer — layer visibility across modes', () => {
  let container: HTMLElement;
  let renderer: SceneRenderer;

  beforeEach(() => {
    container = makeContainer();
    renderer = makeRenderer(container);
  });

  it('updateLayerVisibility works with non-scrollable scene', () => {
    const scene = makeScene({
      layers: [
        { id: 'layer-1', image: '', position: { x: 0, y: 0 }, zIndex: 1, visible: true },
      ],
    });
    renderer.render(scene, makeCaseState());

    // Hide layer-1
    renderer.updateLayerVisibility({
      ...makeCaseState(),
      layerVisibility: { 'layer-1': false },
    });

    const layerEl = container.querySelector<HTMLElement>('[data-layer-id="layer-1"]');
    expect(layerEl!.classList.contains('gi-layer--hidden')).toBe(true);
  });

  it('updateLayerVisibility works with scrollable scene', () => {
    const scene = makeScene({
      scrollable: true,
      layers: [
        { id: 'layer-2', image: '', position: { x: 0, y: 0 }, zIndex: 1, visible: false },
      ],
    });
    renderer.render(scene, makeCaseState());

    // Show layer-2
    renderer.updateLayerVisibility({
      ...makeCaseState(),
      layerVisibility: { 'layer-2': true },
    });

    const layerEl = container.querySelector<HTMLElement>('[data-layer-id="layer-2"]');
    expect(layerEl!.classList.contains('gi-layer--hidden')).toBe(false);
  });
});

describe('SceneRenderer — re-render & transition', () => {
  let container: HTMLElement;
  let renderer: SceneRenderer;

  beforeEach(() => {
    container = makeContainer();
    renderer = makeRenderer(container);
  });

  it('second render replaces the first scene', () => {
    renderer.render(makeScene({ id: 'scene-1' }), makeCaseState());
    renderer.render(makeScene({ id: 'scene-2' }), makeCaseState());
    const scenes = container.querySelectorAll('.gi-scene');
    expect(scenes.length).toBe(1);
  });

  it('switching from scrollable to non-scrollable removes viewport', () => {
    renderer.render(makeScene({ scrollable: true }), makeCaseState());
    expect(container.querySelector('.gi-scene-viewport')).not.toBeNull();

    renderer.render(makeScene({ scrollable: false }), makeCaseState());
    expect(container.querySelector('.gi-scene-viewport')).toBeNull();
  });
});
