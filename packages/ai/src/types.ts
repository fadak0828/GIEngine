import type { AssetDefinition, LocalizedText, PuzzleTemplate, AnswerDefinition, Locale } from '@gi-engine/core';

// ── Background generation ────────────────────────────────────────

export type BackgroundStyle = 'realistic' | 'painterly' | 'pixel-art' | 'noir';
export type AspectRatio = '16:9' | '4:3' | '1:1';

export interface BackgroundGenerateRequest {
  sceneDescription: string;
  style?: BackgroundStyle;
  aspectRatio?: AspectRatio;
}

export interface BackgroundGenerateResult {
  asset: AssetDefinition;
  promptUsed: string;
}

// ── Story generation ─────────────────────────────────────────────

export interface StoryGenerateRequest {
  caseTitle: string;
  genre?: string;
  locale: Locale;
  hints?: string[];
}

export interface StoryGenerateResult {
  description: LocalizedText;
  suggestedSceneNames: LocalizedText[];
}

// ── Puzzle generation ────────────────────────────────────────────

export interface PuzzleGenerateRequest {
  caseTitle: string;
  caseDescription: string;
  wordBank: string[];
  locale: Locale;
}

export interface PuzzleGenerateResult {
  title: LocalizedText;
  template: PuzzleTemplate;
  answers: Record<string, AnswerDefinition>;
}
