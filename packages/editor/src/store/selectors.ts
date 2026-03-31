import { useEditorStore } from './editor-store.js';

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
