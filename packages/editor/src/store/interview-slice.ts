/**
 * interview-slice.ts — AI 인터뷰 세션 상태 관리
 * Phase 5b (FADAA-44)
 */

import type { StateCreator } from 'zustand';
import type { EditorStore } from './types.js';

// ── 인터뷰 관련 타입 (ai 패키지 인라인) ─────────────────────────────

export interface InterviewMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: number;
  stage: string;
  metadata?: {
    questionType: 'initial' | 'follow_up' | 'sufficiency_check';
  };
}

export interface InterviewSessionState {
  id: string;
  status: 'active' | 'paused' | 'generating' | 'completed' | 'error';
  currentStage: string;
  completedStages: string[];
  messages: InterviewMessage[];
  sufficiencyScores: Record<string, number>;
  followUpCounts: Record<string, number>;
  locale: string;
  createdAt: number;
  updatedAt: number;
  targetActId?: string;
}

export interface BlueprintHotspotHint {
  label: string;
  actionType: string;
  contentHint: string;
  relatedWordId?: string;
}

export interface BlueprintScene {
  tempId: string;
  name: { ko: string; en: string };
  description: string;
  connections: string[];
  hotspotHints: BlueprintHotspotHint[];
}

export interface BlueprintWord {
  tempId: string;
  display: { ko: string; en: string };
  category: string;
  hint?: { ko: string; en: string };
  sourceSceneTempId?: string;
}

export interface BlueprintCharacter {
  name: string;
  role: string;
  description: string;
  alibi?: string;
  relationships: { targetName: string; relationship: string }[];
}

export interface CaseBlueprintState {
  id: string;
  sessionId: string;
  generatedAt: number;
  title: { ko: string; en: string };
  description: { ko: string; en: string };
  genre: string;
  characters: BlueprintCharacter[];
  scenes: BlueprintScene[];
  words: BlueprintWord[];
  mainPuzzle: {
    titleHint: string;
    descriptionHint: string;
    templateDescription: string;
    requiredWordTempIds: string[];
  };
  subPuzzles: {
    type: string;
    description: string;
    characterNames?: string[];
    events?: string[];
  }[];
}

// ── Slice 상태 ────────────────────────────────────────────────────

export interface GenerationProgressState {
  step: string;
  percent: number;
}

export interface InterviewState {
  interview: {
    open: boolean;
    targetActId: string | null;
    session: InterviewSessionState | null;
    isLoading: boolean;
    error: string | null;
    blueprint: CaseBlueprintState | null;
    blueprintPreviewOpen: boolean;
    /** 케이스 생성 진행 상태 (null = 생성 중 아님) */
    generationProgress: GenerationProgressState | null;
  };
}

export interface InterviewActions {
  openInterview: (targetActId?: string) => void;
  closeInterview: () => void;
  setInterviewSession: (session: InterviewSessionState | null) => void;
  setInterviewLoading: (loading: boolean) => void;
  setInterviewError: (error: string | null) => void;
  setBlueprint: (blueprint: CaseBlueprintState | null) => void;
  openBlueprintPreview: () => void;
  closeBlueprintPreview: () => void;
  resetInterview: () => void;
  setGenerationProgress: (progress: GenerationProgressState | null) => void;
  /**
   * blueprint을 게임 데이터로 변환하고 에디터에 적용합니다.
   * @param actId 케이스를 추가할 Act ID
   * @param generateBackgrounds 씬 배경 이미지를 AI로 생성할지 여부
   */
  applyBlueprintToEditor: (actId: string, generateBackgrounds?: boolean) => Promise<void>;
}

export type InterviewSlice = InterviewState & InterviewActions;

// ── 초기값 ────────────────────────────────────────────────────────

const initialInterviewState: InterviewState['interview'] = {
  open: false,
  targetActId: null,
  session: null,
  isLoading: false,
  error: null,
  blueprint: null,
  blueprintPreviewOpen: false,
  generationProgress: null,
};

// ── Slice 팩토리 ──────────────────────────────────────────────────

export const createInterviewSlice: StateCreator<EditorStore, [], [], InterviewSlice> = (set, get) => ({
  interview: { ...initialInterviewState },

  openInterview: (targetActId?: string) =>
    set((s) => ({
      interview: {
        ...s.interview,
        open: true,
        targetActId: targetActId ?? null,
        session: null,
        error: null,
        blueprint: null,
        blueprintPreviewOpen: false,
      },
    })),

  closeInterview: () =>
    set((s) => ({
      interview: { ...s.interview, open: false },
    })),

  setInterviewSession: (session) =>
    set((s) => ({
      interview: { ...s.interview, session },
    })),

  setInterviewLoading: (isLoading) =>
    set((s) => ({
      interview: { ...s.interview, isLoading },
    })),

  setInterviewError: (error) =>
    set((s) => ({
      interview: { ...s.interview, error },
    })),

  setBlueprint: (blueprint) =>
    set((s) => ({
      interview: { ...s.interview, blueprint },
    })),

  openBlueprintPreview: () =>
    set((s) => ({
      interview: { ...s.interview, blueprintPreviewOpen: true },
    })),

  closeBlueprintPreview: () =>
    set((s) => ({
      interview: { ...s.interview, blueprintPreviewOpen: false },
    })),

  resetInterview: () =>
    set(() => ({
      interview: { ...initialInterviewState },
    })),

  setGenerationProgress: (progress) =>
    set((s) => ({
      interview: { ...s.interview, generationProgress: progress },
    })),

  applyBlueprintToEditor: async (actId, generateBackgrounds = false) => {
    const state = get();
    const { blueprint } = state.interview;
    if (!blueprint) return;

    set((s) => ({
      interview: {
        ...s.interview,
        generationProgress: { step: '케이스 생성 준비 중...', percent: 5 },
        error: null,
      },
    }));

    try {
      const { convertBlueprintToGameData } = await import('@gi-engine/ai');

      const result = await convertBlueprintToGameData(
        blueprint as Parameters<typeof convertBlueprintToGameData>[0],
        {
          locale: 'ko',
          generateBackgrounds,
          onProgress: (p) =>
            set((s) => ({
              interview: { ...s.interview, generationProgress: p },
            })),
        },
      );

      set((s) => ({
        interview: { ...s.interview, generationProgress: { step: '에디터에 적용 중...', percent: 95 } },
      }));

      const store = get();

      // 케이스를 Act에 삽입
      store.insertCase(actId, result.case);

      // 단서어 등록
      for (const word of result.words) {
        store.addWord(word);
      }

      // 생성된 배경 에셋 등록
      for (const asset of result.generatedAssets) {
        store.addAsset(asset);
      }

      // 새 케이스 선택
      store.setSelection({ actId, caseId: result.case.id });
      store.showNotification('케이스가 생성되었습니다', 'success');

      // 100% 잠깐 표시 후 인터뷰 초기화
      set((s) => ({
        interview: { ...s.interview, generationProgress: { step: '완료!', percent: 100 } },
      }));
      await new Promise<void>((resolve) => setTimeout(resolve, 600));
      set(() => ({ interview: { ...initialInterviewState } }));
    } catch (e) {
      set((s) => ({
        interview: {
          ...s.interview,
          generationProgress: null,
          error: e instanceof Error ? e.message : '케이스 생성에 실패했습니다.',
        },
      }));
    }
  },
});
