import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type {
  GameDefinition,
  Word,
  GameSettings,
} from '@gi-engine/core';
import type { EditorStore, ProjectMeta } from './types.js';
import { genId } from './utils.js';

export type { ProjectMeta };

// ── Factory helpers ───────────────────────────────────────────────

export function makeDefaultDefinition(): GameDefinition {
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

// ── Default state ────────────────────────────────────────────────

const defaultMeta: ProjectMeta = {
  filePath: null,
  isDirty: false,
  lastSavedAt: null,
};

// ── Slice type ───────────────────────────────────────────────────

export type ProjectSlice = {
  project: GameDefinition | null;
  words: Word[];
  meta: ProjectMeta;

  newProject: () => void;
  loadProject: (definition: GameDefinition, words?: Word[], filePath?: string) => void;
  saveProject: () => Promise<void>;
  setDirty: (dirty: boolean) => void;
  updateGameMeta: (patch: Partial<Pick<GameDefinition, 'id' | 'version' | 'title' | 'description' | 'supportedLocales'>>) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
};

// ── Slice creator ────────────────────────────────────────────────

export const createProjectSlice: StateCreator<EditorStore, [], [], ProjectSlice> = (set, get) => ({
  project: null,
  words: [],
  meta: defaultMeta,

  newProject: () => {
    set({
      project: makeDefaultDefinition(),
      words: [],
      meta: { filePath: null, isDirty: false, lastSavedAt: null },
      history: { past: [], future: [] },
    });
    get().clearSelection();
  },

  loadProject: (definition, words = [], filePath) => {
    set({
      project: definition,
      words,
      meta: { filePath: filePath ?? null, isDirty: false, lastSavedAt: new Date() },
      history: { past: [], future: [] },
    });
    get().clearSelection();
  },

  saveProject: async () => {
    const { project, words } = get();
    if (!project) return;
    try {
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
      get().showNotification('저장 완료', 'success');
    } catch {
      get().showNotification('저장 실패', 'error');
    }
  },

  setDirty: (dirty) => {
    set(state => ({ meta: { ...state.meta, isDirty: dirty } }));
  },

  updateGameMeta: (patch) => {
    get().pushToHistory();
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
    get().pushToHistory();
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
});
