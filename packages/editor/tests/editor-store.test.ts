import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../src/store/editor-store';
import type { HotspotArea, Word } from '@gi-engine/core';

// Reset store before each test
function resetStore() {
  useEditorStore.setState({
    project: null,
    words: [],
    meta: { filePath: null, isDirty: false, lastSavedAt: null },
    selection: { actId: null, caseId: null, sceneId: null, hotspotId: null, hotspotIds: [], puzzleId: null, subPuzzleId: null, layerId: null, assetId: null },
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
      gridSnapEnabled: true,
      gridSize: 10,
    },
  });
}

describe('EditorStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── Project lifecycle ────────────────────────────────────────────

  describe('newProject', () => {
    it('creates a new project with default GameDefinition', () => {
      const store = useEditorStore.getState();
      store.newProject();
      const state = useEditorStore.getState();
      expect(state.project).not.toBeNull();
      expect(state.project?.acts).toEqual([]);
      expect(state.project?.assets.items).toEqual({});
      expect(state.meta.isDirty).toBe(false);
    });

    it('resets selection when creating new project', () => {
      const store = useEditorStore.getState();
      store.newProject();
      const state = useEditorStore.getState();
      expect(state.selection.actId).toBeNull();
      expect(state.selection.caseId).toBeNull();
    });

    it('creates project with valid required fields', () => {
      const store = useEditorStore.getState();
      store.newProject();
      const state = useEditorStore.getState();
      expect(state.project?.id).toBeTruthy();
      expect(state.project?.version).toBe('1.0.0');
      expect(state.project?.title.ko).toBeTruthy();
      expect(state.project?.settings).toBeDefined();
    });
  });

  describe('loadProject', () => {
    it('loads a project definition', () => {
      const store = useEditorStore.getState();
      const def = {
        id: 'test-game',
        version: '1.0.0',
        title: { ko: '테스트', en: 'Test' },
        description: { ko: '', en: '' },
        supportedLocales: ['ko', 'en'] as ('ko' | 'en')[],
        settings: { validationFeedbackDuration: 1500, autoSaveInterval: 30000, debug: false, unlockMode: 'sequential' as const, cssPrefix: 'gi' },
        acts: [],
        assets: { items: {} },
      };
      store.loadProject(def, [], 'test.gi-project');
      const state = useEditorStore.getState();
      expect(state.project?.id).toBe('test-game');
      expect(state.meta.isDirty).toBe(false);
      expect(state.words).toEqual([]);
    });
  });

  describe('setDirty', () => {
    it('sets the dirty flag', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.setDirty(true);
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
      store.setDirty(false);
      expect(useEditorStore.getState().meta.isDirty).toBe(false);
    });
  });

  // ── Act CRUD ─────────────────────────────────────────────────────

  describe('addAct', () => {
    it('adds an act to the project', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const state = useEditorStore.getState();
      expect(state.project?.acts).toHaveLength(1);
      expect(state.meta.isDirty).toBe(true);
    });

    it('adds multiple acts', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      store.addAct();
      store.addAct();
      expect(useEditorStore.getState().project?.acts).toHaveLength(3);
    });

    it('does nothing if no project', () => {
      const store = useEditorStore.getState();
      expect(store.project).toBeNull();
      store.addAct();
      expect(useEditorStore.getState().project).toBeNull();
    });
  });

  describe('updateAct', () => {
    it('updates act title', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.updateAct(actId, { title: { ko: '수정된 막', en: 'Updated Act' } });
      const act = useEditorStore.getState().project!.acts[0];
      expect(act.title.ko).toBe('수정된 막');
      expect(act.title.en).toBe('Updated Act');
    });

    it('marks project dirty', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.setDirty(false);
      store.updateAct(actId, { title: { ko: '변경', en: 'Changed' } });
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });
  });

  describe('deleteAct', () => {
    it('removes the act from the project', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.deleteAct(actId);
      expect(useEditorStore.getState().project!.acts).toHaveLength(1);
    });

    it('clears selection if deleted act was selected', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.setSelection({ actId });
      store.deleteAct(actId);
      expect(useEditorStore.getState().selection.actId).toBeNull();
    });
  });

  describe('reorderActs', () => {
    it('moves act from index to another', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      store.addAct();
      store.addAct();
      const acts = useEditorStore.getState().project!.acts;
      const firstId = acts[0].id;
      store.reorderActs(0, 2);
      const reordered = useEditorStore.getState().project!.acts;
      expect(reordered[2].id).toBe(firstId);
    });
  });

  // ── Case CRUD ────────────────────────────────────────────────────

  describe('addCase', () => {
    it('adds a case to an act', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const act = useEditorStore.getState().project!.acts[0];
      expect(act.cases).toHaveLength(1);
    });

    it('new case has a default scene', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseData = useEditorStore.getState().project!.acts[0].cases[0];
      expect(caseData.scenes).toHaveLength(1);
    });

    it('new case has a default puzzle set', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseData = useEditorStore.getState().project!.acts[0].cases[0];
      expect(caseData.puzzles.main).toBeDefined();
      expect(caseData.puzzles.sub).toEqual([]);
    });
  });

  describe('deleteCase', () => {
    it('removes a case from its act', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      store.deleteCase(actId, caseId);
      expect(useEditorStore.getState().project!.acts[0].cases).toHaveLength(1);
    });
  });

  // ── Scene CRUD ───────────────────────────────────────────────────

  describe('addScene', () => {
    it('adds a scene to a case', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const initialCount = useEditorStore.getState().project!.acts[0].cases[0].scenes.length;
      store.addScene(caseId);
      expect(useEditorStore.getState().project!.acts[0].cases[0].scenes).toHaveLength(initialCount + 1);
    });
  });

  describe('deleteScene', () => {
    it('removes a scene from a case', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      store.addScene(caseId);
      const scenes = useEditorStore.getState().project!.acts[0].cases[0].scenes;
      expect(scenes).toHaveLength(2);
      const sceneId = scenes[1].id;
      store.deleteScene(caseId, sceneId);
      expect(useEditorStore.getState().project!.acts[0].cases[0].scenes).toHaveLength(1);
    });

    it('clears selected scene from selection', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      store.setSelection({ sceneId });
      store.deleteScene(caseId, sceneId);
      expect(useEditorStore.getState().selection.sceneId).toBeNull();
    });
  });

  // ── Hotspot CRUD ─────────────────────────────────────────────────

  describe('addHotspot', () => {
    it('adds a hotspot to a scene', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;

      const area: HotspotArea = { type: 'rect', x: 100, y: 100, width: 200, height: 150 };
      store.addHotspot(caseId, sceneId, area);

      const scene = useEditorStore.getState().project!.acts[0].cases[0].scenes[0];
      expect(scene.hotspots).toHaveLength(1);
      expect(scene.hotspots[0].area).toEqual(area);
    });

    it('selects the newly created hotspot', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;

      const area: HotspotArea = { type: 'rect', x: 0, y: 0, width: 100, height: 100 };
      store.addHotspot(caseId, sceneId, area);

      const hotspotId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].id;
      expect(useEditorStore.getState().selection.hotspotId).toBe(hotspotId);
    });

    it('has default examine action', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      store.addHotspot(caseId, sceneId, { type: 'rect', x: 0, y: 0, width: 100, height: 100 });
      const hotspot = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0];
      expect(hotspot.action.type).toBe('examine');
    });
  });

  describe('updateHotspot', () => {
    it('updates hotspot cursor', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      store.addHotspot(caseId, sceneId, { type: 'rect', x: 0, y: 0, width: 100, height: 100 });
      const hotspotId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].id;

      store.updateHotspot(caseId, sceneId, hotspotId, { cursor: 'grab' });
      const hotspot = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0];
      expect(hotspot.cursor).toBe('grab');
    });
  });

  describe('deleteHotspot', () => {
    it('removes the hotspot from the scene', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      store.addHotspot(caseId, sceneId, { type: 'rect', x: 0, y: 0, width: 100, height: 100 });
      const hotspotId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].id;

      store.deleteHotspot(caseId, sceneId, hotspotId);
      expect(useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots).toHaveLength(0);
    });

    it('clears hotspot from selection', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      store.addHotspot(caseId, sceneId, { type: 'rect', x: 0, y: 0, width: 100, height: 100 });
      const hotspotId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].id;
      store.setSelection({ hotspotId });

      store.deleteHotspot(caseId, sceneId, hotspotId);
      expect(useEditorStore.getState().selection.hotspotId).toBeNull();
    });
  });

  describe('setSelectedScene', () => {
    it('sets selected scene and clears hotspot selection', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      store.addHotspot(caseId, sceneId, { type: 'rect', x: 0, y: 0, width: 100, height: 100 });
      const hotspotId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].id;
      store.setSelection({ hotspotId });

      store.setSelectedScene(sceneId);
      const sel = useEditorStore.getState().selection;
      expect(sel.sceneId).toBe(sceneId);
      expect(sel.hotspotId).toBeNull();
    });

    it('can deselect scene by passing null', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.setSelectedScene(null);
      expect(useEditorStore.getState().selection.sceneId).toBeNull();
    });
  });

  // ── Word CRUD ────────────────────────────────────────────────────

  describe('addWord', () => {
    it('adds a word to the words list', () => {
      const store = useEditorStore.getState();
      store.newProject();
      const word: Word = { id: 'w1', display: { ko: '단어', en: 'Word' }, caseId: 'case1' };
      store.addWord(word);
      expect(useEditorStore.getState().words).toHaveLength(1);
      expect(useEditorStore.getState().words[0].id).toBe('w1');
    });
  });

  describe('updateWord', () => {
    it('updates word display', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addWord({ id: 'w1', display: { ko: '단어', en: 'Word' }, caseId: 'case1' });
      store.updateWord('w1', { display: { ko: '수정된 단어', en: 'Updated Word' } });
      expect(useEditorStore.getState().words[0].display.ko).toBe('수정된 단어');
    });
  });

  describe('deleteWord', () => {
    it('removes word from list', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addWord({ id: 'w1', display: { ko: '단어1', en: 'Word1' }, caseId: 'c1' });
      store.addWord({ id: 'w2', display: { ko: '단어2', en: 'Word2' }, caseId: 'c1' });
      store.deleteWord('w1');
      const words = useEditorStore.getState().words;
      expect(words).toHaveLength(1);
      expect(words[0].id).toBe('w2');
    });
  });

  // ── UI actions ───────────────────────────────────────────────────

  describe('setSelection', () => {
    it('partially updates selection state', () => {
      const store = useEditorStore.getState();
      store.setSelection({ actId: 'act1', caseId: 'case1' });
      const sel = useEditorStore.getState().selection;
      expect(sel.actId).toBe('act1');
      expect(sel.caseId).toBe('case1');
      expect(sel.sceneId).toBeNull(); // unchanged
    });
  });

  describe('clearSelection', () => {
    it('resets all selection fields to null', () => {
      const store = useEditorStore.getState();
      store.setSelection({ actId: 'a', caseId: 'c', sceneId: 's', hotspotId: 'h' });
      store.clearSelection();
      const sel = useEditorStore.getState().selection;
      expect(sel.actId).toBeNull();
      expect(sel.caseId).toBeNull();
      expect(sel.sceneId).toBeNull();
      expect(sel.hotspotId).toBeNull();
    });
  });

  describe('setActivePanel', () => {
    it('changes the active panel', () => {
      const store = useEditorStore.getState();
      store.setActivePanel('puzzle');
      expect(useEditorStore.getState().ui.activePanel).toBe('puzzle');
    });
  });

  describe('setZoom', () => {
    it('sets zoom within bounds', () => {
      const store = useEditorStore.getState();
      store.setZoom(1.5);
      expect(useEditorStore.getState().ui.zoom).toBe(1.5);
    });

    it('clamps zoom to minimum 0.1', () => {
      const store = useEditorStore.getState();
      store.setZoom(0.01);
      expect(useEditorStore.getState().ui.zoom).toBe(0.1);
    });

    it('clamps zoom to maximum 3.0', () => {
      const store = useEditorStore.getState();
      store.setZoom(99);
      expect(useEditorStore.getState().ui.zoom).toBe(3.0);
    });
  });

  describe('setPanelWidth', () => {
    it('sets left panel width within bounds', () => {
      const store = useEditorStore.getState();
      store.setPanelWidth('left', 300);
      expect(useEditorStore.getState().ui.leftPanelWidth).toBe(300);
    });

    it('clamps left panel width to minimum 180', () => {
      const store = useEditorStore.getState();
      store.setPanelWidth('left', 50);
      expect(useEditorStore.getState().ui.leftPanelWidth).toBe(180);
    });

    it('sets right panel width', () => {
      const store = useEditorStore.getState();
      store.setPanelWidth('right', 400);
      expect(useEditorStore.getState().ui.rightPanelWidth).toBe(400);
    });
  });

  // ── Asset CRUD ───────────────────────────────────────────────────

  describe('addAsset', () => {
    it('adds an asset to the manifest', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAsset({ id: 'img1', type: 'image', src: '', mimeType: 'image/png' });
      expect(useEditorStore.getState().project!.assets.items['img1']).toBeDefined();
    });
  });

  describe('deleteAsset', () => {
    it('removes asset from manifest', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAsset({ id: 'img1', type: 'image', src: '', mimeType: 'image/png' });
      store.deleteAsset('img1');
      expect(useEditorStore.getState().project!.assets.items['img1']).toBeUndefined();
    });
  });

  // ── updateHotspotArea ────────────────────────────────────────────

  describe('updateHotspotArea', () => {
    it('updates only the area of a hotspot', () => {
      const store = useEditorStore.getState();
      store.newProject();
      store.addAct();
      const actId = useEditorStore.getState().project!.acts[0].id;
      store.addCase(actId);
      const caseId = useEditorStore.getState().project!.acts[0].cases[0].id;
      const sceneId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].id;
      store.addHotspot(caseId, sceneId, { type: 'rect', x: 0, y: 0, width: 100, height: 100 });
      const hotspotId = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0].id;

      const newArea: HotspotArea = { type: 'rect', x: 50, y: 60, width: 200, height: 150 };
      store.updateHotspotArea(caseId, sceneId, hotspotId, newArea);
      const hotspot = useEditorStore.getState().project!.acts[0].cases[0].scenes[0].hotspots[0];
      expect(hotspot.area).toEqual(newArea);
      expect(hotspot.cursor).toBe('pointer'); // unchanged
    });
  });
});
