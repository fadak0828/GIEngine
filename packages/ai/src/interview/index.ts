// Public API for @gi-engine/ai interview module

export { InterviewEngine, interviewEngine } from './interview-engine.js';

export type {
  InterviewSession,
  InterviewMessage,
  InterviewStageMeta,
  CollectedCaseInfo,
  CaseOverviewInfo,
  CorePlotInfo,
  CharacterProfile,
  LocationProfile,
  EvidenceItem,
  PuzzleOutlineInfo,
  CaseBlueprint,
  BlueprintScene,
  BlueprintWord,
  BlueprintCharacter,
  BlueprintHotspotHint,
  SufficiencyScore,
  ProcessMessageResult,
} from './types.js';

export { InterviewStage, STAGE_META, INTERVIEW_STAGE_ORDER } from './types.js';

export {
  evaluateSufficiency,
  createSufficiencyScoreFromAI,
  mergeCollectedInfo,
} from './sufficiency-evaluator.js';
