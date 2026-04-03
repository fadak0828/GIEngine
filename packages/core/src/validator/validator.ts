import type {
  Puzzle,
  SubPuzzle,
  CharacterIdPuzzle,
  TimelinePuzzle,
  RelationshipPuzzle,
  ScenarioPuzzle,
  ValidationResult,
  AnswerDefinition,
  PuzzleTemplate,
} from '../models/types.js';

export type { ValidationResult };

/**
 * 빈칸 채우기 퍼즐 검증.
 * 순수 함수: 퍼즐 정의 + 현재 배치 → 검증 결과.
 */
export function validateFillInBlank(
  answers: Record<string, AnswerDefinition>,
  assignments: Record<string, string | null>,
  template?: PuzzleTemplate
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

  const result: ValidationResult = { allCorrect, slotResults };

  if (template?.sections?.length && template.segments) {
    result.segmentResults = {};
    for (const section of template.sections) {
      const slotIds = template.segments
        .filter((s): s is { type: 'slot'; slotId: string; sectionId: string } => s.type === 'slot' && s.sectionId === section.id)
        .map(s => s.slotId);
      const correct = slotIds.filter(id => slotResults[id] === 'correct').length;
      result.segmentResults[section.id] = { correct, total: slotIds.length };
    }
  }

  return result;
}

/**
 * 메인 퍼즐 검증 (fill_in_blank 타입)
 */
export function validatePuzzle(
  puzzle: Puzzle,
  assignments: Record<string, string | null>
): ValidationResult {
  return validateFillInBlank(puzzle.answers, assignments, puzzle.template);
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

  // 충돌 감지: 동일한 단어가 여러 슬롯에 배정된 경우
  const assignedWords = Object.values(assignments).filter((w): w is string => w !== null);
  const wordCount = new Map<string, number>();
  for (const word of assignedWords) {
    wordCount.set(word, (wordCount.get(word) ?? 0) + 1);
  }
  const duplicateWords = new Set<string>(
    [...wordCount.entries()].filter(([, count]) => count > 1).map(([word]) => word)
  );

  for (const slot of puzzle.slots) {
    const assigned = assignments[slot.slotId];
    if (!assigned) {
      slotResults[slot.slotId] = 'incorrect';
    } else if (duplicateWords.has(assigned)) {
      // 같은 단어가 다른 슬롯에도 배정된 경우 충돌 → incorrect
      slotResults[slot.slotId] = 'incorrect';
    } else {
      slotResults[slot.slotId] = assigned === slot.answerId ? 'correct' : 'incorrect';
    }
  }

  const allCorrect = Object.values(slotResults).every(r => r === 'correct');
  return { allCorrect, slotResults };
}

function validateRelationship(
  puzzle: RelationshipPuzzle,
  assignments: Record<string, string | null>
): ValidationResult {
  const slotResults: Record<string, 'correct' | 'partial' | 'incorrect'> = {};

  // 모든 슬롯 초기화 (답 체크)
  for (const edge of puzzle.edges) {
    const assigned = assignments[edge.slotId];
    slotResults[edge.slotId] = assigned === edge.answerId ? 'correct' : 'incorrect';
  }

  // 대칭 검증: symmetric: true인 엣지는 역방향 엣지와 동일한 단어가 배정되어야 함
  for (const edge of puzzle.edges) {
    if (!edge.symmetric) continue;

    const reverseEdge = puzzle.edges.find(
      e => e.fromNodeId === edge.toNodeId && e.toNodeId === edge.fromNodeId
    );
    if (!reverseEdge) continue;

    const assigned = assignments[edge.slotId];
    const reverseAssigned = assignments[reverseEdge.slotId];

    // 둘 다 배정됐지만 서로 다른 경우 → 대칭 위반
    if (assigned !== null && reverseAssigned !== null && assigned !== reverseAssigned) {
      slotResults[edge.slotId] = 'incorrect';
      slotResults[reverseEdge.slotId] = 'incorrect';
    }
  }

  const allCorrect = Object.values(slotResults).every(r => r === 'correct');
  return { allCorrect, slotResults };
}
