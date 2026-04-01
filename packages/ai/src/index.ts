// Public API for @gi-engine/ai

export { GeminiClient, geminiClient, TEXT_MODELS, IMAGE_MODELS } from './client.js';

export type {
  BackgroundStyle,
  AspectRatio,
  BackgroundGenerateRequest,
  BackgroundGenerateResult,
  GameContextForPrompt,
  HotspotPromptInfo,
  StoryGenerateRequest,
  StoryGenerateResult,
  PuzzleGenerateRequest,
  PuzzleGenerateResult,
} from './types.js';

export { generateBackground } from './generators/background-generator.js';
export { generateStory } from './generators/story-generator.js';
export { generatePuzzle } from './generators/puzzle-generator.js';

export { buildBackgroundPrompt, buildRichBackgroundPrompt } from './prompts/background-prompts.js';
export type {
  BackgroundPromptOptions,
  HotspotContext,
  ContextualBackgroundPromptOptions,
} from './prompts/background-prompts.js';
export {
  buildContextualBackgroundPrompt,
  computeHotspotContexts,
} from './prompts/background-prompts.js';
export { buildStoryPrompt } from './prompts/story-prompts.js';
export { buildPuzzlePrompt } from './prompts/puzzle-prompts.js';

// Interview module — legacy InterviewEngine workflow removed (FADAA-107)
// Quick Create module is the successor. Only CaseBlueprint types remain here.
export type {
  CaseBlueprint,
  BlueprintScene,
  BlueprintWord,
  BlueprintCharacter,
  BlueprintHotspotHint,
} from './interview/index.js';

// Case generator
export { generateCaseFromBlueprint } from './generators/case-generator.js';
export type { GenerateCaseResult } from './generators/case-generator.js';

// Blueprint converter (Phase 6)
export { convertBlueprintToGameData } from './interview/blueprint-converter.js';
export type {
  ConversionProgress,
  OnProgress,
  ConvertBlueprintOptions,
  ConvertBlueprintResult,
} from './interview/blueprint-converter.js';

// Quick Create module
export { QuickCreateEngine, quickCreateEngine, ChoiceGenerator, choiceGenerator } from './quick-create/index.js';
export type {
  QuickCreateOptions,
  QuickCreateResult,
  QuickCreateProgress,
  QuickCreateStep,
  OnQuickCreateProgress,
  SectionChoices,
  ChoiceItem,
  ChoiceSelection,
  StartFromSentenceOptions,
} from './quick-create/index.js';

// Quality system (Fun-Metric, Benchmark, Regeneration, Feedback)
export { funMetricScorer, FunMetricScorer } from './quality/index.js';
export type {
  FunMetricScore,
  FunMetricResult,
  ScoredBlueprint,
} from './quality/index.js';
export {
  submitFeedback,
  getFeedbacksForGame,
  getAverageRatingForGame,
  getAggregatedStats,
  clearAllFeedbacks,
  exportFeedbacksAsJson,
} from './quality/index.js';
export type { GameFeedback, FeedbackTag, AggregatedStats } from './quality/index.js';
export {
  regenerateScene,
  regenerateWord,
  regeneratePuzzle,
  regenerateFullBlueprint,
} from './quality/index.js';
export type { RegenerationResult } from './quality/index.js';
export {
  BENCHMARK_CORPUS,
  getBenchmarkById,
  getBenchmarksByDifficulty,
  getBenchmarksByGenre,
  compareWithGroundTruth,
} from './quality/index.js';
export type { BenchmarkCase, BenchmarkBlueprint } from './quality/index.js';
