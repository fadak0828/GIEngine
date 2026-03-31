import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../src/store/editor-store';

function initStore() {
  useEditorStore.getState().newProject();
}

describe('Undo/Redo', () => {
  beforeEach(() => {
    initStore();
  });

  it('initial state has empty history', () => {
    const { history } = useEditorStore.getState();
    expect(history.past).toHaveLength(0);
    expect(history.future).toHaveLength(0);
  });

  it('pushToHistory saves current project snapshot', () => {
    const store = useEditorStore.getState();
    store.pushToHistory();
    expect(useEditorStore.getState().history.past).toHaveLength(1);
  });

  it('mutating actions (addAct) push to history', () => {
    useEditorStore.getState().addAct();
    expect(useEditorStore.getState().history.past).toHaveLength(1);
    expect(useEditorStore.getState().project?.acts).toHaveLength(1);
  });

  it('undo restores previous state', () => {
    const store = useEditorStore.getState();
    store.addAct();
    expect(useEditorStore.getState().project?.acts).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project?.acts).toHaveLength(0);
  });

  it('undo moves snapshot to future for redo', () => {
    useEditorStore.getState().addAct();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().history.future).toHaveLength(1);
  });

  it('redo restores undone state', () => {
    useEditorStore.getState().addAct();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project?.acts).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project?.acts).toHaveLength(1);
  });

  it('new mutation after undo clears future (redo stack)', () => {
    useEditorStore.getState().addAct();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().history.future).toHaveLength(1);

    // New mutation clears future
    useEditorStore.getState().addAct();
    expect(useEditorStore.getState().history.future).toHaveLength(0);
  });

  it('undo does nothing if history is empty', () => {
    const projectBefore = useEditorStore.getState().project;
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project).toBe(projectBefore);
  });

  it('redo does nothing if future is empty', () => {
    useEditorStore.getState().addAct();
    const projectBefore = useEditorStore.getState().project;
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project).toBe(projectBefore);
  });

  it('multiple undo/redo steps work correctly', () => {
    useEditorStore.getState().addAct();
    useEditorStore.getState().addAct();
    useEditorStore.getState().addAct();
    expect(useEditorStore.getState().project?.acts).toHaveLength(3);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project?.acts).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project?.acts).toHaveLength(1);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project?.acts).toHaveLength(2);
  });

  it('history is capped at MAX_HISTORY (50) entries', () => {
    for (let i = 0; i < 60; i++) {
      useEditorStore.getState().addAct();
    }
    expect(useEditorStore.getState().history.past.length).toBeLessThanOrEqual(50);
  });

  it('newProject clears history', () => {
    useEditorStore.getState().addAct();
    expect(useEditorStore.getState().history.past).toHaveLength(1);

    useEditorStore.getState().newProject();
    expect(useEditorStore.getState().history.past).toHaveLength(0);
    expect(useEditorStore.getState().history.future).toHaveLength(0);
  });

  it('loadProject clears history', () => {
    useEditorStore.getState().addAct();
    const def = useEditorStore.getState().project!;
    useEditorStore.getState().loadProject(def, []);
    expect(useEditorStore.getState().history.past).toHaveLength(0);
    expect(useEditorStore.getState().history.future).toHaveLength(0);
  });

  it('undo marks project as dirty', () => {
    useEditorStore.getState().addAct();
    // Reset dirty flag
    useEditorStore.setState(s => ({ meta: { ...s.meta, isDirty: false } }));

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().meta.isDirty).toBe(true);
  });
});
