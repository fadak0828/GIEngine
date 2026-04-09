const STORAGE_KEY = 'gi-editor-ui-v1';

export interface PersistedUIState {
  leftPanelWidth: number;
  rightPanelWidth: number;
  previewVisible: boolean;
  previewHeight: number;
  previewMode: 'scene' | 'case';
  editorLocale: string;
  previewLocale: string;
  gridSnapEnabled: boolean;
  gridSize: number;
  assetViewMode: 'grid' | 'list';
  assetTypeFilter: 'all' | 'image' | 'audio' | 'font';
  sceneTool: 'select' | 'draw_rect' | 'draw_polygon' | 'delete';
}

export function loadPersistedUI(): PersistedUIState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedUIState;
  } catch {
    return null;
  }
}

export function savePersistedUI(state: PersistedUIState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable
  }
}

export function extractPersistableUI(ui: import('./types.js').UIState): PersistedUIState {
  return {
    leftPanelWidth: ui.leftPanelWidth,
    rightPanelWidth: ui.rightPanelWidth,
    previewVisible: ui.previewVisible,
    previewHeight: ui.previewHeight,
    previewMode: ui.previewMode,
    editorLocale: ui.editorLocale,
    previewLocale: ui.previewLocale,
    gridSnapEnabled: ui.gridSnapEnabled,
    gridSize: ui.gridSize,
    assetViewMode: ui.assetViewMode,
    assetTypeFilter: ui.assetTypeFilter,
    sceneTool: ui.sceneTool,
  };
}
