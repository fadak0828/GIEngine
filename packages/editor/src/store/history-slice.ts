import type { StateCreator } from 'zustand';
import type { EditorStore, HistorySnapshot, HistoryState } from './types.js';

const MAX_HISTORY = 50;

export const defaultHistory: HistoryState = {
  past: [],
  future: [],
};

// ── Slice type ───────────────────────────────────────────────────

export type HistorySlice = {
  history: HistoryState;
  pushToHistory: () => void;
  undo: () => void;
  redo: () => void;
};

// ── Slice creator ────────────────────────────────────────────────

export const createHistorySlice: StateCreator<EditorStore, [], [], HistorySlice> = (set, get) => ({
  history: defaultHistory,

  pushToHistory: () => {
    const { project, words, history } = get();
    if (!project) return;
    const snapshot: HistorySnapshot = { project, words };
    set({
      history: {
        past: [...history.past.slice(-(MAX_HISTORY - 1)), snapshot],
        future: [],
      },
    });
  },

  undo: () => {
    const state = get();
    if (state.history.past.length === 0) return;
    const past = [...state.history.past];
    const snapshot = past.pop()!;
    set({
      project: snapshot.project,
      words: snapshot.words,
      history: {
        past,
        future: [
          { project: state.project, words: state.words },
          ...state.history.future,
        ],
      },
      meta: { ...state.meta, isDirty: true },
    });
  },

  redo: () => {
    const state = get();
    if (state.history.future.length === 0) return;
    const future = [...state.history.future];
    const snapshot = future.shift()!;
    set({
      project: snapshot.project,
      words: snapshot.words,
      history: {
        past: [...state.history.past, { project: state.project, words: state.words }],
        future,
      },
      meta: { ...state.meta, isDirty: true },
    });
  },
});
