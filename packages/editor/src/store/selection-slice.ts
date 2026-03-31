import type { StateCreator } from 'zustand';
import type { Locale } from '@gi-engine/core';
import type { EditorStore, SelectionState, UIState, ActivePanel, AssetViewMode, AssetTypeFilter } from './types.js';

export type { SelectionState, UIState, ActivePanel, AssetViewMode, AssetTypeFilter };

// ── Default state ────────────────────────────────────────────────

export const defaultSelection: SelectionState = {
  actId: null,
  caseId: null,
  sceneId: null,
  hotspotId: null,
  puzzleId: null,
  layerId: null,
  subPuzzleId: null,
  assetId: null,
};

export const defaultUI: UIState = {
  activePanel: 'scene',
  editorLocale: 'ko',
  previewLocale: 'ko',
  zoom: 1.0,
  previewVisible: false,
  previewHeight: 280,
  leftPanelWidth: 260,
  rightPanelWidth: 320,
  sceneTool: 'select',
  autoSaveEnabled: true,
  autoSaveIntervalMs: 60000,
  notification: null,
  assetViewMode: 'grid',
  assetTypeFilter: 'all',
  assetSearch: '',
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
  setZoom: (zoom: number) => void;
  setPreviewVisible: (visible: boolean) => void;
  setPreviewHeight: (height: number) => void;
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
});
