import { create } from 'zustand';
import { produce } from 'immer';
import type {
  GameDefinition,
  Act,
  Case,
  Scene,
  Hotspot,
  HotspotArea,
  HotspotAction,
  SceneLayer,
  Puzzle,
  SubPuzzle,
  PuzzleTemplate,
  AnswerDefinition,
  AssetDefinition,
  Word,
  GameSettings,
  Locale,
  LocalizedText,
  PuzzleSet,
} from '@gi-engine/core';

// ── Utility: nanoid-lite ──────────────────────────────────────────
let _counter = 0;
function genId(prefix = 'id'): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

// ── Sub-types ────────────────────────────────────────────────────

interface ProjectMeta {
  filePath: string | null;
  isDirty: boolean;
  lastSavedAt: Date | null;
}

interface SelectionState {
  actId: string | null;
  caseId: string | null;
  sceneId: string | null;
  hotspotId: string | null;
  puzzleId: string | null;
  layerId: string | null;
  subPuzzleId: string | null;
}

export type ActivePanel = 'scene' | 'puzzle' | 'assets' | 'words' | 'settings' | 'subPuzzle';

interface UIState {
  activePanel: ActivePanel;
  editorLocale: Locale;
  previewLocale: Locale;
  zoom: number;
  previewVisible: boolean;
  previewHeight: number;
  leftPanelWidth: number;
  rightPanelWidth: number;
  sceneTool: 'select' | 'draw_rect' | 'delete';
}

// ── Factory helpers ───────────────────────────────────────────────

function makeDefaultPuzzleSet(): PuzzleSet {
  return {
    main: {
      id: genId('puzzle'),
      title: { ko: '새 퍼즐', en: 'New Puzzle' },
      type: 'fill_in_blank',
      template: { segments: [] },
      answers: {},
    },
    sub: [],
  };
}

function makeDefaultScene(name?: string): Scene {
  return {
    id: genId('scene'),
    name: { ko: name ?? '새 씬', en: name ?? 'New Scene' },
    background: '',
    dimensions: { width: 1280, height: 720 },
    hotspots: [],
    layers: [],
  };
}

function makeDefaultCase(title?: string): Case {
  return {
    id: genId('case'),
    title: { ko: title ?? '새 사건', en: title ?? 'New Case' },
    description: { ko: '', en: '' },
    scenes: [makeDefaultScene()],
    puzzles: makeDefaultPuzzleSet(),
    prerequisites: [],
    thumbnail: '',
  };
}

function makeDefaultAct(title?: string): Act {
  return {
    id: genId('act'),
    title: { ko: title ?? '새 막', en: title ?? 'New Act' },
    cases: [],
  };
}

function makeDefaultDefinition(): GameDefinition {
  return {
    id: genId('game'),
    version: '1.0.0',
    title: { ko: '새 프로젝트', en: 'New Project' },
    description: { ko: '', en: '' },
    supportedLocales: ['ko', 'en'],
    settings: {
      validationFeedbackDuration: 1500,
      autoSaveInterval: 30000,
      debug: false,
      unlockMode: 'sequential',
      cssPrefix: 'gi',
    },
    acts: [],
    assets: { items: {} },
  };
}

// ── Store interface ───────────────────────────────────────────────

interface EditorStore {
  // State
  project: GameDefinition | null;
  words: Word[];
  meta: ProjectMeta;
  selection: SelectionState;
  ui: UIState;

  // Project lifecycle
  newProject: () => void;
  loadProject: (definition: GameDefinition, words?: Word[], filePath?: string) => void;
  saveProject: () => Promise<void>;
  setDirty: (dirty: boolean) => void;

  // GameDefinition meta
  updateGameMeta: (patch: Partial<Pick<GameDefinition, 'id' | 'version' | 'title' | 'description' | 'supportedLocales'>>) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;

  // Act CRUD
  addAct: () => void;
  updateAct: (actId: string, patch: Partial<Pick<Act, 'title'>>) => void;
  deleteAct: (actId: string) => void;
  reorderActs: (fromIndex: number, toIndex: number) => void;

