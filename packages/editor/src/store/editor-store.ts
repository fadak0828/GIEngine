import { create } from 'zustand';
import type { EditorStore } from './types.js';
import { createProjectSlice } from './project-slice.js';
import { createSelectionSlice } from './selection-slice.js';
import { createSceneSlice } from './scene-slice.js';
import { createPuzzleSlice } from './puzzle-slice.js';
import { createAssetSlice } from './asset-slice.js';
import { createHistorySlice } from './history-slice.js';

export const useEditorStore = create<EditorStore>((...a) => ({
  ...createProjectSlice(...a),
  ...createSelectionSlice(...a),
  ...createSceneSlice(...a),
  ...createPuzzleSlice(...a),
  ...createAssetSlice(...a),
  ...createHistorySlice(...a),
}));

// Re-export types and selectors
export type { ProjectMeta, SelectionState, UIState, LocalizedText, ActivePanel } from './types.js';
export { useProject, useSelection, useUI, useWords, useCanUndo, useCanRedo } from './selectors.js';
