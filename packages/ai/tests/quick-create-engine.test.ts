/**
 * Phase 4 QA: QuickCreateEngine 통합 테스트
 *
 * 검증 항목:
 * 1. 타입 안전성 (QuickCreateEngine <-> CaseBlueprint <-> Case)
 * 2. 기존 인터뷰 호환성 유지
 * 3. E2E 흐름: 1문장 입력 → 블루프린트 생성
 * 4. 엣지 케이스: 빈 입력, 초긴 입력, 특수문자
 * 5. 성능: 생성 시간 < 30초 (모킹 기반 검증)
 * 6. 폴백 전략
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickCreateEngine } from '../src/quick-create/quick-create-engine.js';
import { InterviewEngine } from '../src/interview/interview-engine.js';
import { InterviewStage } from '../src/interview/types.js';
import type { CaseBlueprint } from '../src/interview/types.js';
import type { QuickCreateProgress } from '../src/quick-create/types.js';

// ─── GeminiClient 모킹 ────────────────────────────────────────────────────────

vi.mock('../src/client.js', () => ({
  geminiClient: {
    generateText: vi.fn(),
  },
}));

import { geminiClient } from '../src/client.js';
const mockGenerateText = vi.mocked(geminiClient.generateText);

// ─── 테스트 픽스처 ─────────────────────────────────────────────────────────────

/** 최소 유효 CaseBlueprint JSON (AI 응답 시뮬레이션) */
function makeBlueprintJson(overrides: Partial<object> = {}): string {
  const base = {
    title: { ko: '카페 독살 사건', en: 'Cafe Poisoning Case' },
    description: { ko: '점심시간 카페에서 독이 든 커피가 발견됐다.', en: 'A poisoned coffee was found.' },
    genre: 'mystery',
    characters: [
      {
        name: '김민준',
        role: 'culprit',
        description: '카페 바리스타',
        alibi: '주방에 있었다고 주장',
        relationships: [{ targetName: '이서연', relationship: '동료' }],
      },
      {
        name: '이서연',
        role: 'victim',
        description: '카페 단골손님',
        relationships: [{ targetName: '김민준', relationship: '아는 사이' }],
      },
      {
        name: '박지현',
        role: 'witness',
        description: '옆 테이블에 앉았던 손님',
        relationships: [],
      },
    ],
    scenes: [
      {
        tempId: 'scene_cafe',
        name: { ko: '카페 메인홀', en: 'Cafe Main Hall' },
        description: '범행이 일어난 카페 내부',
        connections: ['scene_kitchen'],
        hotspotHints: [
          { label: '커피잔', actionType: 'examine', contentHint: '독이 검출됐다' },
          { label: '영수증', actionType: 'word_reveal', contentHint: '바리스타 주문 내역' },
        ],
      },
      {
        tempId: 'scene_kitchen',
        name: { ko: '주방', en: 'Kitchen' },
        description: '바리스타가 커피를 만든 장소',
        connections: ['scene_cafe'],
        hotspotHints: [
          { label: '독약병', actionType: 'examine', contentHint: '독이 든 작은 병' },
        ],
      },
    ],
    words: [
      {
        tempId: 'word_barista',
        display: { ko: '바리스타', en: 'Barista' },
        category: 'person',
        hint: { ko: '카페 직원', en: 'Cafe staff' },
        sourceSceneTempId: 'scene_cafe',
      },
      {
        tempId: 'word_poison',
        display: { ko: '독약', en: 'Poison' },
        category: 'item',
        hint: { ko: '치명적인 물질', en: 'Deadly substance' },
        sourceSceneTempId: 'scene_kitchen',
      },
      {
        tempId: 'word_coffee',
        display: { ko: '커피잔', en: 'Coffee Cup' },
        category: 'item',
        hint: { ko: '피해자가 마신 컵', en: "Victim's cup" },
        sourceSceneTempId: 'scene_cafe',
      },
      {
        tempId: 'word_motive',
        display: { ko: '원한', en: 'Grudge' },
        category: 'concept',
        hint: { ko: '범행 동기', en: 'Motive' },
        sourceSceneTempId: 'scene_cafe',
      },
      {
        tempId: 'word_receipt',
        display: { ko: '영수증', en: 'Receipt' },
        category: 'item',
        hint: { ko: '주문 내역서', en: 'Order record' },
        sourceSceneTempId: 'scene_cafe',
      },
    ],
    mainPuzzle: {
      titleHint: '범인을 밝혀라',
      descriptionHint: '카페에서 독살한 자는 누구인가?',
      templateDescription: '범인은 [빈칸1]이고, 사용한 도구는 [빈칸2]다',
      requiredWordTempIds: ['word_barista', 'word_poison'],
    },
    subPuzzles: [
      {
        type: 'character_id',
        description: '용의자 신원 확인',
        characterNames: ['김민준'],
      },
    ],
  };
  return JSON.stringify({ ...base, ...overrides });
}