  // Case CRUD
  addCase: (actId: string) => void;
  updateCase: (caseId: string, patch: Partial<Omit<Case, 'scenes' | 'puzzles'>>) => void;
  deleteCase: (actId: string, caseId: string) => void;
  reorderCases: (actId: string, fromIndex: number, toIndex: number) => void;

  // Scene CRUD
  addScene: (caseId: string) => void;
  updateScene: (caseId: string, sceneId: string, patch: Partial<Omit<Scene, 'hotspots' | 'layers'>>) => void;
  deleteScene: (caseId: string, sceneId: string) => void;
  reorderScenes: (caseId: string, fromIndex: number, toIndex: number) => void;

  // Hotspot CRUD
  addHotspot: (caseId: string, sceneId: string, area: HotspotArea) => void;
  updateHotspot: (caseId: string, sceneId: string, hotspotId: string, patch: Partial<Hotspot>) => void;
  updateHotspotArea: (caseId: string, sceneId: string, hotspotId: string, area: HotspotArea) => void;
  updateHotspotAction: (caseId: string, sceneId: string, hotspotId: string, action: HotspotAction) => void;
  deleteHotspot: (caseId: string, sceneId: string, hotspotId: string) => void;

  // SceneLayer CRUD
  addLayer: (caseId: string, sceneId: string) => void;
  updateLayer: (caseId: string, sceneId: string, layerId: string, patch: Partial<SceneLayer>) => void;
  deleteLayer: (caseId: string, sceneId: string, layerId: string) => void;
  reorderLayers: (caseId: string, sceneId: string, fromIndex: number, toIndex: number) => void;

  // Puzzle CRUD
  updateMainPuzzle: (caseId: string, patch: Partial<Puzzle>) => void;
  updatePuzzleTemplate: (caseId: string, template: PuzzleTemplate) => void;
  updatePuzzleAnswers: (caseId: string, answers: Record<string, AnswerDefinition>) => void;
  addSubPuzzle: (caseId: string, type: SubPuzzle['type']) => void;
  updateSubPuzzle: (caseId: string, puzzleId: string, patch: Partial<SubPuzzle>) => void;
  deleteSubPuzzle: (caseId: string, puzzleId: string) => void;

  // Asset CRUD
  addAsset: (asset: AssetDefinition) => void;
  updateAsset: (assetId: string, patch: Partial<AssetDefinition>) => void;
  deleteAsset: (assetId: string) => void;

  // Word CRUD
  addWord: (word: Word) => void;
  updateWord: (wordId: string, patch: Partial<Word>) => void;
  deleteWord: (wordId: string) => void;

  // UI actions
  setSelection: (patch: Partial<SelectionState>) => void;
  clearSelection: () => void;
  setActivePanel: (panel: ActivePanel) => void;
  setEditorLocale: (locale: Locale) => void;
  setPreviewLocale: (locale: Locale) => void;
  setZoom: (zoom: number) => void;
  setPreviewVisible: (visible: boolean) => void;
  setPreviewHeight: (height: number) => void;
  setSceneTool: (tool: UIState['sceneTool']) => void;
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;

  // Convenience: set selected scene / sub-puzzle
  setSelectedScene: (sceneId: string | null) => void;
  setSelectedSubPuzzle: (subPuzzleId: string | null) => void;
}

// ── Helper: find scene in draft ───────────────────────────────────

function findSceneInDraft(project: GameDefinition, caseId: string, sceneId: string): Scene | undefined {
  for (const act of project.acts) {
    const c = act.cases.find(cs => cs.id === caseId);
    if (c) return c.scenes.find(s => s.id === sceneId);
  }
  return undefined;
}

function findCaseInDraft(project: GameDefinition, caseId: string): Case | undefined {
  for (const act of project.acts) {
    const c = act.cases.find(cs => cs.id === caseId);
    if (c) return c;
  }
  return undefined;
}

// ── Default state ────────────────────────────────────────────────

const defaultMeta: ProjectMeta = {
  filePath: null,
  isDirty: false,
  lastSavedAt: null,
};

const defaultSelection: SelectionState = {
  actId: null,
  caseId: null,
  sceneId: null,
  hotspotId: null,
  puzzleId: null,
  layerId: null,
  subPuzzleId: null,
};

