import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type {
  GameDefinition,
  Act,
  Case,
  Scene,
  Hotspot,
  HotspotArea,
  HotspotAction,
  SceneLayer,
} from '@gi-engine/core';
import type { EditorStore } from './types.js';
import { genId } from './utils.js';
import { defaultSelection } from './selection-slice.js';

// ── Factory helpers ───────────────────────────────────────────────

export function makeDefaultScene(name?: string): Scene {
  return {
    id: genId('scene'),
    name: { ko: name ?? '새 씬', en: name ?? 'New Scene' },
    background: '',
    dimensions: { width: 1280, height: 720 },
    hotspots: [],
    layers: [],
  };
}

export function makeDefaultCase(title?: string): Case {
  return {
    id: genId('case'),
    title: { ko: title ?? '새 사건', en: title ?? 'New Case' },
    description: { ko: '', en: '' },
    scenes: [makeDefaultScene()],
    puzzles: {
      main: {
        id: genId('puzzle'),
        title: { ko: '새 퍼즐', en: 'New Puzzle' },
        type: 'fill_in_blank',
        template: { segments: [] },
        answers: {},
      },
      sub: [],
    },
    prerequisites: [],
    thumbnail: '',
  };
}

export function makeDefaultAct(title?: string): Act {
  return {
    id: genId('act'),
    title: { ko: title ?? '새 막', en: title ?? 'New Act' },
    cases: [],
  };
}

// ── Helper: find case/scene in draft ─────────────────────────────

export function findCaseInDraft(project: GameDefinition, caseId: string): Case | undefined {
  for (const act of project.acts) {
    const c = act.cases.find(cs => cs.id === caseId);
    if (c) return c;
  }
  return undefined;
}

export function findSceneInDraft(project: GameDefinition, caseId: string, sceneId: string): Scene | undefined {
  for (const act of project.acts) {
    const c = act.cases.find(cs => cs.id === caseId);
    if (c) return c.scenes.find(s => s.id === sceneId);
  }
  return undefined;
}

// ── Slice type ───────────────────────────────────────────────────

export type SceneSlice = {
  addAct: () => void;
  updateAct: (actId: string, patch: Partial<Pick<Act, 'title'>>) => void;
  deleteAct: (actId: string) => void;
  reorderActs: (fromIndex: number, toIndex: number) => void;

  addCase: (actId: string) => void;
  updateCase: (caseId: string, patch: Partial<Omit<Case, 'scenes' | 'puzzles'>>) => void;
  deleteCase: (actId: string, caseId: string) => void;
  reorderCases: (actId: string, fromIndex: number, toIndex: number) => void;

  addScene: (caseId: string) => void;
  updateScene: (caseId: string, sceneId: string, patch: Partial<Omit<Scene, 'hotspots' | 'layers'>>) => void;
  deleteScene: (caseId: string, sceneId: string) => void;
  reorderScenes: (caseId: string, fromIndex: number, toIndex: number) => void;

  addHotspot: (caseId: string, sceneId: string, area: HotspotArea) => void;
  updateHotspot: (caseId: string, sceneId: string, hotspotId: string, patch: Partial<Hotspot>) => void;
  updateHotspotArea: (caseId: string, sceneId: string, hotspotId: string, area: HotspotArea) => void;
  updateHotspotAction: (caseId: string, sceneId: string, hotspotId: string, action: HotspotAction) => void;
  deleteHotspot: (caseId: string, sceneId: string, hotspotId: string) => void;

  addLayer: (caseId: string, sceneId: string) => void;
  updateLayer: (caseId: string, sceneId: string, layerId: string, patch: Partial<SceneLayer>) => void;
  deleteLayer: (caseId: string, sceneId: string, layerId: string) => void;
  reorderLayers: (caseId: string, sceneId: string, fromIndex: number, toIndex: number) => void;
};

// ── Slice creator ────────────────────────────────────────────────

export const createSceneSlice: StateCreator<EditorStore, [], [], SceneSlice> = (set, get) => ({

  // ── Act CRUD ──────────────────────────────────────────────────

  addAct: () => {
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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

  // ── Case CRUD ─────────────────────────────────────────────────

  addCase: (actId) => {
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const act = draft.acts.find(a => a.id === actId);
          if (act) act.cases = act.cases.filter(c => c.id !== caseId);
        }),
        meta: { ...state.meta, isDirty: true },
        selection: state.selection.caseId === caseId
          ? { ...defaultSelection, actId: state.selection.actId }
          : state.selection,
      };
    });
  },

  reorderCases: (actId, fromIndex, toIndex) => {
    get().pushToHistory();
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

  // ── Scene CRUD ────────────────────────────────────────────────

  addScene: (caseId) => {
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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

  // ── Hotspot CRUD ──────────────────────────────────────────────

  addHotspot: (caseId, sceneId, area) => {
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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

  // ── SceneLayer CRUD ───────────────────────────────────────────

  addLayer: (caseId, sceneId) => {
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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
});
