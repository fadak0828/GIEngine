/**
 * Quick Create 엔진 타입 정의
 *
 * 1문장 입력으로 전체 CaseBlueprint를 생성하는 QuickCreateEngine의 타입들
 */

import type { Locale } from '@gi-engine/core';
import type { CaseBlueprint } from '../interview/types.js';

// ─── 입력 옵션 ───────────────────────────────────────────────────────────────

export interface QuickCreateOptions {
  /** 장르 힌트 (없으면 AI가 자동 선택) */
  genre?: 'mystery' | 'noir' | 'thriller' | 'historical' | 'fantasy';
  /** 분위기 힌트 (예: "어두운", "밝은", "긴장감 있는") */
  atmosphere?: string;
  /** 시대 힌트 (예: "현대", "1950년대", "조선시대") */
  era?: string;
  /** 생성 언어 */
  locale?: Locale;
}

// ─── 선택지 시스템 ────────────────────────────────────────────────────────────

/** 단일 섹션 선택지 항목 */
export interface ChoiceItem {
  id: string;
  label: string;
  summary: string;
}

/** 섹션별 4가지 선택지 모음 */
export interface SectionChoices {
  /** 캐릭터 구성 변형 4가지 */
  characters: ChoiceItem[];
  /** 씬 배치 변형 4가지 */
  scenes: ChoiceItem[];
  /** 퍼즐 구조 변형 4가지 */
  puzzleStructure: ChoiceItem[];
  /** 분위기/스타일 변형 4가지 */
  atmosphere: ChoiceItem[];
}

/** 사용자가 고른 선택 결과 */
export interface ChoiceSelection {
  characters?: string;     // ChoiceItem.id
  scenes?: string;
  puzzleStructure?: string;
  atmosphere?: string;
  customInputs?: Partial<Record<keyof SectionChoices, string>>;
}

// ─── 생성 결과 ───────────────────────────────────────────────────────────────

export interface QuickCreateResult {
  blueprint: CaseBlueprint;
  /** 선택지 포함 시 제공 (withChoices 옵션 사용 시) */
  choices?: SectionChoices;
}

// ─── 진행률 콜백 ─────────────────────────────────────────────────────────────

export type QuickCreateStep =
  | 'blueprint_generating'
  | 'blueprint_done'
  | 'choices_generating'
  | 'choices_done'
  | 'applying_selection'
  | 'completed';

export interface QuickCreateProgress {
  step: QuickCreateStep;
  message: string;
  /** 0~100 */
  percent: number;
}

export type OnQuickCreateProgress = (progress: QuickCreateProgress) => void;