/** 선택지 JSON (선택지 생성 모킹) */
function makeChoicesJson(): string {
  return JSON.stringify([
    { id: 'option_1', label: '기본 구성', summary: '원본 유지' },
    { id: 'option_2', label: '복잡화', summary: '관계 추가' },
    { id: 'option_3', label: '단순화', summary: '핵심만 유지' },
    { id: 'option_4', label: '역전 구성', summary: '의외의 범인' },
  ]);
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

describe('QuickCreateEngine', () => {
  let engine: QuickCreateEngine;

  beforeEach(() => {
    engine = new QuickCreateEngine();
    // mockReset: mockResolvedValueOnce 큐 + 구현 완전 초기화 (테스트 간 오염 방지)
    // clearAllMocks는 호출 이력만 삭제하고 큐는 남김 -> 테스트 간 오염 발생
    mockGenerateText.mockReset();
  });

  // ── 1. 타입 안전성 ────────────────────────────────────────────────────────────

  describe('타입 안전성', () => {
    it('startFromSentence가 CaseBlueprint 타입을 반환합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const result = await engine.startFromSentence('카페에서 독살 사건이 발생했다');

      // 필수 필드 타입 검증
      const bp: CaseBlueprint = result.blueprint;
      expect(typeof bp.id).toBe('string');
      expect(typeof bp.sessionId).toBe('string');
      expect(typeof bp.generatedAt).toBe('number');
      expect(typeof bp.title.ko).toBe('string');
      expect(typeof bp.genre).toBe('string');
      expect(Array.isArray(bp.characters)).toBe(true);
      expect(Array.isArray(bp.scenes)).toBe(true);
      expect(Array.isArray(bp.words)).toBe(true);
      expect(typeof bp.mainPuzzle).toBe('object');
    });

    it('BlueprintCharacter 필드가 올바른 역할 값을 가집니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const { blueprint } = await engine.startFromSentence('테스트 문장');

      const validRoles = ['culprit', 'victim', 'witness', 'suspect'];
      blueprint.characters.forEach(char => {
        expect(validRoles).toContain(char.role);
        expect(typeof char.name).toBe('string');
        expect(typeof char.description).toBe('string');
        expect(Array.isArray(char.relationships)).toBe(true);
      });
    });

    it('BlueprintScene hotspotHints가 올바른 actionType을 가집니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const { blueprint } = await engine.startFromSentence('테스트 문장');

      const validActions = ['examine', 'examine_image', 'word_reveal', 'navigate'];
      blueprint.scenes.forEach(scene => {
        expect(typeof scene.tempId).toBe('string');
        expect(typeof scene.name.ko).toBe('string');
        scene.hotspotHints.forEach(hint => {
          expect(validActions).toContain(hint.actionType);
          expect(typeof hint.label).toBe('string');
          expect(typeof hint.contentHint).toBe('string');
        });
      });
    });

    it('BlueprintWord category가 유효한 WordCategory입니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const { blueprint } = await engine.startFromSentence('테스트 문장');

      blueprint.words.forEach(word => {
        expect(typeof word.tempId).toBe('string');
        expect(typeof word.display.ko).toBe('string');
        expect(typeof word.category).toBe('string');
      });
    });

    it('mainPuzzle.requiredWordTempIds가 실제 word tempId를 참조합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const { blueprint } = await engine.startFromSentence('테스트 문장');

      const wordTempIds = new Set(blueprint.words.map(w => w.tempId));
      blueprint.mainPuzzle.requiredWordTempIds.forEach(id => {
        expect(wordTempIds.has(id)).toBe(true);
      });
    });
  });

  // ── 2. E2E 흐름 ───────────────────────────────────────────────────────────────

  describe('E2E 흐름: 1문장 → 블루프린트 생성', () => {
    it('단일 문장에서 완전한 CaseBlueprint를 생성합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const result = await engine.startFromSentence(
        '점심시간 카페에서 파티시에 바리스타가 독을 넣었다',
      );

      expect(result.blueprint).toBeDefined();
      expect(result.blueprint.id).toBeTruthy();
      expect(result.blueprint.characters.length).toBeGreaterThanOrEqual(2);
      expect(result.blueprint.scenes.length).toBeGreaterThanOrEqual(2);
      expect(result.blueprint.words.length).toBeGreaterThanOrEqual(5);
      expect(result.choices).toBeUndefined(); // withChoices=false 기본값
    });

    it('withChoices=true 시 선택지를 함께 반환합니다', async () => {
      // 블루프린트 생성 + 4개 섹션 선택지 생성 (5회 호출)
      mockGenerateText
        .mockResolvedValueOnce(makeBlueprintJson())        // blueprint
        .mockResolvedValue(makeChoicesJson());             // 4 choice sections

      const result = await engine.startFromSentence('카페 독살 사건', { withChoices: true });

      expect(result.blueprint).toBeDefined();
      expect(result.choices).toBeDefined();
      expect(result.choices?.characters).toHaveLength(4);
      expect(result.choices?.scenes).toHaveLength(4);
      expect(result.choices?.puzzleStructure).toHaveLength(4);
      expect(result.choices?.atmosphere).toHaveLength(4);
    });

    it('진행률 콜백이 올바른 순서로 호출됩니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const progressEvents: QuickCreateProgress[] = [];
      await engine.startFromSentence('테스트 문장', {
        onProgress: progress => progressEvents.push(progress),
      });

      expect(progressEvents.length).toBeGreaterThanOrEqual(2);
      expect(progressEvents[0].step).toBe('blueprint_generating');
      expect(progressEvents[0].percent).toBe(10);

      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.step).toBe('completed');
      expect(lastEvent.percent).toBe(100);
    });

    it('장르/분위기/시대 옵션이 전달됩니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const result = await engine.startFromSentence('조선시대 궁궐에서 독살 사건', {
        genre: 'historical',
        atmosphere: '어두운',
        era: '조선시대',
        locale: 'ko',
      });

      expect(result.blueprint).toBeDefined();
      // 옵션이 전달되어 AI 호출이 1회 이루어졌음을 확인
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('applyChoicesToBlueprint가 선택 사항을 반영한 블루프린트를 반환합니다', async () => {
      mockGenerateText
        .mockResolvedValueOnce(makeBlueprintJson())         // 최초 생성
        .mockResolvedValueOnce(makeBlueprintJson({ title: { ko: '개선된 사건', en: 'Improved' } }));  // 선택지 반영

      const { blueprint } = await engine.startFromSentence('카페 독살 사건');
      const updated = await engine.applyChoicesToBlueprint(
        '카페 독살 사건',
        blueprint,
        { characters: 'option_2' },
        {
          characters: [
            { id: 'option_1', label: '기본', summary: '유지' },
            { id: 'option_2', label: '복잡화', summary: '관계 추가' },
          ],
          scenes: [],
          puzzleStructure: [],
          atmosphere: [],
        },
      );

      expect(updated.blueprint.id).toBeTruthy();
      // sessionId는 원본 블루프린트와 동일해야 함
      expect(updated.blueprint.sessionId).toBe(blueprint.sessionId);
    });
  });

  // ── 3. 엣지 케이스 ────────────────────────────────────────────────────────────

  describe('엣지 케이스', () => {
    it('빈 문자열 입력 시에도 API 호출을 진행합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const result = await engine.startFromSentence('');

      expect(result.blueprint).toBeDefined();
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('매우 긴 입력(500자 이상)에서도 정상 처리합니다', async () => {
      const longSentence = '카페에서 독살 사건이 발생했다. '.repeat(30); // ~450자
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const result = await engine.startFromSentence(longSentence);

      expect(result.blueprint).toBeDefined();
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('특수문자가 포함된 입력을 처리합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const result = await engine.startFromSentence(
        '카페 "블루문"에서 CEO & COO가 독살됐다! <테스트>',
      );

      expect(result.blueprint).toBeDefined();
    });

    it('한국어/영어 혼합 입력을 처리합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const result = await engine.startFromSentence(
        'The 카페 manager poisoned 커피 during 점심시간',
      );

      expect(result.blueprint).toBeDefined();
    });

    it('AI가 마크다운 코드펜스로 감싼 JSON을 파싱합니다', async () => {
      const withFence = `\`\`\`json\n${makeBlueprintJson()}\n\`\`\``;
      mockGenerateText.mockResolvedValueOnce(withFence);

      const result = await engine.startFromSentence('테스트 문장');

      expect(result.blueprint.title.ko).toBe('카페 독살 사건');
    });

    it('AI 응답이 빈 배열(subPuzzles=[])이어도 처리합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeBlueprintJson({ subPuzzles: [] }),
      );

      const result = await engine.startFromSentence('테스트 문장');

      expect(result.blueprint.subPuzzles).toEqual([]);
    });
  });

  // ── 4. 검증 로직 ──────────────────────────────────────────────────────────────

  describe('블루프린트 검증 로직', () => {
    it('필수 필드 누락 시 에러를 throw합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        JSON.stringify({ title: { ko: '미완성' }, genre: 'mystery' }), // characters 등 누락
      );

      await expect(engine.startFromSentence('테스트')).rejects.toThrow(
        /CaseBlueprint 검증 실패/,
      );
    });

    it('캐릭터가 1명이면 에러를 throw합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeBlueprintJson({
          characters: [{ name: '혼자', role: 'culprit', description: '유일한 인물', relationships: [] }],
        }),
      );

      await expect(engine.startFromSentence('테스트')).rejects.toThrow(
        /최소 2명/,
      );
    });

    it('씬이 1개이면 에러를 throw합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeBlueprintJson({
          scenes: [
            {
              tempId: 'only_scene',
              name: { ko: '유일한 씬', en: 'Only Scene' },
              description: '혼자',
              connections: [],
              hotspotHints: [],
            },
          ],
        }),
      );

      await expect(engine.startFromSentence('테스트')).rejects.toThrow(
        /최소 2개/,
      );
    });

    it('단어가 4개 이하이면 에러를 throw합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeBlueprintJson({
          words: [
            { tempId: 'w1', display: { ko: '단어1', en: 'w1' }, category: 'person' },
            { tempId: 'w2', display: { ko: '단어2', en: 'w2' }, category: 'item' },
            { tempId: 'w3', display: { ko: '단어3', en: 'w3' }, category: 'place' },
            { tempId: 'w4', display: { ko: '단어4', en: 'w4' }, category: 'item' },
          ],
        }),
      );

      await expect(engine.startFromSentence('테스트')).rejects.toThrow(
        /최소 5개/,
      );
    });

    it('유효하지 않은 JSON 응답 시 파싱 에러를 throw합니다', async () => {
      mockGenerateText.mockResolvedValueOnce('이것은 JSON이 아닙니다.');

      await expect(engine.startFromSentence('테스트')).rejects.toThrow(
        /CaseBlueprint 파싱 실패/,
      );
    });
  });

  // ── 5. 성능 검증 ─────────────────────────────────────────────────────────────

  describe('성능 검증', () => {
    it('블루프린트 생성이 30초 이내에 완료됩니다 (모킹 환경)', async () => {
      // 실제 환경에서는 AI API 지연이 있지만, 모킹 환경에서는 즉시 응답
      // 이 테스트는 엔진 내부 오버헤드가 없음을 확인합니다
      mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());

      const startTime = Date.now();
      await engine.startFromSentence('성능 테스트 문장');
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1000); // 모킹 환경: 1초 이내
    });

    it('withChoices=true 시 선택지 생성이 병렬로 처리됩니다', async () => {
      // 4개 섹션이 병렬 처리되므로 순차 대비 빠름을 간접 확인
      let callOrder: number[] = [];
      mockGenerateText.mockImplementation(async (_prompt: string, model: string) => {
        if (model.includes('pro')) {
          callOrder.push(0); // 블루프린트 먼저
          return makeBlueprintJson();
        }
        callOrder.push(1); // 선택지 생성
        return makeChoicesJson();
      });

      const startTime = Date.now();
      await engine.startFromSentence('병렬 성능 테스트', { withChoices: true });
      const elapsed = Date.now() - startTime;

      // 블루프린트는 pro, 선택지는 flash 모델
      expect(callOrder[0]).toBe(0); // 블루프린트가 먼저 호출
      expect(elapsed).toBeLessThan(2000);
    });

    it('각 세션은 고유한 sessionId를 가집니다', async () => {
      mockGenerateText.mockResolvedValue(makeBlueprintJson());

      const [r1, r2, r3] = await Promise.all([
        engine.startFromSentence('사건1'),
        engine.startFromSentence('사건2'),
        engine.startFromSentence('사건3'),
      ]);

      const ids = [r1.blueprint.sessionId, r2.blueprint.sessionId, r3.blueprint.sessionId];
      const unique = new Set(ids);
      expect(unique.size).toBe(3);
    });
  });

  // ── 6. 폴백 전략 ─────────────────────────────────────────────────────────────

  describe('폴백 전략', () => {
    it('createFallbackBlueprint가 유효한 CaseBlueprint를 반환합니다', () => {
      const fallback = engine.createFallbackBlueprint('카페 독살 사건');

      expect(fallback.id).toBeTruthy();
      expect(fallback.sessionId).toBeTruthy();
      expect(fallback.generatedAt).toBeGreaterThan(0);
      expect(fallback.title.ko).toBe('미완성 사건');
      expect(fallback.characters.length).toBeGreaterThanOrEqual(2);
      expect(fallback.scenes.length).toBeGreaterThanOrEqual(1);
      expect(fallback.words.length).toBeGreaterThanOrEqual(2);
      expect(fallback.mainPuzzle).toBeDefined();
    });

    it('선택지 생성 실패 시 폴백 선택지를 반환합니다', async () => {
      mockGenerateText
        .mockResolvedValueOnce(makeBlueprintJson())           // blueprint
        .mockRejectedValue(new Error('API rate limit'));       // choices 실패

      const result = await engine.startFromSentence('카페 독살', { withChoices: true });

      // 선택지 생성 실패 시 폴백으로 빈 배열 또는 기본값이 반환됨
      expect(result.choices).toBeDefined();
    });
  });
});

