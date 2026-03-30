import type { AssetDefinition, LocalizedText, PuzzleTemplate, AnswerDefinition, Locale } from '@gi-engine/core';

// ── Background generation ────────────────────────────────────────

export type BackgroundStyle = 'realistic' | 'painterly' | 'pixel-art' | 'noir';
export type AspectRatio = '16:9' | '4:3' | '1:1';

export interface BackgroundGenerateRequest {
  sceneDescription: string;
  style?: BackgroundStyle;
  aspectRatio?: AspectRatio;
  /** Rich game context for higher-quality prompt generation */
  gameContext?: GameContextForPrompt;
}

export interface HotspotPromptInfo {
  id: string;
  label: string;
  positionZone: string;
  relativeSize: 'small' | 'medium' | 'large';
  /** Pixel position of bounding box center */
  position: { x: number; y: number };
  /** Pixel size of bounding box */
  size: { width: number; height: number };
  /** What the hotspot does: examine, examine_image, word_reveal, navigate, toggle_layer, composite */
  actionType: string;
  /** Examine text content or caption, if available */
  contentHint?: string;
  /** Word displays revealed by this hotspot */
  revealedWords?: string[];
}

export interface GameContextForPrompt {
  gameTitle?: string;
  gameDescription?: string;
  caseTitle: string;
  caseDescription: string;
  sceneName: string;
  /** Other scene names in this case, for spatial relationship awareness */
  siblingSceneNames?: string[];
  hotspots: HotspotPromptInfo[];
  /** Words (clues) that can be found in this scene */
  sceneWords?: Array<{ display: string; category?: string }>;
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
