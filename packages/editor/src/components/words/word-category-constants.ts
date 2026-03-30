import type { WordCategory } from '@gi-engine/core';

export const WORD_CATEGORIES: WordCategory[] = [
  'person',
  'place',
  'object',
  'action',
  'time',
  'motive',
  'evidence',
];

export const CATEGORY_LABELS: Record<string, string> = {
  person: '인물',
  place: '장소',
  object: '사물',
  action: '행동',
  time: '시간',
  motive: '동기',
  evidence: '증거',
};

export const CATEGORY_COLORS: Record<string, string> = {
  person: '#3b82f6',
  place: '#10b981',
  object: '#f59e0b',
  action: '#ef4444',
  time: '#8b5cf6',
  motive: '#ec4899',
  evidence: '#6b7280',
};
