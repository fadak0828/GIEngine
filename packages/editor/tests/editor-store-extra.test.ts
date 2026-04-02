import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../src/store/editor-store';
import type { HotspotArea } from '@gi-engine/core';

// Reset store before each test
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

// Helper: create a project with one act and one case, returning their IDs
function setupActAndCase() {
  const store = useEditorStore.getState();
  store.newProject();
  store.addAct();
  const actId = useEditorStore.getState().project!.acts[0].id;
  store.addCase(actId);
  const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
  return { actId, caseId };
}

// Helper: create a project with act, case, and hotspot
function setupWithHotspot() {
  const { actId, caseId } = setupActAndCase();
  const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
  const area: HotspotArea = { type: 'rect', x: 0, y: 0, width: 100, height: 100 };
  useEditorStore.getState().addHotspot(caseId, sceneId, area);
  const hotspotId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].id;
  return { actId, caseId, sceneId, hotspotId };
}

describe('EditorStore — additional coverage', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── updateGameMeta ──────────────────────────────────────────────

  describe('updateGameMeta', () => {
    it('updates game title', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.updateGameMeta({ title: { ko: '수정 제목', en: 'Updated Title' } });
      expect(useEditorStore.getState().project!.title.ko).toBe('수정 제목');
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('updates game version', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.updateGameMeta({ version: '2.0.0' });
      expect(useEditorStore.getState().project!.version).toBe('2.0.0');
    });

    it('does nothing if no project', () => {
      const store = useEditorStore.getState();
      store.updateGameMeta({ version: '9.9.9' });
      expect(useEditorStore.getState().project).toBeNull();
    });
  });

  // ── updateSettings ──────────────────────────────────────────────

  describe('updateSettings', () => {
    it('updates debug setting', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.updateSettings({ debug: true });
      expect(useEditorStore.getState().project!.settings.debug).toBe(true);
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('updates validationFeedbackDuration', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.updateSettings({ validationFeedbackDuration: 3000 });
      expect(useEditorStore.getState().project!.settings.validationFeedbackDuration).toBe(3000);
    });

    it('does nothing if no project', () => {
      const store = useEditorStore.getState();
      store.updateSettings({ debug: true });
      expect(useEditorStore.getState().project).toBeNull();
    });
  });

  // ── updateCase ──────────────────────────────────────────────────

  describe('updateCase', () => {
    it('updates case title', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().updateCase(caseId, { title: { ko: '수정된 사건', en: 'Updated Case' } });
      const c = useEditorStore.getState().project!.acts[0].cases[0];
      expect(c.title.ko).toBe('수정된 사건');
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('updates case thumbnail', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().updateCase(caseId, { thumbnail: 'thumb.png' });
      expect(useEditorStore.getState().project!.acts[0].cases[0].thumbnail).toBe('thumb.png');
    });

    it('does nothing for unknown case id', () => {
      const { } = setupActAndCase();
      const before = JSON.stringify(useEditorStore.getState().project);
      useEditorStore.getState().updateCase('nonexistent', { thumbnail: 'x.png' });
      // Acts structure unchanged
      expect(useEditorStore.getState().project!.acts[0].cases[0].thumbnail).toBe('');
    });
  });

  // ── reorderCases ────────────────────────────────────────────────

  describe('reorderCases', () => {
    it('reorders cases within an act', () => {
      const { actId } = setupActAndCase();
      useEditorStore.getState().addCase(actId);
      useEditorStore.getState().addCase(actId);
      const cases = useEditorStore.getState().project!.acts[0].cases;
      const firstId = cases[0].id;
      useEditorStore.getState().reorderCases(actId, 0, 2);
      const reordered = useEditorStore.getState().project!.acts[0].cases;
      expect(reordered[2].id).toBe(firstId);
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('does nothing for unknown act id', () => {
      setupActAndCase();
      const beforeCount = useEditorStore.getState().project!.acts[0].cases.length;
      useEditorStore.getState().reorderCases('nonexistent-act', 0, 1);
      expect(useEditorStore.getState().project!.acts[0].cases).toHaveLength(beforeCount);
    });
  });

  // ── updateScene ─────────────────────────────────────────────────

  describe('updateScene', () => {
    it('updates scene name', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().updateScene(caseId, sceneId, { name: { ko: '수정 씬', en: 'Updated Scene' } });
      const scene = useEditorStore.getState().project!.acts[0].cases[0].scenes[0];
      expect(scene.name.ko).toBe('수정 씬');
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('updates scene background', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().updateScene(caseId, sceneId, { background: 'bg.jpg' });
      expect(useEditorStore.getState().project!.acts[0].cases[0].scenes[0].background).toBe('bg.jpg');
    });

    it('updates scene dimensions', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().updateScene(caseId, sceneId, { dimensions: { width: 1920, height: 1080 } });
      const dims = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].dimensions;
      expect(dims.width).toBe(1920);
      expect(dims.height).toBe(1080);
    });
  });

  // ── reorderScenes ───────────────────────────────────────────────

  describe('reorderScenes', () => {
    it('reorders scenes within a case', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().addScene(caseId);
      useEditorStore.getState().addScene(caseId);
      const scenes = useEditorStore.getState().project!.acts[0].cases[0].scenes;
      const firstId = scenes[0].id;
      useEditorStore.getState().reorderScenes(caseId, 0, 2);
      const reordered = useEditorStore.getState().project!.acts[0].cases[0].scenes;
      expect(reordered[2].id).toBe(firstId);
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });
  });

  // ── updateHotspotAction ─────────────────────────────────────────

  describe('updateHotspotAction', () => {
    it('updates hotspot action type and content', () => {
      const { caseId, sceneId, hotspotId } = setupWithHotspot();
      useEditorStore.getState().updateHotspotAction(caseId, sceneId, hotspotId, {
        type: 'navigate',
        targetSceneId: 'scene2',
      });
      const hotspot = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0];
      expect(hotspot.action.type).toBe('navigate');
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('does nothing for unknown hotspot id', () => {
      const { caseId, sceneId } = setupWithHotspot();
      const beforeAction = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].action.type;
      useEditorStore.getState().updateHotspotAction(caseId, sceneId, 'unknown-hotspot', {
        type: 'navigate',
        targetSceneId: 'x',
      });
      const afterAction = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].action.type;
      expect(afterAction).toBe(beforeAction);
    });
  });

  // ── SceneLayer CRUD ─────────────────────────────────────────────

  describe('addLayer', () => {
    it('adds a layer to a scene', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().addLayer(caseId, sceneId);
      const layers = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers;
      expect(layers).toHaveLength(1);
      expect(layers[0].visible).toBe(true);
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('new layer has default position {x:0, y:0}', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().addLayer(caseId, sceneId);
      const layer = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers[0];
      expect(layer.position).toEqual({ x: 0, y: 0 });
      expect(layer.zIndex).toBe(1);
    });
  });

  describe('updateLayer', () => {
    it('updates layer image and zIndex', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().addLayer(caseId, sceneId);
      const layerId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers[0].id;
      useEditorStore.getState().updateLayer(caseId, sceneId, layerId, { image: 'layer.png', zIndex: 5 });
      const layer = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers[0];
      expect(layer.image).toBe('layer.png');
      expect(layer.zIndex).toBe(5);
    });

    it('toggles layer visibility', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().addLayer(caseId, sceneId);
      const layerId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers[0].id;
      useEditorStore.getState().updateLayer(caseId, sceneId, layerId, { visible: false });
      expect(useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers[0].visible).toBe(false);
    });
  });

  describe('deleteLayer', () => {
    it('removes a layer from the scene', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().addLayer(caseId, sceneId);
      useEditorStore.getState().addLayer(caseId, sceneId);
      const layerId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers[0].id;
      useEditorStore.getState().deleteLayer(caseId, sceneId, layerId);
      expect(useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers).toHaveLength(1);
    });
  });

  // ── Puzzle CRUD ─────────────────────────────────────────────────

  describe('updateMainPuzzle', () => {
    it('updates main puzzle title', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().updateMainPuzzle(caseId, { title: { ko: '수정 퍼즐', en: 'Updated Puzzle' } });
      const puzzle = useEditorStore.getState().project!.acts[0].cases[0].puzzles.main;
      expect(puzzle.title.ko).toBe('수정 퍼즐');
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });
  });

  describe('updatePuzzleTemplate', () => {
    it('replaces the puzzle template', () => {
      const { caseId } = setupActAndCase();
      const newTemplate = { segments: [{ type: 'text' as const, content: { ko: '범인은?', en: '범인은?' } }] };
      useEditorStore.getState().updatePuzzleTemplate(caseId, newTemplate);
      const template = useEditorStore.getState().project!.acts[0].cases[0].puzzles.main.template;
      expect(template.segments).toHaveLength(1);
    });
  });

  describe('updatePuzzleAnswers', () => {
    it('replaces the puzzle answers map', () => {
      const { caseId } = setupActAndCase();
      const answers = { slot1: { correctWordId: 'w1', isCorrect: true } };
      useEditorStore.getState().updatePuzzleAnswers(caseId, answers);
      const stored = useEditorStore.getState().project!.acts[0].cases[0].puzzles.main.answers;
      expect(stored).toEqual(answers);
    });
  });

  describe('addSubPuzzle', () => {
    it('adds a character_id sub-puzzle', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().addSubPuzzle(caseId, 'character_id');
      const sub = useEditorStore.getState().project!.acts[0].cases[0].puzzles.sub;
      expect(sub).toHaveLength(1);
      expect(sub[0].type).toBe('character_id');
    });

    it('adds a timeline sub-puzzle', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().addSubPuzzle(caseId, 'timeline');
      const sub = useEditorStore.getState().project!.acts[0].cases[0].puzzles.sub;
      expect(sub[0].type).toBe('timeline');
    });

    it('adds a scenario sub-puzzle', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().addSubPuzzle(caseId, 'scenario');
      const sub = useEditorStore.getState().project!.acts[0].cases[0].puzzles.sub;
      expect(sub[0].type).toBe('scenario');
    });

    it('adds a relationship sub-puzzle', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().addSubPuzzle(caseId, 'relationship');
      const sub = useEditorStore.getState().project!.acts[0].cases[0].puzzles.sub;
      expect(sub[0].type).toBe('relationship');
    });

    it('marks project dirty', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().setDirty(false);
      useEditorStore.getState().addSubPuzzle(caseId, 'timeline');
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });
  });

  describe('updateSubPuzzle', () => {
    it('updates sub-puzzle title', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().addSubPuzzle(caseId, 'timeline');
      const puzzleId = useEditorStore.getState().project!.acts[0].cases[0].puzzles.sub[0].id;
      useEditorStore.getState().updateSubPuzzle(caseId, puzzleId, { title: { ko: '수정', en: 'Updated' } });
      const sub = useEditorStore.getState().project!.acts[0].cases[0].puzzles.sub[0];
      expect(sub.title.ko).toBe('수정');
    });
  });

  describe('deleteSubPuzzle', () => {
    it('removes a sub-puzzle', () => {
      const { caseId } = setupActAndCase();
      useEditorStore.getState().addSubPuzzle(caseId, 'timeline');
      useEditorStore.getState().addSubPuzzle(caseId, 'character_id');
      const puzzleId = useEditorStore.getState().project!.acts[0].cases[0].puzzles.sub[0].id;
      useEditorStore.getState().deleteSubPuzzle(caseId, puzzleId);
      expect(useEditorStore.getState().project!.acts[0].cases[0].puzzles.sub).toHaveLength(1);
    });
  });

  // ── updateAsset ─────────────────────────────────────────────────

  describe('updateAsset', () => {
    it('updates asset src', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAsset({ id: 'img1', type: 'image', src: 'old.png', mimeType: 'image/png' });
      store.updateAsset('img1', { src: 'new.png' });
      expect(useEditorStore.getState().project!.assets.items['img1'].src).toBe('new.png');
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('does not crash for unknown asset id', () => {
      const store = useEditorStore.getState();
      store.newProject();
      expect(() => store.updateAsset('unknown', { src: 'x.png' })).not.toThrow();
    });
  });

  // ── UI: locale, preview, scene tool ────────────────────────────

  describe('setEditorLocale', () => {
    it('changes editor locale to en', () => {
      useEditorStore.getState().setEditorLocale('en');
      expect(useEditorStore.getState().ui.editorLocale).toBe('en');
    });

    it('changes editor locale back to ko', () => {
      useEditorStore.getState().setEditorLocale('en');
      useEditorStore.getState().setEditorLocale('ko');
      expect(useEditorStore.getState().ui.editorLocale).toBe('ko');
    });
  });

  describe('setPreviewLocale', () => {
    it('changes preview locale', () => {
      useEditorStore.getState().setPreviewLocale('en');
      expect(useEditorStore.getState().ui.previewLocale).toBe('en');
    });
  });

  describe('setFullscreen', () => {
    it('updates fullscreen UI state', () => {
      useEditorStore.getState().setFullscreen(true);
      expect(useEditorStore.getState().ui.isFullscreen).toBe(true);

      useEditorStore.getState().setFullscreen(false);
      expect(useEditorStore.getState().ui.isFullscreen).toBe(false);
    });
  });

  describe('setPreviewVisible', () => {
    it('toggles preview visibility on', () => {
      useEditorStore.getState().setPreviewVisible(true);
      expect(useEditorStore.getState().ui.previewVisible).toBe(true);
    });

    it('toggles preview visibility off', () => {
      useEditorStore.getState().setPreviewVisible(true);
      useEditorStore.getState().setPreviewVisible(false);
      expect(useEditorStore.getState().ui.previewVisible).toBe(false);
    });
  });

  describe('setPreviewHeight', () => {
    it('sets preview height', () => {
      useEditorStore.getState().setPreviewHeight(400);
      expect(useEditorStore.getState().ui.previewHeight).toBe(400);
    });
  });

  describe('setSceneTool', () => {
    it('switches to draw_rect tool', () => {
      useEditorStore.getState().setSceneTool('draw_rect');
      expect(useEditorStore.getState().ui.sceneTool).toBe('draw_rect');
    });

    it('switches to delete tool', () => {
      useEditorStore.getState().setSceneTool('delete');
      expect(useEditorStore.getState().ui.sceneTool).toBe('delete');
    });

    it('switches back to select tool', () => {
      useEditorStore.getState().setSceneTool('draw_rect');
      useEditorStore.getState().setSceneTool('select');
      expect(useEditorStore.getState().ui.sceneTool).toBe('select');
    });
  });

  describe('setPanelWidth — right panel clamping', () => {
    it('clamps right panel width to minimum 240', () => {
      useEditorStore.getState().setPanelWidth('right', 100);
      expect(useEditorStore.getState().ui.rightPanelWidth).toBe(240);
    });

    it('clamps right panel width to maximum 600', () => {
      useEditorStore.getState().setPanelWidth('right', 9999);
      expect(useEditorStore.getState().ui.rightPanelWidth).toBe(600);
    });

    it('clamps left panel width to maximum 500', () => {
      useEditorStore.getState().setPanelWidth('left', 9999);
      expect(useEditorStore.getState().ui.leftPanelWidth).toBe(500);
    });
  });

  // ── loadProject with words ──────────────────────────────────────

  describe('loadProject', () => {
    it('loads words alongside a project definition', () => {
      const store = useEditorStore.getState();
      const def = {
        id: 'game2',
        version: '1.0.0',
        title: { ko: '게임2', en: 'Game2' },
        description: { ko: '', en: '' },
        supportedLocales: ['ko', 'en'] as ('ko' | 'en')[],
        settings: { validationFeedbackDuration: 1500, autoSaveInterval: 30000, debug: false, unlockMode: 'sequential' as const, cssPrefix: 'gi' },
        acts: [],
        assets: { items: {} },
      };
      store.loadProject(def, [{ id: 'w1', display: { ko: '단어', en: 'Word' }, caseId: 'c1' }], 'game2.gi-project');
      expect(useEditorStore.getState().words).toHaveLength(1);
      expect(useEditorStore.getState().meta.filePath).toBe('game2.gi-project');
      expect(useEditorStore.getState().meta.lastSavedAt).not.toBeNull();
    });
  });

  // ── reorderLayers ───────────────────────────────────────────────

  describe('reorderLayers', () => {
    it('moves a layer from index 0 to index 2 (top to bottom)', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      // Add 3 layers (A, B, C) — zIndex assigned as 1, 2, 3
      useEditorStore.getState().addLayer(caseId, sceneId);
      useEditorStore.getState().addLayer(caseId, sceneId);
      useEditorStore.getState().addLayer(caseId, sceneId);
      const before = [...useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers]
        .sort((a, b) => b.zIndex - a.zIndex);
      const topLayerId = before[0].id;
      // Move top layer (index 0) to bottom (index 2)
      useEditorStore.getState().reorderLayers(caseId, sceneId, 0, 2);
      const after = [...useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers]
        .sort((a, b) => b.zIndex - a.zIndex);
      expect(after[2].id).toBe(topLayerId);
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('moves a layer from index 2 to index 0 (bottom to top)', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().addLayer(caseId, sceneId);
      useEditorStore.getState().addLayer(caseId, sceneId);
      useEditorStore.getState().addLayer(caseId, sceneId);
      const before = [...useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers]
        .sort((a, b) => b.zIndex - a.zIndex);
      const bottomLayerId = before[2].id;
      // Move bottom layer (index 2) to top (index 0)
      useEditorStore.getState().reorderLayers(caseId, sceneId, 2, 0);
      const after = [...useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers]
        .sort((a, b) => b.zIndex - a.zIndex);
      expect(after[0].id).toBe(bottomLayerId);
    });

    it('zIndex values are contiguous after reorder', () => {
      const { caseId } = setupActAndCase();
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      useEditorStore.getState().addLayer(caseId, sceneId);
      useEditorStore.getState().addLayer(caseId, sceneId);
      useEditorStore.getState().addLayer(caseId, sceneId);
      useEditorStore.getState().reorderLayers(caseId, sceneId, 0, 2);
      const layers = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].layers;
      const zValues = layers.map(l => l.zIndex).sort((a, b) => a - b);
      expect(zValues).toEqual([1, 2, 3]);
    });
  });

  // ── deleteCase selection clean-up ───────────────────────────────

  describe('deleteCase — selection cleanup', () => {
    it('preserves actId in selection when case is deleted', () => {
      const { actId, caseId } = setupActAndCase();
      useEditorStore.getState().setSelection({ actId, caseId });
      useEditorStore.getState().deleteCase(actId, caseId);
      const sel = useEditorStore.getState().selection;
      expect(sel.caseId).toBeNull();
      expect(sel.actId).toBe(actId);
    });
  });
});
