import { describe, it, expect } from 'vitest';
import { validatePuzzle, validateSubPuzzle, validateFillInBlank } from '../src/validator/validator.js';
import type { Puzzle, CharacterIdPuzzle, TimelinePuzzle } from '../src/models/types.js';

describe('ValidatorEngine', () => {
  describe('validateFillInBlank', () => {
    const answers = {
      'slot-1': { correctWordId: 'word-a', partiallyCorrectWordIds: ['word-b'] },
      'slot-2': { correctWordId: 'word-c' },
    };

    it('전체 정답', () => {
      const result = validateFillInBlank(answers, { 'slot-1': 'word-a', 'slot-2': 'word-c' });
      expect(result.allCorrect).toBe(true);
      expect(result.slotResults['slot-1']).toBe('correct');
      expect(result.slotResults['slot-2']).toBe('correct');
    });

    it('전체 오답', () => {
      const result = validateFillInBlank(answers, { 'slot-1': 'word-x', 'slot-2': 'word-y' });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['slot-1']).toBe('incorrect');
      expect(result.slotResults['slot-2']).toBe('incorrect');
    });

    it('부분 정답', () => {
      const result = validateFillInBlank(answers, { 'slot-1': 'word-b', 'slot-2': 'word-c' });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['slot-1']).toBe('partial');
      expect(result.slotResults['slot-2']).toBe('correct');
    });

    it('빈 슬롯 → incorrect', () => {
      const result = validateFillInBlank(answers, { 'slot-1': null, 'slot-2': null });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['slot-1']).toBe('incorrect');
    });

    it('하나만 정답', () => {
      const result = validateFillInBlank(answers, { 'slot-1': 'word-a', 'slot-2': 'word-wrong' });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['slot-1']).toBe('correct');
      expect(result.slotResults['slot-2']).toBe('incorrect');
    });
  });

  describe('validateSubPuzzle - character_id', () => {
    const puzzle: CharacterIdPuzzle = {
      id: 'char-puzzle',
      title: { ko: '인물 식별', en: 'Character ID' },
      type: 'character_id',
      characters: [
        { portrait: 'portrait-1', nameSlotId: 'name-1', answerId: 'word-john' },
        { portrait: 'portrait-2', nameSlotId: 'name-2', answerId: 'word-mary' },
      ],
    };

    it('전체 정답', () => {
      const result = validateSubPuzzle(puzzle, { 'name-1': 'word-john', 'name-2': 'word-mary' });
      expect(result.allCorrect).toBe(true);
    });

    it('일부 오답', () => {
      const result = validateSubPuzzle(puzzle, { 'name-1': 'word-john', 'name-2': 'word-wrong' });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['name-1']).toBe('correct');
      expect(result.slotResults['name-2']).toBe('incorrect');
    });
  });

  describe('validateSubPuzzle - timeline', () => {
    const puzzle: TimelinePuzzle = {
      id: 'timeline-puzzle',
      title: { ko: '타임라인', en: 'Timeline' },
      type: 'timeline',
      slots: [
        { slotId: 'time-1', label: { ko: '첫 번째', en: 'First' }, answerId: 'event-a' },
        { slotId: 'time-2', label: { ko: '두 번째', en: 'Second' }, answerId: 'event-b' },
      ],
    };

    it('정확한 순서', () => {
      const result = validateSubPuzzle(puzzle, { 'time-1': 'event-a', 'time-2': 'event-b' });
      expect(result.allCorrect).toBe(true);
    });

    it('잘못된 순서', () => {
      const result = validateSubPuzzle(puzzle, { 'time-1': 'event-b', 'time-2': 'event-a' });
      expect(result.allCorrect).toBe(false);
    });
  });
});
