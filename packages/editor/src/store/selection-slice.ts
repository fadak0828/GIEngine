import type { StateCreator } from 'zustand';
import type { Locale } from '@gi-engine/core';
import type { EditorStore, SelectionState, UIState, ActivePanel, AssetViewMode, AssetTypeFilter, PreviewMode } from './types.js';
import { loadPersistedUI } from './ui-persist.js';

export type { SelectionState, UIState, ActivePanel, AssetViewMode, AssetTypeFilter, PreviewMode };

// ── Persistent UI defaults ─────────────────────────────────────────

const persistedUI = (() => {
  try {
    const raw = localStorage.getItem('gi-editor-ui-v1');
    return raw ? (JSON.parse(raw) as ReturnType<typeof loadPersistedUI>) : null;
  } catch {
    return null;
  }
})();

// ── Default state ────────────────────────────────────────────────

export const defaultSelection: SelectionState = {
  actId: null,
  caseId: null,
  sceneId: null,
  hotspotId: null,
  hotspotIds: [],
  puzzleId: null,
  layerId: null,
  subPuzzleId: null,
  assetId: null,
};

export const defaultUI: UIState = {
  activePanel: 'scene',
  editorLocale: (persistedUI?.editorLocale as Locale) ?? 'ko',
  previewLocale: (persistedUI?.previewLocale as Locale) ?? 'ko',
  isFullscreen: false,
  zoom: 1.0,
  previewVisible: persistedUI?.previewVisible ?? false,
  previewHeight: persistedUI?.previewHeight ?? 280,
  previewMode: (persistedUI?.previewMode as PreviewMode) ?? 'scene',
  previewPlaying: false,
  leftPanelWidth: persistedUI?.leftPanelWidth ?? 260,
  rightPanelWidth: persistedUI?.rightPanelWidth ?? 320,
  sceneTool: (persistedUI?.sceneTool as UIState['sceneTool']) ?? 'select',
  autoSaveEnabled: true,
  autoSaveIntervalMs: 60000,
  notification: null,
  assetViewMode: (persistedUI?.assetViewMode as AssetViewMode) ?? 'grid',
  assetTypeFilter: (persistedUI?.assetTypeFilter as AssetTypeFilter) ?? 'all',
  assetSearch: '',
  shortcutHelpOpen: false,
  gridSnapEnabled: persistedUI?.gridSnapEnabled ?? true,
  gridSize: persistedUI?.gridSize ?? 10,
  dragPreview: null,
};

// ── Slice type ───────────────────────────────────────────────────

export type SelectionSlice = {
  selection: SelectionState;
  ui: UIState;

  setSelection: (patch: Partial<SelectionState>) => void;
  clearSelection: () => void;
  setActivePanel: (panel: ActivePanel) => void;
  setEditorLocale: (locale: Locale) => void;
  setPreviewLocale: (locale: Locale) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setZoom: (zoom: number) => void;
  setPreviewVisible: (visible: boolean) => void;
  setPreviewHeight: (height: number) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setPreviewPlaying: (playing: boolean) => void;
  setSceneTool: (tool: UIState['sceneTool']) => void;
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;
  setSelectedScene: (sceneId: string | null) => void;
  setSelectedSubPuzzle: (subPuzzleId: string | null) => void;
  setAutoSave: (enabled: boolean, intervalMs?: number) => void;
  showNotification: (message: string, type: 'success' | 'error', durationMs?: number) => void;
  clearNotification: () => void;
  setSelectedAsset: (assetId: string | null) => void;
  setAssetViewMode: (mode: AssetViewMode) => void;
  setAssetTypeFilter: (filter: AssetTypeFilter) => void;
  setAssetSearch: (query: string) => void;
  setShortcutHelpOpen: (open: boolean) => void;
  toggleGridSnap: () => void;
  setGridSize: (size: number) => void;
  setDragPreview: (preview: { hotspotId: string; area: import('@gi-engine/core').HotspotArea } | null) => void;
  addToHotspotSelection: (hotspotId: string) => void;
  removeFromHotspotSelection: (hotspotId: string) => void;
  clearHotspotSelection: () => void;
};

// ── Slice creator ────────────────────────────────────────────────

export const createSelectionSlice: StateCreator<EditorStore, [], [], SelectionSlice> = (set, get) => ({
  selection: defaultSelection,
  ui: defaultUI,

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

  setFullscreen: (fullscreen) => {
    set(state => ({ ui: { ...state.ui, isFullscreen: fullscreen } }));
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

  setPreviewMode: (mode) => {
    set(state => ({ ui: { ...state.ui, previewMode: mode, previewPlaying: false } }));
  },

  setPreviewPlaying: (playing) => {
    set(state => ({ ui: { ...state.ui, previewPlaying: playing } }));
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

  setAutoSave: (enabled, intervalMs) => {
    set(state => ({
      ui: {
        ...state.ui,
        autoSaveEnabled: enabled,
        autoSaveIntervalMs: intervalMs ?? state.ui.autoSaveIntervalMs,
      },
    }));
  },

  showNotification: (message, type, durationMs = 3000) => {
    set(state => ({ ui: { ...state.ui, notification: { message, type } } }));
    setTimeout(() => {
      get().clearNotification();
    }, durationMs);
  },

  clearNotification: () => {
    set(state => ({ ui: { ...state.ui, notification: null } }));
  },

  setSelectedAsset: (assetId) => {
    set(state => ({ selection: { ...state.selection, assetId } }));
  },

  setAssetViewMode: (mode) => {
    set(state => ({ ui: { ...state.ui, assetViewMode: mode } }));
  },

  setAssetTypeFilter: (filter) => {
    set(state => ({ ui: { ...state.ui, assetTypeFilter: filter } }));
  },

  setAssetSearch: (query) => {
    set(state => ({ ui: { ...state.ui, assetSearch: query } }));
  },

  setShortcutHelpOpen: (open) => {
    set(state => ({ ui: { ...state.ui, shortcutHelpOpen: open } }));
  },

  toggleGridSnap: () => {
    set(state => ({ ui: { ...state.ui, gridSnapEnabled: !state.ui.gridSnapEnabled } }));
  },

  setGridSize: (size) => {
    set(state => ({ ui: { ...state.ui, gridSize: Math.max(1, size) } }));
  },

  addToHotspotSelection: (hotspotId) => {
    set(state => {
      if (state.selection.hotspotIds.includes(hotspotId)) return state;
      return { selection: { ...state.selection, hotspotIds: [...state.selection.hotspotIds, hotspotId] } };
    });
  },

  removeFromHotspotSelection: (hotspotId) => {
    set(state => ({
      selection: { ...state.selection, hotspotIds: state.selection.hotspotIds.filter(id => id !== hotspotId) },
    }));
  },

  clearHotspotSelection: () => {
    set(state => ({ selection: { ...state.selection, hotspotIds: [] } }));
  },

  setDragPreview: (preview) => {
    set(state => ({ ui: { ...state.ui, dragPreview: preview } }));
  },
});
