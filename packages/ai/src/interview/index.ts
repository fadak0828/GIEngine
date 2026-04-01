/**
 * Public API for @gi-engine/ai interview module
 *
 * @deprecated InterviewEngine based workflow is superseded by QuickCreateEngine.
 * This module only exports CaseBlueprint types used by the Quick Create pipeline.
 * - Blueprint types: CaseBlueprint, BlueprintScene, BlueprintWord, BlueprintCharacter, BlueprintHotspotHint
 * - Use packages/ai/src/quick-create/ for case generation.
 * - Use packages/ai/src/interview/blueprint-converter.ts for CaseBlueprint → Case conversion.
 */

// Re-export CaseBlueprint types (used by Quick Create, Regenerator, BlueprintConverter)
export type {
  CaseBlueprint,
  BlueprintScene,
  BlueprintWord,
  BlueprintCharacter,
  BlueprintHotspotHint,
} from './types.js';
