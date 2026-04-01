/**
 * AI 인터뷰 엔진 타입 정의
 * FADAA-40 아키텍처 설계 기반
 */

import type { Locale, LocalizedText, WordCategory } from '@gi-engine/core';

// ─── 인터뷰 단계 ────────────────────────────────────────────────────────────

export enum InterviewStage {
  CASE_OVERVIEW = 'case_overview',
  CORE_PLOT = 'core_plot',
  CHARACTERS = 'characters',
  LOCATIONS = 'locations',
  EVIDENCE = 'evidence',
  PUZZLE_STRUCTURE = 'puzzle_structure',
  GENERATING = 'generating',
  COMPLETED = 'completed',
}

export interface InterviewStageMeta {
  stage: InterviewStage;
  label: LocalizedText;
  description: string;
  requiredFields: string[];
  minExchanges: number;
  sufficiencyThreshold: number;
  maxFollowUps: number;
}

/** 단계별 메타데이터 (순서 보장) */
export const STAGE_META: Record<InterviewStage, InterviewStageMeta> = {
  [InterviewStage.CASE_OVERVIEW]: {
    stage: InterviewStage.CASE_OVERVIEW,
    label: { ko: '사건 개요', en: 'Case Overview' },
    description: '장르, 배경, 분위기, 시대를 수집합니다.',
    requiredFields: ['genre', 'setting', 'era'],
    minExchanges: 2,
    sufficiencyThreshold: 60,
    maxFollowUps: 5,
  },
  [InterviewStage.CORE_PLOT]: {
    stage: InterviewStage.CORE_PLOT,
    label: { ko: '핵심 줄거리', en: 'Core Plot' },
    description: '사건 내용, 진범, 동기를 수집합니다.',
    requiredFields: ['incidentSummary', 'culprit', 'motive'],
    minExchanges: 3,
    sufficiencyThreshold: 70,
    maxFollowUps: 5,
  },
  [InterviewStage.CHARACTERS]: {
    stage: InterviewStage.CHARACTERS,
    label: { ko: '등장인물', en: 'Characters' },
    description: '인물 프로필, 관계도, 알리바이를 수집합니다.',
    requiredFields: ['characters'],
    minExchanges: 3,
    sufficiencyThreshold: 70,
    maxFollowUps: 5,
  },
  [InterviewStage.LOCATIONS]: {
    stage: InterviewStage.LOCATIONS,
    label: { ko: '장소/씬', en: 'Locations/Scenes' },
    description: '장소 설명, 연결 관계, 발견 가능 단서를 수집합니다.',
    requiredFields: ['locations'],
    minExchanges: 2,
    sufficiencyThreshold: 60,
    maxFollowUps: 5,
  },
  [InterviewStage.EVIDENCE]: {
    stage: InterviewStage.EVIDENCE,
    label: { ko: '증거/단서', en: 'Evidence/Clues' },
    description: '물증, 증언, 모순점을 수집합니다.',
    requiredFields: ['evidence'],
    minExchanges: 2,
    sufficiencyThreshold: 60,
    maxFollowUps: 5,
  },
  [InterviewStage.PUZZLE_STRUCTURE]: {
    stage: InterviewStage.PUZZLE_STRUCTURE,
    label: { ko: '퍼즐 구성', en: 'Puzzle Structure' },
    description: '주요 퍼즐, 서브 퍼즐 연결을 수집합니다.',
    requiredFields: ['puzzle'],
    minExchanges: 2,
    sufficiencyThreshold: 50,
    maxFollowUps: 5,
  },
  [InterviewStage.GENERATING]: {
    stage: InterviewStage.GENERATING,
    label: { ko: '사건 생성 중', en: 'Generating' },
    description: '수집된 정보로 사건을 생성합니다.',
    requiredFields: [],
    minExchanges: 0,
    sufficiencyThreshold: 0,
    maxFollowUps: 0,
  },
  [InterviewStage.COMPLETED]: {
    stage: InterviewStage.COMPLETED,
    label: { ko: '완료', en: 'Completed' },
    description: '사건 생성이 완료되었습니다.',
    requiredFields: [],
    minExchanges: 0,
    sufficiencyThreshold: 0,
    maxFollowUps: 0,
  },
};

