import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { AssetDefinition, Word } from '@gi-engine/core';
import type { EditorStore } from './types.js';

// ── Slice type ───────────────────────────────────────────────────

export type AssetSlice = {
  addAsset: (asset: AssetDefinition) => void;
  updateAsset: (assetId: string, patch: Partial<AssetDefinition>) => void;
  deleteAsset: (assetId: string) => void;

  addWord: (word: Word) => void;
  updateWord: (wordId: string, patch: Partial<Word>) => void;
  deleteWord: (wordId: string) => void;
};

// ── Slice creator ────────────────────────────────────────────────

export const createAssetSlice: StateCreator<EditorStore, [], [], AssetSlice> = (set, get) => ({

  // ── Asset CRUD ────────────────────────────────────────────────

  addAsset: (asset) => {
    get().pushToHistory();
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
    get().pushToHistory();
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
    get().pushToHistory();
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

  // ── Word CRUD ─────────────────────────────────────────────────

  addWord: (word) => {
    get().pushToHistory();
    set(state => ({
      words: [...state.words, word],
      meta: { ...state.meta, isDirty: true },
    }));
  },

  updateWord: (wordId, patch) => {
    get().pushToHistory();
    set(state => ({
      words: state.words.map(w => w.id === wordId ? { ...w, ...patch } : w),
      meta: { ...state.meta, isDirty: true },
    }));
  },

  deleteWord: (wordId) => {
    get().pushToHistory();
    set(state => ({
      words: state.words.filter(w => w.id !== wordId),
      meta: { ...state.meta, isDirty: true },
    }));
  },
});
