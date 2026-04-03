import type { AssetDefinition, LocalizedText, PuzzleTemplate, AnswerDefinition, Locale } from '@gi-engine/core';

// ── Background generation ────────────────────────────────────────

export type BackgroundStyle = 'realistic' | 'painterly' | 'pixel-art' | 'noir';
export type AspectRatio = '16:9' | '4:3' | '1:1';

export interface BackgroundGenerateRequest {
  sceneDescription: string;
  style?: BackgroundStyle;
  aspectRatio?: AspectRatio;
  /**
   * Whether to include human characters/figures in the background image.
   * - If `true`: a character is included (use `gameContext.characterHint` for description/placement)
   * - If `false`: no characters (default, backwards-compatible)
   * - If omitted: AI decides based on scene description and game context
   */
  includeCharacter?: boolean;
  /** Rich game context for higher-quality prompt generation */
  gameContext?: GameContextForPrompt;
}

export interface HotspotPromptInfo {
  id: string;
  label: string;
  positionZone: string;
  relativeSize: 'small' | 'medium' | 'large';
  /** What the hotspot does: examine, examine_image, word_reveal, navigate, toggle_layer, composite */
  actionType: string;
  /** Examine text content or caption, if available */
  contentHint?: string;
  /** Word displays revealed by this hotspot */
  revealedWords?: string[];
}

export interface CharacterHint {
  /** Brief description of the character to include in the scene (e.g. "a silhouetted detective", "a shadowy figure near the door") */
  description: string;
  /** Where the character should be placed */
  positionZone?: string;
  /** Relative size of the character in the scene */
  size?: 'small' | 'medium' | 'large';
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
  /** Optional character to include in the background image */
  characterHint?: CharacterHint;
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