/** 인터뷰 단계 진행 순서 */
export const INTERVIEW_STAGE_ORDER: InterviewStage[] = [
  InterviewStage.CASE_OVERVIEW,
  InterviewStage.CORE_PLOT,
  InterviewStage.CHARACTERS,
  InterviewStage.LOCATIONS,
  InterviewStage.EVIDENCE,
  InterviewStage.PUZZLE_STRUCTURE,
];

// ─── 수집 정보 구조 ──────────────────────────────────────────────────────────

export interface CaseOverviewInfo {
  title?: string;
  genre?: string;
  setting?: string;
  atmosphere?: string;
  era?: string;
}

export interface CorePlotInfo {
  incidentSummary?: string;
  culprit?: string;
  motive?: string;
  method?: string;
  victimName?: string;
}

export interface CharacterProfile {
  name: string;
  role: 'culprit' | 'victim' | 'witness' | 'suspect';
  description?: string;
  alibi?: string;
  relationships?: Record<string, string>;
}

export interface LocationProfile {
  name: string;
  description?: string;
  connections?: string[];
  discoverableClues?: string[];
}

export interface EvidenceItem {
  type: 'physical' | 'testimony' | 'contradiction';
  description: string;
  relatedCharacter?: string;
  relatedLocation?: string;
  isKeyEvidence?: boolean;
}

export interface PuzzleOutlineInfo {
  mainPuzzleHint?: string;
  keyWords?: string[];
  subPuzzleTypes?: Array<'character_id' | 'scenario' | 'timeline' | 'relationship'>;
}

export interface CollectedCaseInfo {
  overview?: CaseOverviewInfo;
  corePlot?: CorePlotInfo;
  characters?: CharacterProfile[];
  locations?: LocationProfile[];
  evidence?: EvidenceItem[];
  puzzle?: PuzzleOutlineInfo;
}

// ─── 메시지 & 세션 ────────────────────────────────────────────────────────────

export interface InterviewMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: number;
  stage: InterviewStage;
  metadata?: {
    questionType: 'initial' | 'follow_up' | 'sufficiency_check';
    extractedData?: Partial<CollectedCaseInfo>;
  };
}

export interface SufficiencyScore {
  stage: InterviewStage;
  score: number;
  isComplete: boolean;
  reason?: string;
}

export interface InterviewSession {
  id: string;
  status: 'active' | 'paused' | 'generating' | 'completed' | 'error';
  currentStage: InterviewStage;
  completedStages: InterviewStage[];
  messages: InterviewMessage[];
  collectedInfo: CollectedCaseInfo;
  sufficiencyScores: Partial<Record<InterviewStage, number>>;
  followUpCounts: Partial<Record<InterviewStage, number>>;
  locale: Locale;
  createdAt: number;
  updatedAt: number;
  targetActId?: string;
}

// ─── CaseBlueprint ───────────────────────────────────────────────────────────

export interface BlueprintHotspotHint {
  label: string;
  actionType: 'examine' | 'examine_image' | 'word_reveal' | 'navigate';
  contentHint: string;
  /** 16:9 기준 정규화된 위치 (0~1). AI가 제안한 위치. */
  positionHint?: {
    x: number; // 0=left, 1=right
    y: number; // 0=top, 1=bottom
    description?: string; // 위치 설명 (예: "왼쪽 상단 근처")
  };
  relatedWordId?: string;
}

export interface BlueprintScene {
  tempId: string;
  name: LocalizedText;
  description: string;
  connections: string[];
  hotspotHints: BlueprintHotspotHint[];
}

export interface BlueprintWord {
  tempId: string;
  display: LocalizedText;
  category: WordCategory;
  hint?: LocalizedText;
  sourceSceneTempId?: string;
}

export interface BlueprintCharacter {
  name: string;
  role: 'culprit' | 'victim' | 'witness' | 'suspect';
  description: string;
  alibi?: string;
  relationships: { targetName: string; relationship: string }[];
}

export interface CaseBlueprint {
  id: string;
  sessionId: string;
  generatedAt: number;
  title: LocalizedText;
  description: LocalizedText;
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
    type: 'character_id' | 'scenario' | 'timeline' | 'relationship';
    description: string;
    characterNames?: string[];
    events?: string[];
  }[];
}

// ─── processUserMessage 결과 ─────────────────────────────────────────────────

export interface ProcessMessageResult {
  updatedSession: InterviewSession;
  aiMessage: InterviewMessage;
  stageAdvanced: boolean;
  isCompleted: boolean;
}
