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

export interface InterviewState {
  interview: {
    open: boolean;
    targetActId: string | null;
    session: InterviewSessionState | null;
    isLoading: boolean;
    error: string | null;
    blueprint: CaseBlueprintState | null;
    blueprintPreviewOpen: boolean;
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
};

// ── Slice 팩토리 ──────────────────────────────────────────────────

export const createInterviewSlice: StateCreator<EditorStore, [], [], InterviewSlice> = (set) => ({
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
});
