import { useEditorStore } from './editor-store.js';
import type { Scene } from '@gi-engine/core';

export function useProject() {
  return useEditorStore(s => s.project);
}

export function useSelection() {
  return useEditorStore(s => s.selection);
}

export function useUI() {
  return useEditorStore(s => s.ui);
}

export function useWords() {
  return useEditorStore(s => s.words);
}

export function useCanUndo() {
  return useEditorStore(s => s.history.past.length > 0);
}

export function useCanRedo() {
  return useEditorStore(s => s.history.future.length > 0);
}

// ── Granular selectors (avoid re-renders from unrelated state changes) ────

export function useEditorLocale() {
  return useEditorStore(s => s.ui.editorLocale);
}

export function usePreviewLocale() {
  return useEditorStore(s => s.ui.previewLocale);
}

export function useActivePanel() {
  return useEditorStore(s => s.ui.activePanel);
}

export function useSceneTool() {
  return useEditorStore(s => s.ui.sceneTool);
}

export function useSelectedCaseId() {
  return useEditorStore(s => s.selection.caseId);
}

export function useSelectedSceneId() {
  return useEditorStore(s => s.selection.sceneId);
}

export function useSelectedHotspotId() {
  return useEditorStore(s => s.selection.hotspotId);
}

export function useSelectedPuzzleId() {
  return useEditorStore(s => s.selection.puzzleId);
}

/** Returns the currently selected Scene object, or null if none selected. */
export function useSelectedScene(): Scene | null {
  return useEditorStore(s => {
    const { project } = s;
    const { caseId, sceneId } = s.selection;
    if (!project || !caseId || !sceneId) return null;
    for (const act of project.acts) {
      const c = act.cases.find(cs => cs.id === caseId);
      if (c) return c.scenes.find(sc => sc.id === sceneId) ?? null;
    }
    return null;
  });
}