// ─── 기존 인터뷰 호환성 ────────────────────────────────────────────────────────

describe('기존 인터뷰 호환성', () => {
  it('InterviewEngine과 QuickCreateEngine이 독립적으로 동작합니다', async () => {
    const interviewEngine = new InterviewEngine();
    const quickEngine = new QuickCreateEngine();

    // 인터뷰 엔진 세션 시작 (AI 호출 없음)
    const session = await interviewEngine.startSession('ko');

    // Quick Create 엔진으로 블루프린트 생성
    mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());
    const { blueprint } = await quickEngine.startFromSentence('독립적인 사건');

    expect(session.currentStage).toBe(InterviewStage.CASE_OVERVIEW);
    expect(blueprint.id).toBeTruthy();
  });

  it('인터뷰 엔진 세션이 QuickCreateEngine과 상태를 공유하지 않습니다', async () => {
    const interviewEngine = new InterviewEngine();
    const quickEngine = new QuickCreateEngine();

    mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());
    const { blueprint } = await quickEngine.startFromSentence('독립 테스트');

    // 인터뷰 세션을 새로 시작해도 Quick Create 결과와 무관
    const session = await interviewEngine.startSession('ko');

    expect(session.id).not.toBe(blueprint.sessionId);
    expect(session.status).toBe('active');
    expect(blueprint.generatedAt).toBeGreaterThan(0);
  });

  it('CaseBlueprint 타입이 인터뷰 엔진과 Quick Create 엔진에서 동일하게 사용됩니다', async () => {
    mockGenerateText.mockResolvedValueOnce(makeBlueprintJson());
    const { blueprint } = await new QuickCreateEngine().startFromSentence('타입 호환성 테스트');

    // CaseBlueprint 필수 필드 구조 검증 (interview/types.ts 기준)
    expect('id' in blueprint).toBe(true);
    expect('sessionId' in blueprint).toBe(true);
    expect('generatedAt' in blueprint).toBe(true);
    expect('title' in blueprint).toBe(true);
    expect('characters' in blueprint).toBe(true);
    expect('scenes' in blueprint).toBe(true);
    expect('words' in blueprint).toBe(true);
    expect('mainPuzzle' in blueprint).toBe(true);
    expect('subPuzzles' in blueprint).toBe(true);
  });
});
