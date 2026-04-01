import { create } from 'zustand';
import type { EditorStore } from './types.js';
import { createProjectSlice } from './project-slice.js';
import { createSelectionSlice } from './selection-slice.js';
import { createSceneSlice } from './scene-slice.js';
import { createPuzzleSlice } from './puzzle-slice.js';
import { createAssetSlice } from './asset-slice.js';
import { createHistorySlice } from './history-slice.js';
import { createInterviewSlice } from './interview-slice.js';
import { createQuickCreateSlice } from './quick-create-slice.js';
import { createItchSlice } from './itch-slice.js';

export const useEditorStore = create<EditorStore>((...a) => ({
  ...createProjectSlice(...a),
  ...createSelectionSlice(...a),
  ...createSceneSlice(...a),
  ...createPuzzleSlice(...a),
  ...createAssetSlice(...a),
  ...createHistorySlice(...a),
  ...createInterviewSlice(...a),
  ...createQuickCreateSlice(...a),
  ...createItchSlice(...a),
}));

// Re-export types and selectors
export type { ProjectMeta, SelectionState, UIState, LocalizedText, ActivePanel, PreviewMode } from './types.js';
export type { ItchCredentials, ItchPublishConfig } from './types.js';
export {
  useProject, useSelection, useUI, useWords, useCanUndo, useCanRedo,
  useEditorLocale, usePreviewLocale, useActivePanel, useSceneTool,
  useSelectedCaseId, useSelectedSceneId, useSelectedHotspotId, useSelectedPuzzleId,
  useSelectedScene,
} from './selectors.js';
