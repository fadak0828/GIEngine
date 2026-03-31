import type { SubPuzzle } from '@gi-engine/core';

export const SUB_PUZZLE_TYPE_LABELS: Record<SubPuzzle['type'], string> = {
  character_id: '인물',
  timeline: '타임라인',
  relationship: '관계',
  scenario: '시나리오',
};

export const SUB_PUZZLE_TYPE_ICONS: Record<SubPuzzle['type'], string> = {
  character_id: '🧑',
  timeline: '📅',
  relationship: '🔗',
  scenario: '📋',
};
