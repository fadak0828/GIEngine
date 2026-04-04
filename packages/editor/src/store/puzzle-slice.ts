import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type {
  Puzzle,
  SubPuzzle,
  PuzzleTemplate,
  AnswerDefinition,
  PuzzleSet,
  Hint,
  HintConfig,
} from '@gi-engine/core';
import type { EditorStore } from './types.js';
import { genId } from './utils.js';
import { findCaseInDraft } from './scene-slice.js';

// ── Factory helpers ───────────────────────────────────────────────

export function makeDefaultPuzzleSet(): PuzzleSet {
  return {
    main: {
      id: genId('puzzle'),
      title: { ko: '새 퍼즐', en: 'New Puzzle' },
      type: 'fill_in_blank',
      template: { segments: [] },
      answers: {},
    },
    sub: [],
  };
}

// ── Slice type ───────────────────────────────────────────────────

export type PuzzleSlice = {
  updateMainPuzzle: (caseId: string, patch: Partial<Puzzle>) => void;
  updatePuzzleTemplate: (caseId: string, template: PuzzleTemplate) => void;
  updatePuzzleAnswers: (caseId: string, answers: Record<string, AnswerDefinition>) => void;
  updatePuzzleHints: (caseId: string, hints: Hint[]) => void;
  updatePuzzleHintConfig: (caseId: string, hintConfig: HintConfig | undefined) => void;
  addSubPuzzle: (caseId: string, type: SubPuzzle['type']) => void;
  updateSubPuzzle: (caseId: string, puzzleId: string, patch: Partial<SubPuzzle>) => void;
  deleteSubPuzzle: (caseId: string, puzzleId: string) => void;
};

// ── Slice creator ────────────────────────────────────────────────

export const createPuzzleSlice: StateCreator<EditorStore, [], [], PuzzleSlice> = (set, get) => ({

  updateMainPuzzle: (caseId, patch) => {
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) Object.assign(c.puzzles.main, patch);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updatePuzzleTemplate: (caseId, template) => {
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.main.template = template;
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updatePuzzleAnswers: (caseId, answers) => {
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.main.answers = answers;
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updatePuzzleHints: (caseId, hints) => {
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.main.hints = hints;
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updatePuzzleHintConfig: (caseId, hintConfig) => {
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.main.hintConfig = hintConfig;
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  addSubPuzzle: (caseId, type) => {
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      let newSub: SubPuzzle;
      const baseId = genId('subpuzzle');
      if (type === 'character_id') {
        newSub = { id: baseId, title: { ko: '캐릭터 ID', en: 'Character ID' }, type: 'character_id', characters: [] };
      } else if (type === 'timeline') {
        newSub = { id: baseId, title: { ko: '타임라인', en: 'Timeline' }, type: 'timeline', slots: [] };
      } else if (type === 'scenario') {
        newSub = { id: baseId, title: { ko: '시나리오', en: 'Scenario' }, type: 'scenario', template: { segments: [] }, answers: {} };
      } else {
        newSub = { id: baseId, title: { ko: '관계도', en: 'Relationship' }, type: 'relationship', nodes: [], edges: [] };
      }
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.sub.push(newSub);
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  updateSubPuzzle: (caseId, puzzleId, patch) => {
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) {
            const sub = c.puzzles.sub.find(p => p.id === puzzleId);
            if (sub) Object.assign(sub, patch);
          }
        }),
        meta: { ...state.meta, isDirty: true },
      };
    });
  },

  deleteSubPuzzle: (caseId, puzzleId) => {
    get().pushToHistory();
    set(state => {
      if (!state.project) return state;
      return {
        project: produce(state.project, draft => {
          const c = findCaseInDraft(draft, caseId);
          if (c) c.puzzles.sub = c.puzzles.sub.filter(p => p.id !== puzzleId);
        }),
        meta: { ...state.meta, isDirty: true },
        selection: state.selection.subPuzzleId === puzzleId
          ? { ...state.selection, subPuzzleId: null }
          : state.selection,
      };
    });
  },
});
