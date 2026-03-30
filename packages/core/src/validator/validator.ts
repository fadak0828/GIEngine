import type {
  Puzzle,
  SubPuzzle,
  CharacterIdPuzzle,
  TimelinePuzzle,
  RelationshipPuzzle,
  ScenarioPuzzle,
  ValidationResult,
  AnswerDefinition,
} from '../models/types.js';

/**
 * 빈칸 채우기 퍼즐 검증.
 * 순수 함수: 퍼즐 정의 + 현재 배치 → 검증 결과.
 */
export function validateFillInBlank(
  answers: Record<string, AnswerDefinition>,
  assignments: Record<string, string | null>
): ValidationResult {
  const slotResults: Record<string, 'correct' | 'partial' | 'incorrect'> = {};

  for (const [slotId, answer] of Object.entries(answers)) {
    const assigned = assignments[slotId];

    if (!assigned) {
      slotResults[slotId] = 'incorrect';
    } else if (assigned === answer.correctWordId) {
      slotResults[slotId] = 'correct';
    } else if (answer.partiallyCorrectWordIds?.includes(assigned)) {
      slotResults[slotId] = 'partial';
    } else {
      slotResults[slotId] = 'incorrect';
    }
  }

  const allCorrect = Object.values(slotResults).every(r => r === 'correct');

  return { allCorrect, slotResults };
}

/**
 * 메인 퍼즐 검증 (fill_in_blank 타입)
 */
export function validatePuzzle(
  puzzle: Puzzle,
  assignments: Record<string, string | null>
): ValidationResult {
  return validateFillInBlank(puzzle.answers, assignments);
}

/**
 * 서브 퍼즐 검증 (타입별 분기)
 */
export function validateSubPuzzle(
  puzzle: SubPuzzle,
  assignments: Record<string, string | null>
): ValidationResult {
  switch (puzzle.type) {
    case 'character_id':
      return validateCharacterId(puzzle, assignments);
    case 'scenario':
      return validateScenario(puzzle, assignments);
    case 'timeline':
      return validateTimeline(puzzle, assignments);
    case 'relationship':
      return validateRelationship(puzzle, assignments);
    default:
      return { allCorrect: false, slotResults: {} };
  }
}

function validateCharacterId(
  puzzle: CharacterIdPuzzle,
  assignments: Record<string, string | null>
): ValidationResult {
  const slotResults: Record<string, 'correct' | 'partial' | 'incorrect'> = {};

  for (const char of puzzle.characters) {
    const assigned = assignments[char.nameSlotId];
    slotResults[char.nameSlotId] = assigned === char.answerId ? 'correct' : 'incorrect';
  }

  const allCorrect = Object.values(slotResults).every(r => r === 'correct');
  return { allCorrect, slotResults };
}

function validateScenario(
  puzzle: ScenarioPuzzle,
  assignments: Record<string, string | null>
): ValidationResult {
  return validateFillInBlank(puzzle.answers, assignments);
}

function validateTimeline(
  puzzle: TimelinePuzzle,
  assignments: Record<string, string | null>
): ValidationResult {
  const slotResults: Record<string, 'correct' | 'partial' | 'incorrect'> = {};

  for (const slot of puzzle.slots) {
    const assigned = assignments[slot.slotId];
    slotResults[slot.slotId] = assigned === slot.answerId ? 'correct' : 'incorrect';
  }

  const allCorrect = Object.values(slotResults).every(r => r === 'correct');
  return { allCorrect, slotResults };
}

function validateRelationship(
  puzzle: RelationshipPuzzle,
  assignments: Record<string, string | null>
): ValidationResult {
  const slotResults: Record<string, 'correct' | 'partial' | 'incorrect'> = {};

  for (const edge of puzzle.edges) {
    const assigned = assignments[edge.slotId];
    slotResults[edge.slotId] = assigned === edge.answerId ? 'correct' : 'incorrect';
  }

  const allCorrect = Object.values(slotResults).every(r => r === 'correct');
  return { allCorrect, slotResults };
}
