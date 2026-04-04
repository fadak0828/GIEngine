/**
 * Shared test helpers for editor package tests.
 *
 * Uses the canonical `defaultUI` and `defaultSelection` from the store
 * so that adding new fields to UIState / SelectionState never breaks tests.
 */
import { useEditorStore } from '../src/store/editor-store';
import { defaultUI, defaultSelection } from '../src/store/selection-slice';

/**
 * Reset the editor store to a clean initial state.
 *
 * Test-specific overrides (autoSave disabled, shorter interval) are applied
 * on top of the canonical defaults — if the defaults change, tests follow
 * automatically.
 */
export function resetStore() {
  useEditorStore.setState({
    project: null,
    words: [],
    meta: { filePath: null, isDirty: false, lastSavedAt: null },
    selection: { ...defaultSelection },
    ui: {
      ...defaultUI,
      // Test overrides: disable auto-save to avoid side-effects
      autoSaveEnabled: false,
      autoSaveIntervalMs: 30000,
    },
  });
}
