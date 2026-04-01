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
  AssetCategory,
  Word,
  GameSettings,
  Locale,
  LocalizedText,
  PuzzleSet,
} from '@gi-engine/core';
import type { InterviewSlice } from './interview-slice.js';

export type {
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
  AssetCategory,
  Word,
  GameSettings,
  Locale,
  LocalizedText,
  PuzzleSet,
};

// ── Sub-types ────────────────────────────────────────────────────

export interface ProjectMeta {
  filePath: string | null;
  isDirty: boolean;
  lastSavedAt: Date | null;
}

export interface SelectionState {
  actId: string | null;
  caseId: string | null;
  sceneId: string | null;
  hotspotId: string | null;
  puzzleId: string | null;
  layerId: string | null;
  subPuzzleId: string | null;
  assetId: string | null;
}

export type ActivePanel = 'scene' | 'puzzle' | 'assets' | 'words' | 'settings' | 'subPuzzle' | 'validation';

export type AssetViewMode = 'grid' | 'list';
export type AssetTypeFilter = 'all' | 'image' | 'audio' | 'font';

export interface UIState {
  activePanel: ActivePanel;
  editorLocale: Locale;
  previewLocale: Locale;
  zoom: number;
  previewVisible: boolean;
  previewHeight: number;
  leftPanelWidth: number;
  rightPanelWidth: number;
  sceneTool: 'select' | 'draw_rect' | 'draw_polygon' | 'delete';
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  notification: { message: string; type: 'success' | 'error' } | null;
  assetViewMode: AssetViewMode;
  assetTypeFilter: AssetTypeFilter;
  assetSearch: string;
}

// ── History ───────────────────────────────────────────────────────

export interface HistorySnapshot {
  project: GameDefinition | null;
  words: Word[];
}

export interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

// ── EditorStore (full intersection type) ────────────────────────

export interface EditorStore extends InterviewSlice {
  // State
  project: GameDefinition | null;
  words: Word[];
  meta: ProjectMeta;
  selection: SelectionState;
  ui: UIState;
  history: HistoryState;

  // Project lifecycle
  newProject: () => void;
  loadProject: (definition: GameDefinition, words?: Word[], filePath?: string) => void;
  saveProject: () => Promise<void>;
  setDirty: (dirty: boolean) => void;

  // History
  pushToHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Notifications
  showNotification: (message: string, type: 'success' | 'error', durationMs?: number) => void;
  clearNotification: () => void;

  // Auto-save
  setAutoSave: (enabled: boolean, intervalMs?: number) => void;

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
  insertCase: (actId: string, caseData: Case) => void;
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

  // Asset UI state
  setSelectedAsset: (assetId: string | null) => void;
  setAssetViewMode: (mode: AssetViewMode) => void;
  setAssetTypeFilter: (filter: AssetTypeFilter) => void;
  setAssetSearch: (query: string) => void;

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

  // Asset selectors
  getAssetUsages: (assetId: string) => AssetUsage[];
}

export interface AssetUsage {
  kind: 'scene_background' | 'layer_image' | 'hotspot_action' | 'scene_bgm' | 'scene_sfx';
  caseId: string;
  caseName: string;
  sceneId: string;
  sceneName: string;
  detail?: string;
}
