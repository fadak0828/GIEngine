/**
 * quick-create-slice.ts — Quick Create 상태 관리
 * Phase 3 (FADAA-59)
 *
 * 1문장 입력 → 사건 블루프린트 생성 + 선택지 UI의 상태
 */

import type { StateCreator } from 'zustand';
import type { EditorStore } from './types.js';
import type { CaseBlueprintState } from './interview-slice.js';

// ── 타입 ──────────────────────────────────────────────────────────

export interface ChoiceItem {
  id: string;
  label: string;
  summary: string;
}

export interface SectionChoices {
  characters: ChoiceItem[];
  scenes: ChoiceItem[];
  puzzleStructure: ChoiceItem[];
  atmosphere: ChoiceItem[];
}

export interface ChoiceSelection {
  [key: string]: string | undefined;
  characters?: string;
  scenes?: string;
  puzzleStructure?: string;
  atmosphere?: string;
}

export interface QuickCreateProgressState {
  step: string;
  percent: number;
}

export interface QuickCreateState {
  quickCreate: {
    open: boolean;
    targetActId: string | null;
    /** 1=입력, 2=선택지, 3=생성 진행 */
    wizardStep: 1 | 2 | 3;
    sentence: string;
    genre: string;
    atmosphere: string;
    era: string;
    showAdvanced: boolean;
    isGenerating: boolean;
    error: string | null;
    blueprint: CaseBlueprintState | null;
    choices: SectionChoices | null;
    selection: ChoiceSelection;
    progress: QuickCreateProgressState | null;
    blueprintPreviewOpen: boolean;
  };
}

export interface QuickCreateActions {
  openQuickCreate: (targetActId?: string) => void;
  closeQuickCreate: () => void;
  resetQuickCreate: () => void;
  setQuickCreateSentence: (sentence: string) => void;
  setQuickCreateGenre: (genre: string) => void;
  setQuickCreateAtmosphere: (atmosphere: string) => void;
  setQuickCreateEra: (era: string) => void;
  toggleQuickCreateAdvanced: () => void;
  setQuickCreateWizardStep: (step: 1 | 2 | 3) => void;
  setQuickCreateGenerating: (isGenerating: boolean) => void;
  setQuickCreateError: (error: string | null) => void;
  setQuickCreateBlueprint: (blueprint: CaseBlueprintState | null) => void;
  setQuickCreateChoices: (choices: SectionChoices | null) => void;
  setQuickCreateSelection: (selection: Partial<ChoiceSelection>) => void;
  setQuickCreateProgress: (progress: QuickCreateProgressState | null) => void;
  openQuickCreateBlueprintPreview: () => void;
  closeQuickCreateBlueprintPreview: () => void;
  /**
   * 생성된 블루프린트를 에디터에 적용합니다.
   * interview-slice의 applyBlueprintToEditor를 재사용합니다.
   */
  applyQuickCreateBlueprintToEditor: (actId: string, generateBackgrounds?: boolean) => Promise<void>;
}

export type QuickCreateSlice = QuickCreateState & QuickCreateActions;

// ── 초기값 ────────────────────────────────────────────────────────

const initialQuickCreateState: QuickCreateState['quickCreate'] = {
  open: false,
  targetActId: null,
  wizardStep: 1,
  sentence: '',
  genre: '',
  atmosphere: '',
  era: '',
  showAdvanced: false,
  isGenerating: false,
  error: null,
  blueprint: null,
  choices: null,
  selection: {},
  progress: null,
  blueprintPreviewOpen: false,
};

// ── Slice 팩토리 ──────────────────────────────────────────────────

export const createQuickCreateSlice: StateCreator<EditorStore, [], [], QuickCreateSlice> = (
  set,
  get,
) => ({
  quickCreate: { ...initialQuickCreateState },

  openQuickCreate: (targetActId?: string) =>
    set(s => ({
      quickCreate: {
        ...initialQuickCreateState,
        open: true,
        targetActId: targetActId ?? s.selection.actId ?? null,
      },
    })),

  closeQuickCreate: () =>
    set(s => ({ quickCreate: { ...s.quickCreate, open: false } })),

  resetQuickCreate: () =>
    set({ quickCreate: { ...initialQuickCreateState } }),

  setQuickCreateSentence: (sentence) =>
    set(s => ({ quickCreate: { ...s.quickCreate, sentence } })),

  setQuickCreateGenre: (genre) =>
    set(s => ({ quickCreate: { ...s.quickCreate, genre } })),

  setQuickCreateAtmosphere: (atmosphere) =>
    set(s => ({ quickCreate: { ...s.quickCreate, atmosphere } })),

  setQuickCreateEra: (era) =>
    set(s => ({ quickCreate: { ...s.quickCreate, era } })),

  toggleQuickCreateAdvanced: () =>
    set(s => ({
      quickCreate: { ...s.quickCreate, showAdvanced: !s.quickCreate.showAdvanced },
    })),

  setQuickCreateWizardStep: (wizardStep) =>
    set(s => ({ quickCreate: { ...s.quickCreate, wizardStep } })),

  setQuickCreateGenerating: (isGenerating) =>
    set(s => ({ quickCreate: { ...s.quickCreate, isGenerating } })),

  setQuickCreateError: (error) =>
    set(s => ({ quickCreate: { ...s.quickCreate, error } })),

  setQuickCreateBlueprint: (blueprint) =>
    set(s => ({ quickCreate: { ...s.quickCreate, blueprint } })),

  setQuickCreateChoices: (choices) =>
    set(s => ({ quickCreate: { ...s.quickCreate, choices } })),

  setQuickCreateSelection: (patch) =>
    set(s => ({
      quickCreate: {
        ...s.quickCreate,
        selection: { ...s.quickCreate.selection, ...patch },
      },
    })),

  setQuickCreateProgress: (progress) =>
    set(s => ({ quickCreate: { ...s.quickCreate, progress } })),

  openQuickCreateBlueprintPreview: () => {
    const { quickCreate, setBlueprint, openBlueprintPreview } = get();
    if (!quickCreate.blueprint) return;
    // Sync blueprint to interview state so CaseBlueprintPreview can read it
    setBlueprint(quickCreate.blueprint);
    // Open the interview preview modal (not the quick-create-specific one)
    openBlueprintPreview();
  },

  closeQuickCreateBlueprintPreview: () =>
    set(s => ({ quickCreate: { ...s.quickCreate, blueprintPreviewOpen: false } })),

  applyQuickCreateBlueprintToEditor: async (actId, generateBackgrounds = false) => {
    const { quickCreate, setBlueprint, applyBlueprintToEditor } = get();
    if (!quickCreate.blueprint) return;

    // interview-slice의 applyBlueprintToEditor를 재사용
    setBlueprint(quickCreate.blueprint);
    await applyBlueprintToEditor(actId, generateBackgrounds);

    // 완료 후 닫기
    set({ quickCreate: { ...initialQuickCreateState } });
  },
});
