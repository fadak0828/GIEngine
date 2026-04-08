import { describe, it, expect } from 'vitest';
import { validateSubPuzzle, validateFillInBlank } from '../src/validator/validator.js';
import type { Puzzle, CharacterIdPuzzle, TimelinePuzzle, RelationshipPuzzle } from '../src/models/types.js';

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
        { slotId: 'time-3', label: { ko: '세 번째', en: 'Third' }, answerId: 'event-c' },
      ],
    };

    it('정확한 순서 → allCorrect: true', () => {
      const result = validateSubPuzzle(puzzle, {
        'time-1': 'event-a',
        'time-2': 'event-b',
        'time-3': 'event-c',
      });
      expect(result.allCorrect).toBe(true);
      expect(result.slotResults['time-1']).toBe('correct');
      expect(result.slotResults['time-2']).toBe('correct');
      expect(result.slotResults['time-3']).toBe('correct');
    });

    it('잘못된 순서 → allCorrect: false, 해당 슬롯 incorrect', () => {
      const result = validateSubPuzzle(puzzle, {
        'time-1': 'event-b',
        'time-2': 'event-a',
        'time-3': 'event-c',
      });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['time-1']).toBe('incorrect');
      expect(result.slotResults['time-2']).toBe('incorrect');
      expect(result.slotResults['time-3']).toBe('correct');
    });

    it('미배정 슬롯 → allCorrect: false', () => {
      const result = validateSubPuzzle(puzzle, {
        'time-1': 'event-a',
        'time-2': null,
        'time-3': null,
      });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['time-1']).toBe('correct');
      expect(result.slotResults['time-2']).toBe('incorrect');
    });

    it('충돌 감지: 동일 이벤트 중복 배정 → 해당 슬롯 모두 incorrect', () => {
      const result = validateSubPuzzle(puzzle, {
        'time-1': 'event-a',
        'time-2': 'event-a',  // 중복!
        'time-3': 'event-c',
      });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['time-1']).toBe('incorrect'); // 중복으로 incorrect
      expect(result.slotResults['time-2']).toBe('incorrect'); // 중복으로 incorrect
      expect(result.slotResults['time-3']).toBe('correct');  // 중복 없음
    });

    it('충돌 감지: 세 슬롯 모두 같은 이벤트 → 전체 incorrect', () => {
      const result = validateSubPuzzle(puzzle, {
        'time-1': 'event-a',
        'time-2': 'event-a',
        'time-3': 'event-a',
      });
      expect(result.allCorrect).toBe(false);
      expect(Object.values(result.slotResults).every(r => r === 'incorrect')).toBe(true);
    });

    it('전체 미배정 → allCorrect: false, 전체 incorrect', () => {
      const result = validateSubPuzzle(puzzle, {
        'time-1': null,
        'time-2': null,
        'time-3': null,
      });
      expect(result.allCorrect).toBe(false);
      expect(Object.values(result.slotResults).every(r => r === 'incorrect')).toBe(true);
    });

    it('슬롯이 없는 타임라인 → allCorrect: true (vacuously)', () => {
      const emptyPuzzle: TimelinePuzzle = {
        id: 'empty-timeline',
        title: { ko: '빈 타임라인', en: 'Empty Timeline' },
        type: 'timeline',
        slots: [],
      };
      const result = validateSubPuzzle(emptyPuzzle, {});
      expect(result.allCorrect).toBe(true);
    });
  });

  describe('validateSubPuzzle - relationship', () => {
    const puzzle: RelationshipPuzzle = {
      id: 'rel-puzzle',
      title: { ko: '관계도', en: 'Relationship' },
      type: 'relationship',
      nodes: [
        { id: 'char-a', label: { ko: '인물 A', en: 'Char A' } },
        { id: 'char-b', label: { ko: '인물 B', en: 'Char B' } },
        { id: 'char-c', label: { ko: '인물 C', en: 'Char C' } },
      ],
      edges: [
        { fromNodeId: 'char-a', toNodeId: 'char-b', slotId: 'edge-ab', answerId: 'rel-friend' },
        { fromNodeId: 'char-b', toNodeId: 'char-a', slotId: 'edge-ba', answerId: 'rel-friend' },
        { fromNodeId: 'char-a', toNodeId: 'char-c', slotId: 'edge-ac', answerId: 'rel-enemy' },
      ],
    };

    it('전체 정답 → allCorrect: true', () => {
      const result = validateSubPuzzle(puzzle, {
        'edge-ab': 'rel-friend',
        'edge-ba': 'rel-friend',
        'edge-ac': 'rel-enemy',
      });
      expect(result.allCorrect).toBe(true);
      expect(result.slotResults['edge-ab']).toBe('correct');
      expect(result.slotResults['edge-ba']).toBe('correct');
      expect(result.slotResults['edge-ac']).toBe('correct');
    });

    it('일부 오답 → allCorrect: false', () => {
      const result = validateSubPuzzle(puzzle, {
        'edge-ab': 'rel-friend',
        'edge-ba': 'rel-wrong',
        'edge-ac': 'rel-enemy',
      });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['edge-ab']).toBe('correct');
      expect(result.slotResults['edge-ba']).toBe('incorrect');
      expect(result.slotResults['edge-ac']).toBe('correct');
    });

    it('미배정 엣지 → allCorrect: false', () => {
      const result = validateSubPuzzle(puzzle, {
        'edge-ab': 'rel-friend',
        'edge-ba': null,
        'edge-ac': 'rel-enemy',
      });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['edge-ba']).toBe('incorrect');
    });

    it('엣지가 없는 관계 퍼즐 → allCorrect: true (vacuously)', () => {
      const emptyPuzzle: RelationshipPuzzle = {
        id: 'empty-rel',
        title: { ko: '빈 관계도', en: 'Empty Rel' },
        type: 'relationship',
        nodes: [],
        edges: [],
      };
      const result = validateSubPuzzle(emptyPuzzle, {});
      expect(result.allCorrect).toBe(true);
    });

    it('대칭 검증: 역방향 엣지와 다른 단어 배정 시 → 양쪽 incorrect', () => {
      const symPuzzle: RelationshipPuzzle = {
        id: 'sym-puzzle',
        title: { ko: '대칭 관계', en: 'Symmetric Rel' },
        type: 'relationship',
        nodes: [
          { id: 'p1', label: { ko: '인물1', en: 'P1' } },
          { id: 'p2', label: { ko: '인물2', en: 'P2' } },
        ],
        edges: [
          { fromNodeId: 'p1', toNodeId: 'p2', slotId: 'slot-12', answerId: 'rel-ally', symmetric: true },
          { fromNodeId: 'p2', toNodeId: 'p1', slotId: 'slot-21', answerId: 'rel-ally', symmetric: true },
        ],
      };
      const result = validateSubPuzzle(symPuzzle, {
        'slot-12': 'rel-ally',
        'slot-21': 'rel-enemy',  // 대칭 위반!
      });
      expect(result.allCorrect).toBe(false);
      expect(result.slotResults['slot-12']).toBe('incorrect');
      expect(result.slotResults['slot-21']).toBe('incorrect');
    });

    it('대칭 검증: 역방향 엣지와 동일 단어 배정 시 → 정상 검증 진행', () => {
      const symPuzzle: RelationshipPuzzle = {
        id: 'sym-puzzle-ok',
        title: { ko: '대칭 관계 정답', en: 'Symmetric OK' },
        type: 'relationship',
        nodes: [
          { id: 'p1', label: { ko: '인물1', en: 'P1' } },
          { id: 'p2', label: { ko: '인물2', en: 'P2' } },
        ],
        edges: [
          { fromNodeId: 'p1', toNodeId: 'p2', slotId: 'slot-12', answerId: 'rel-ally', symmetric: true },
          { fromNodeId: 'p2', toNodeId: 'p1', slotId: 'slot-21', answerId: 'rel-ally', symmetric: true },
        ],
      };
      const result = validateSubPuzzle(symPuzzle, {
        'slot-12': 'rel-ally',
        'slot-21': 'rel-ally',
      });
      expect(result.allCorrect).toBe(true);
      expect(result.slotResults['slot-12']).toBe('correct');
      expect(result.slotResults['slot-21']).toBe('correct');
    });

    it('대칭 없는 단방향 관계 → 독립적으로 검증', () => {
      const result = validateSubPuzzle(puzzle, {
        'edge-ab': 'rel-friend',
        'edge-ba': 'rel-wrong',  // answerId와 불일치, symmetric 미설정
        'edge-ac': 'rel-enemy',
      });
      expect(result.slotResults['edge-ab']).toBe('correct');
      expect(result.slotResults['edge-ba']).toBe('incorrect');
      expect(result.slotResults['edge-ac']).toBe('correct');
    });
  });
});
