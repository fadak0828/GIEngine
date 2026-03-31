import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { AssetDefinition, Word } from '@gi-engine/core';
import type { EditorStore, AssetUsage } from './types.js';

// ── Slice type ───────────────────────────────────────────────────

export type AssetSlice = {
  addAsset: (asset: AssetDefinition) => void;
  updateAsset: (assetId: string, patch: Partial<AssetDefinition>) => void;
  deleteAsset: (assetId: string) => void;

  addWord: (word: Word) => void;
  updateWord: (wordId: string, patch: Partial<Word>) => void;
  deleteWord: (wordId: string) => void;

  getAssetUsages: (assetId: string) => AssetUsage[];
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

  // ── Asset usage selector ──────────────────────────────────────

  getAssetUsages: (assetId) => {
    const { project } = get();
    if (!project) return [];

    const usages: AssetUsage[] = [];
    const editorLocale = get().ui.editorLocale;

    for (const act of project.acts) {
      for (const c of act.cases) {
        const caseName = typeof c.title === 'object'
          ? (c.title[editorLocale] ?? c.id)
          : c.id;

        for (const scene of c.scenes) {
          const sceneName = scene.name[editorLocale] ?? scene.id;

          // Scene background
          if (scene.background === assetId) {
            usages.push({ kind: 'scene_background', caseId: c.id, caseName, sceneId: scene.id, sceneName });
          }

          // Scene BGM
          if (scene.bgm === assetId) {
            usages.push({ kind: 'scene_bgm', caseId: c.id, caseName, sceneId: scene.id, sceneName, detail: 'BGM' });
          }

          // Scene audio
          if (scene.audio === assetId) {
            usages.push({ kind: 'scene_sfx', caseId: c.id, caseName, sceneId: scene.id, sceneName, detail: '효과음' });
          }

          // Layers
          for (const layer of scene.layers) {
            if (layer.image === assetId) {
              usages.push({ kind: 'layer_image', caseId: c.id, caseName, sceneId: scene.id, sceneName, detail: `레이어 #${layer.id}` });
            }
          }

          // Hotspot actions (recursive helper)
          const scanActions = (actions: import('@gi-engine/core').HotspotAction[]) => {
            for (const action of actions) {
              if (action.type === 'play_sound' && action.assetRef === assetId) {
                usages.push({ kind: 'hotspot_action', caseId: c.id, caseName, sceneId: scene.id, sceneName, detail: '효과음 재생' });
              }
              if ((action.type === 'play_bgm') && action.assetRef === assetId) {
                usages.push({ kind: 'hotspot_action', caseId: c.id, caseName, sceneId: scene.id, sceneName, detail: 'BGM 재생' });
              }
              if (action.type === 'composite' && action.actions) {
                scanActions(action.actions);
              }
            }
          };

          for (const hotspot of scene.hotspots) {
            if (hotspot.action) {
              scanActions([hotspot.action]);
            }
          }

          if (scene.onEnter) {
            scanActions(scene.onEnter);
          }
        }
      }
    }

    return usages;
  },
});
