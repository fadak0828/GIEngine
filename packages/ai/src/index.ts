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