const defaultUI: UIState = {
  activePanel: 'scene',
  editorLocale: 'ko',
  previewLocale: 'ko',
  zoom: 1.0,
  previewVisible: false,
  previewHeight: 280,
  leftPanelWidth: 260,
  rightPanelWidth: 320,
  sceneTool: 'select',
};

// ── Store implementation ──────────────────────────────────────────

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: null,
  words: [],
  meta: defaultMeta,
  selection: defaultSelection,
  ui: defaultUI,

  // ── Project lifecycle ───────────────────────────────────────────
  newProject: () => {
    set({
      project: makeDefaultDefinition(),
      words: [],
      meta: { filePath: null, isDirty: false, lastSavedAt: null },
      selection: defaultSelection,
    });
  },

  loadProject: (definition, words = [], filePath) => {
    set({
      project: definition,
      words,
      meta: { filePath: filePath ?? null, isDirty: false, lastSavedAt: new Date() },
      selection: defaultSelection,
    });
  },

  saveProject: async () => {
    const { project, words } = get();
    if (!project) return;
    const data = JSON.stringify({ definition: project, words }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}.gi-project`;
    a.click();
    URL.revokeObjectURL(url);
    set(state => ({
      meta: { ...state.meta, isDirty: false, lastSavedAt: new Date() },
    }));
  },

  setDirty: (dirty) => {
    set(state => ({ meta: { ...state.meta, isDirty: dirty } }));
  },

  // ── GameDefinition meta ─────────────────────────────────────────
  updateGameMeta: (patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          Object.assign(draft, patch);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateSettings: (patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          Object.assign(draft.settings, patch);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  // ── Act CRUD ────────────────────────────────────────────────────
  addAct: () => {
    set(state => {
      if (!state.project) return state;
      const newAct = makeDefaultAct();
      return {
        project: produce(state.project, draft => {
          draft.acts.push(newAct);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateAct: (actId, patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const act = draft.acts.find(a => a.id === actId);
          if (act) Object.assign(act, patch);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  deleteAct: (actId) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          draft.acts = draft.acts.filter(a => a.id !== actId);
        }),
        meta: { ...state.meta, isDirty: true },
        selection: state.selection.actId === actId ? defaultSelection : state.selection,
      };
    });
  },

  reorderActs: (fromIndex, toIndex) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const [removed] = draft.acts.splice(fromIndex, 1);
          draft.acts.splice(toIndex, 0, removed);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  // ── Case CRUD ───────────────────────────────────────────────────
  addCase: (actId) => {
    set(state => {
      if (!state.project) return state;
      const newCase = makeDefaultCase();
      return {
        project: produce(state.project, draft => {
          const act = draft.acts.find(a => a.id === actId);
          if (act) act.cases.push(newCase);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateCase: (caseId, patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          for (const act of draft.acts) {
            const c = act.cases.find(cs => cs.id === caseId);
            if (c) { Object.assign(c, patch); break; }
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  deleteCase: (actId, caseId) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const act = draft.acts.find(a => a.id === actId);
          if (act) act.cases = act.cases.filter(c => c.id !== caseId);
        }),
        meta: { ...state.meta, isDirty: true },
        selection: state.selection.caseId === caseId ? { ...defaultSelection, actId: state.selection.actId } : state.selection,
      };
    });
  },

  reorderCases: (actId, fromIndex, toIndex) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const act = draft.acts.find(a => a.id === actId);
          if (act) {
            const [removed] = act.cases.splice(fromIndex, 1);
            act.cases.splice(toIndex, 0, removed);
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  // ── Scene CRUD ──────────────────────────────────────────────────
  addScene: (caseId) => {
    set(state => {
      if (!state.project) return state;
      const newScene = makeDefaultScene();
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.scenes.push(newScene);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateScene: (caseId, sceneId, patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) Object.assign(scene, patch);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  deleteScene: (caseId, sceneId) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.scenes = c.scenes.filter(s => s.id !== sceneId);
        }),
        meta: { ...state.meta, isDirty: true },
        selection: state.selection.sceneId === sceneId
          ? { ...state.selection, sceneId: null, hotspotId: null }
          : state.selection,
      };
    });
  },

  reorderScenes: (caseId, fromIndex, toIndex) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) {
            const [removed] = c.scenes.splice(fromIndex, 1);
            c.scenes.splice(toIndex, 0, removed);
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  // ── Hotspot CRUD ────────────────────────────────────────────────
  addHotspot: (caseId, sceneId, area) => {
    set(state => {
      if (!state.project) return state;
      const newHotspot: Hotspot = {
        id: genId('hotspot'),
        name: '',
        area,
        action: { type: 'examine', content: { ko: '', en: '' } },
        cursor: 'pointer',
        ariaLabel: { ko: '', en: '' },
      };
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) scene.hotspots.push(newHotspot);
        }),
        meta: { ...state.meta, isDirty: true },
        selection: { ...state.selection, hotspotId: newHotspot.id },
      };
    });
  },

  updateHotspot: (caseId, sceneId, hotspotId, patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) {
            const hotspot = scene.hotspots.find(h => h.id === hotspotId);
            if (hotspot) Object.assign(hotspot, patch);
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateHotspotArea: (caseId, sceneId, hotspotId, area) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) {
            const hotspot = scene.hotspots.find(h => h.id === hotspotId);
            if (hotspot) hotspot.area = area;
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateHotspotAction: (caseId, sceneId, hotspotId, action) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) {
            const hotspot = scene.hotspots.find(h => h.id === hotspotId);
            if (hotspot) hotspot.action = action;
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  deleteHotspot: (caseId, sceneId, hotspotId) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) scene.hotspots = scene.hotspots.filter(h => h.id !== hotspotId);
        }),
        meta: { ...state.meta, isDirty: true },
        selection: state.selection.hotspotId === hotspotId
          ? { ...state.selection, hotspotId: null }
          : state.selection,
      };
    });
  },

  // ── SceneLayer CRUD ─────────────────────────────────────────────
  addLayer: (caseId, sceneId) => {
    set(state => {
      if (!state.project) return state;
      const newLayer: SceneLayer = {
        id: genId('layer'),
        image: '',
        position: { x: 0, y: 0 },
        zIndex: 1,
        visible: true,
      };
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) scene.layers.push(newLayer);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateLayer: (caseId, sceneId, layerId, patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) {
            const layer = scene.layers.find(l => l.id === layerId);
            if (layer) Object.assign(layer, patch);
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  deleteLayer: (caseId, sceneId, layerId) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (scene) scene.layers = scene.layers.filter(l => l.id !== layerId);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  reorderLayers: (caseId, sceneId, fromIndex, toIndex) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const scene = findSceneInDraft(draft, caseId, sceneId);
          if (!scene) return;
          // Work in sorted order (highest zIndex first = top of list)
          const sorted = [...scene.layers].sort((a, b) => b.zIndex - a.zIndex);
          const [removed] = sorted.splice(fromIndex, 1);
          sorted.splice(toIndex, 0, removed);
          // Reassign zIndex so position in list matches rendering order
          const maxZ = sorted.length;
          sorted.forEach((layer, i) => {
            const target = scene.layers.find(l => l.id === layer.id);
            if (target) target.zIndex = maxZ - i;
          });
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  // ── Puzzle CRUD ─────────────────────────────────────────────────
  updateMainPuzzle: (caseId, patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) Object.assign(c.puzzles.main, patch);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updatePuzzleTemplate: (caseId, template) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.main.template = template;
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updatePuzzleAnswers: (caseId, answers) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.main.answers = answers;
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  addSubPuzzle: (caseId, type) => {
    set(state => {
      if (!state.project) return state;
      let newSub: SubPuzzle;
      const baseId = genId('subpuzzle');
      if (type === 'character_id') {
        newSub = { id: baseId, title: { ko: '캐릭터 ID', en: 'Character ID' }, type: 'character_id', characters: [] };
      } else if (type === 'timeline') {
        newSub = { id: baseId, title: { ko: '타임라인', en: 'Timeline' }, type: 'timeline', slots: [] };
      } else if (type === 'scenario') {
        newSub = { id: baseId, title: { ko: '시나리오', en: 'Scenario' }, type: 'scenario', template: { segments: [] }, answers: {} };
      } else {
        newSub = { id: baseId, title: { ko: '관계도', en: 'Relationship' }, type: 'relationship', nodes: [], edges: [] };
      }
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.sub.push(newSub);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateSubPuzzle: (caseId, puzzleId, patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) {
            const sub = c.puzzles.sub.find(p => p.id === puzzleId);
            if (sub) Object.assign(sub, patch);
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  deleteSubPuzzle: (caseId, puzzleId) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.sub = c.puzzles.sub.filter(p => p.id !== puzzleId);
        }),
        meta: { ...state.meta, isDirty: true },
        selection: state.selection.subPuzzleId === puzzleId
          ? { ...state.selection, subPuzzleId: null }
          : state.selection,
      };
    });
  },

  // ── Asset CRUD ──────────────────────────────────────────────────
  addAsset: (asset) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          draft.assets.items[asset.id] = asset;
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateAsset: (assetId, patch) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          if (draft.assets.items[assetId]) {
            Object.assign(draft.assets.items[assetId], patch);
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  deleteAsset: (assetId) => {
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          delete draft.assets.items[assetId];
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  // ── Word CRUD ───────────────────────────────────────────────────
  addWord: (word) => {
    set(state => ({
      words: [...state.words, word],
      meta: { ...state.meta, isDirty: true },
    }));
  },

  updateWord: (wordId, patch) => {
    set(state => ({
      words: state.words.map(w => w.id === wordId ? { ...w, ...patch } : w),
      meta: { ...state.meta, isDirty: true },
    }));
  },

  deleteWord: (wordId) => {
    set(state => ({
      words: state.words.filter(w => w.id !== wordId),
      meta: { ...state.meta, isDirty: true },
    }));
  },

  // ── UI actions ──────────────────────────────────────────────────
  setSelection: (patch) => {
    set(state => {
      const next = { ...state.selection, ...patch };
      // Reset subPuzzleId when case changes
      if (patch.caseId !== undefined && patch.caseId !== state.selection.caseId) {
        next.subPuzzleId = patch.subPuzzleId ?? null;
      }
      return { selection: next };
    });
  },

  clearSelection: () => {
    set({ selection: defaultSelection });
  },

  setActivePanel: (panel) => {
    set(state => ({ ui: { ...state.ui, activePanel: panel } }));
  },

  setEditorLocale: (locale) => {
    set(state => ({ ui: { ...state.ui, editorLocale: locale } }));
  },

  setPreviewLocale: (locale) => {
    set(state => ({ ui: { ...state.ui, previewLocale: locale } }));
  },

  setZoom: (zoom) => {
    set(state => ({ ui: { ...state.ui, zoom: Math.min(3.0, Math.max(0.1, zoom)) } }));
  },

  setPreviewVisible: (visible) => {
    set(state => ({ ui: { ...state.ui, previewVisible: visible } }));
  },

  setPreviewHeight: (height) => {
    set(state => ({ ui: { ...state.ui, previewHeight: height } }));
  },

  setSceneTool: (tool) => {
    set(state => ({ ui: { ...state.ui, sceneTool: tool } }));
  },

  setPanelWidth: (panel, width) => {
    set(state => ({
      ui: panel === 'left'
        ? { ...state.ui, leftPanelWidth: Math.max(180, Math.min(500, width)) }
        : { ...state.ui, rightPanelWidth: Math.max(240, Math.min(600, width)) },
    }));
  },

  setSelectedScene: (sceneId) => {
    set(state => ({
      selection: { ...state.selection, sceneId, hotspotId: null },
    }));
  },

  setSelectedSubPuzzle: (subPuzzleId) => {
    set(state => ({
      selection: { ...state.selection, subPuzzleId },
    }));
  },
}));

// ── Selectors ─────────────────────────────────────────────────────

export function useProject() {
  return useEditorStore(s => s.project);
}

export function useSelection() {
  return useEditorStore(s => s.selection);
}

export function useUI() {
  return useEditorStore(s => s.ui);
}

export function useWords() {
  return useEditorStore(s => s.words);
}

// Re-export types for consumers
export type { ProjectMeta, SelectionState, UIState, LocalizedText };
