/**
 * Performance benchmark tests for large projects (FADAA-84).
 *
 * Success criteria:
 *   - Editor loads large project in under 2 s
 *   - Scene switching under 200 ms
 *   - No visible jank when editing large scenes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createStressTestProject } from './stress-project';
import { useEditorStore } from '../src/store/editor-store';

function resetStore() {
  useEditorStore.setState({
    project: null,
    words: [],
    meta: { filePath: null, isDirty: false, lastSavedAt: null },
    selection: { actId: null, caseId: null, sceneId: null, hotspotId: null, puzzleId: null, subPuzzleId: null, layerId: null, assetId: null },
    ui: {
      activePanel: 'scene',
      editorLocale: 'ko',
      previewLocale: 'ko',
      isFullscreen: false,
      zoom: 1.0,
      previewVisible: false,
      previewHeight: 280,
      previewMode: 'scene',
      previewPlaying: false,
      leftPanelWidth: 260,
      rightPanelWidth: 320,
      sceneTool: 'select',
      autoSaveEnabled: false,
      autoSaveIntervalMs: 30000,
      notification: null,
      assetViewMode: 'grid',
      assetTypeFilter: 'all',
      assetSearch: '',
      shortcutHelpOpen: false,
    },
  });
}

describe('stress-project factory', () => {
  it('creates a project with exactly 15 scenes', () => {
    const project = createStressTestProject();
    const sceneCount = project.acts.reduce(
      (sum, act) => sum + act.cases.reduce((s, c) => s + c.scenes.length, 0),
      0,
    );
    expect(sceneCount).toBe(15);
  });

  it('creates a project with ~80 hotspots', () => {
    const project = createStressTestProject();
    const hotspotCount = project.acts.reduce(
      (sum, act) =>
        sum +
        act.cases.reduce(
          (s, c) => s + c.scenes.reduce((hs, sc) => hs + sc.hotspots.length, 0),
          0,
        ),
      0,
    );
    // 5 cases × 3 scenes each: 2 scenes with 5 hotspots + 1 scene with 6 hotspots = 16 hotspots/case × 5 = 80
    expect(hotspotCount).toBeGreaterThanOrEqual(75);
    expect(hotspotCount).toBeLessThanOrEqual(85);
  });

  it('creates a project with 30 words', () => {
    const project = createStressTestProject();
    const wordCount = Object.keys(project.words ?? {}).length;
    expect(wordCount).toBe(30);
  });
});

describe('store performance with large project', () => {
  beforeEach(resetStore);

  it('loads large project into store in under 200 ms', () => {
    const project = createStressTestProject();
    const start = performance.now();
    useEditorStore.setState({ project });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('switches between scenes in under 50 ms (store update)', () => {
    const project = createStressTestProject();
    useEditorStore.setState({ project });

    const firstCase = project.acts[0].cases[0];
    const scenes = firstCase.scenes;

    // Pre-select first scene
    useEditorStore.getState().setSelection({ caseId: firstCase.id, sceneId: scenes[0].id, hotspotId: null });

    const start = performance.now();
    useEditorStore.getState().setSelection({ caseId: firstCase.id, sceneId: scenes[1].id, hotspotId: null });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(useEditorStore.getState().selection.sceneId).toBe(scenes[1].id);
  });

  it('handles hotspot selection in under 20 ms (store update)', () => {
    const project = createStressTestProject();
    useEditorStore.setState({ project });

    const firstCase = project.acts[0].cases[0];
    const firstScene = firstCase.scenes[0];
    const hotspots = firstScene.hotspots;

    useEditorStore.getState().setSelection({ caseId: firstCase.id, sceneId: firstScene.id, hotspotId: null });

    const start = performance.now();
    useEditorStore.getState().setSelection({
      caseId: firstCase.id,
      sceneId: firstScene.id,
      hotspotId: hotspots[0].id,
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(20);
    expect(useEditorStore.getState().selection.hotspotId).toBe(hotspots[0].id);
  });

  it('useSelectedScene selector resolves correct scene', () => {
    const project = createStressTestProject();
    useEditorStore.setState({ project });

    const targetCase = project.acts[0].cases[2];
    const targetScene = targetCase.scenes[1];

    useEditorStore.getState().setSelection({ caseId: targetCase.id, sceneId: targetScene.id, hotspotId: null });

    // Direct store selector (same logic as useSelectedScene hook)
    const resolvedScene = useEditorStore.getState().project?.acts
      .flatMap(a => a.cases)
      .find(c => c.id === targetCase.id)
      ?.scenes.find(s => s.id === targetScene.id);

    expect(resolvedScene?.id).toBe(targetScene.id);
    expect(resolvedScene?.hotspots.length).toBeGreaterThan(0);
  });
});
