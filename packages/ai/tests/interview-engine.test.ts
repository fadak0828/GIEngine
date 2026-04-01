/**
 * Unit tests for InterviewEngine core logic
 * AI 호출은 모킹하여 순수 로직만 검증합니다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InterviewEngine } from '../src/interview/interview-engine.js';
import { InterviewStage, INTERVIEW_STAGE_ORDER } from '../src/interview/types.js';
import type { InterviewSession } from '../src/interview/types.js';

// ─── GeminiClient 모킹 ────────────────────────────────────────────────────────

vi.mock('../src/client.js', () => ({
  geminiClient: {
    generateText: vi.fn(),
  },
}));

// 모킹된 geminiClient 참조
import { geminiClient } from '../src/client.js';
const mockGenerateText = vi.mocked(geminiClient.generateText);

// ─── 테스트 픽스처 ─────────────────────────────────────────────────────────────

function makeAiExtractionResponse(
  aiResponse: string,
  extractedInfo: object = {},
  sufficiencyScore = 0,
  isStageComplete = false,
): string {
  return JSON.stringify({ aiResponse, extractedInfo, sufficiencyScore, isStageComplete });
}

function makeAiQuestionResponse(aiResponse: string, questionType = 'initial'): string {
  return JSON.stringify({ aiResponse, questionType });
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

describe('InterviewEngine', () => {
  let engine: InterviewEngine;

  beforeEach(() => {
    engine = new InterviewEngine();
    vi.clearAllMocks();
  });

  // ── startSession ──────────────────────────────────────────────────────────

  describe('startSession', () => {
    it('새 세션을 초기화합니다', async () => {
      const session = await engine.startSession('ko');

      expect(session.status).toBe('active');
      expect(session.currentStage).toBe(InterviewStage.CASE_OVERVIEW);
      expect(session.completedStages).toHaveLength(0);
      expect(session.messages).toHaveLength(0);
      expect(session.collectedInfo).toEqual({});
      expect(session.locale).toBe('ko');
    });

    it('targetActId를 설정할 수 있습니다', async () => {
      const session = await engine.startSession('en', 'act-123');
      expect(session.targetActId).toBe('act-123');
    });

    it('각 세션은 고유한 ID를 가집니다', async () => {
      const s1 = await engine.startSession('ko');
      const s2 = await engine.startSession('ko');
      expect(s1.id).not.toBe(s2.id);
    });
  });

  // ── sendInitialQuestion ───────────────────────────────────────────────────

  describe('sendInitialQuestion', () => {
    it('AI 초기 질문을 생성하고 세션에 추가합니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeAiQuestionResponse('장르와 배경은 무엇인가요?'),
      );

      const session = await engine.startSession('ko');
      const { updatedSession, aiMessage } = await engine.sendInitialQuestion(session);

      expect(updatedSession.messages).toHaveLength(1);
      expect(aiMessage.role).toBe('ai');
      expect(aiMessage.stage).toBe(InterviewStage.CASE_OVERVIEW);
      expect(aiMessage.content).toBe('장르와 배경은 무엇인가요?');
      expect(aiMessage.metadata?.questionType).toBe('initial');
    });

    it('JSON 파싱 실패 시 raw 텍스트를 사용합니다', async () => {
      mockGenerateText.mockResolvedValueOnce('안녕하세요! 사건을 설명해주세요.');

      const session = await engine.startSession('ko');
      const { aiMessage } = await engine.sendInitialQuestion(session);

      expect(aiMessage.content).toBe('안녕하세요! 사건을 설명해주세요.');
    });
  });

  // ── processUserMessage ────────────────────────────────────────────────────

  describe('processUserMessage', () => {
    it('사용자 메시지와 AI 응답이 세션에 추가됩니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeAiExtractionResponse(
          '좋습니다! 더 자세히 알려주세요.',
          { overview: { genre: 'noir', setting: '1920년대 상하이' } },
          45,
          false,
        ),
      );

      const session = await engine.startSession('ko');
      const { updatedSession } = await engine.processUserMessage(
        session,
        '1920년대 상하이를 배경으로 한 누아르 스타일 사건입니다.',
      );

      expect(updatedSession.messages).toHaveLength(2); // user + ai
      expect(updatedSession.messages[0].role).toBe('user');
      expect(updatedSession.messages[1].role).toBe('ai');
    });

    it('수집된 정보가 세션에 반영됩니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeAiExtractionResponse(
          '좋아요.',
          { overview: { genre: 'noir', era: '1920년대', setting: '상하이' } },
          55,
          false,
        ),
      );

      const session = await engine.startSession('ko');
      const { updatedSession } = await engine.processUserMessage(session, '누아르 배경입니다.');

      expect(updatedSession.collectedInfo.overview?.genre).toBe('noir');
      expect(updatedSession.collectedInfo.overview?.era).toBe('1920년대');
    });

    it('충분성 임계값 미달 시 단계가 유지됩니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeAiExtractionResponse('더 알려주세요.', {}, 30, false),
      );

      const session = await engine.startSession('ko');
      const { updatedSession, stageAdvanced } = await engine.processUserMessage(
        session,
        '짧은 답변',
      );

      expect(stageAdvanced).toBe(false);
      expect(updatedSession.currentStage).toBe(InterviewStage.CASE_OVERVIEW);
      expect(updatedSession.followUpCounts[InterviewStage.CASE_OVERVIEW]).toBe(1);
    });

    it('충분성 충족 + 교환 횟수 충족 시 다음 단계로 전환됩니다', async () => {
      // 첫 번째 호출: 충분성 충족 (score=75, complete=true) → 다음 단계 전환
      // 두 번째 호출: 다음 단계(CORE_PLOT) 초기 질문 생성
      mockGenerateText
        .mockResolvedValueOnce(
          makeAiExtractionResponse(
            '완벽합니다!',
            { overview: { genre: 'mystery', era: '현대', setting: '서울' } },
            75,
            true,
          ),
        )
        .mockResolvedValueOnce(
          makeAiQuestionResponse('사건 내용을 설명해주세요.'),
        );

      // 먼저 최소 교환 횟수(2회)를 충족시키기 위해 이미 2회 교환했다고 가정
      let session = await engine.startSession('ko');
      // 가짜 메시지로 교환 횟수를 채움
      session = {
        ...session,
        messages: [
          { id: 'u1', role: 'user', content: '첫 답변', timestamp: 0, stage: InterviewStage.CASE_OVERVIEW },
          { id: 'a1', role: 'ai', content: 'AI 응답1', timestamp: 0, stage: InterviewStage.CASE_OVERVIEW },
        ],
      };

      const { updatedSession, stageAdvanced } = await engine.processUserMessage(
        session,
        '누아르 스타일로 서울 현대를 배경으로 합니다.',
      );

      expect(stageAdvanced).toBe(true);
      expect(updatedSession.currentStage).toBe(InterviewStage.CORE_PLOT);
      expect(updatedSession.completedStages).toContain(InterviewStage.CASE_OVERVIEW);
    });

    it('마지막 단계(PUZZLE_STRUCTURE) 완료 시 generating 상태로 전환됩니다', async () => {
      mockGenerateText.mockResolvedValueOnce(
        makeAiExtractionResponse(
          '모든 정보가 충분합니다!',
          { puzzle: { mainPuzzleHint: '진범은 집사였다', keyWords: ['집사', '칼', '장미원'] } },
          60,
          true,
        ),
      );

      let session = await engine.startSession('ko');
      // 마지막 단계로 강제 설정
      session = {
        ...session,
        currentStage: InterviewStage.PUZZLE_STRUCTURE,
        completedStages: INTERVIEW_STAGE_ORDER.slice(0, -1),
        messages: [
          { id: 'u1', role: 'user', content: '답1', timestamp: 0, stage: InterviewStage.PUZZLE_STRUCTURE },
          { id: 'u2', role: 'user', content: '답2', timestamp: 0, stage: InterviewStage.PUZZLE_STRUCTURE },
        ],
      };

      const { updatedSession, isCompleted, stageAdvanced } = await engine.processUserMessage(
        session,
        '진범은 집사이고 칼로 장미원에서 범행했습니다.',
      );

      expect(isCompleted).toBe(true);
      expect(stageAdvanced).toBe(true);
      expect(updatedSession.currentStage).toBe(InterviewStage.GENERATING);
      expect(updatedSession.status).toBe('generating');
    });
  });

  // ── advanceStage ──────────────────────────────────────────────────────────

  describe('advanceStage', () => {
    it('현재 단계를 완료하고 다음 단계로 이동합니다', async () => {
      const session = await engine.startSession('ko');
      const advanced = await engine.advanceStage(session);

      expect(advanced.currentStage).toBe(InterviewStage.CORE_PLOT);
      expect(advanced.completedStages).toContain(InterviewStage.CASE_OVERVIEW);
    });

    it('PUZZLE_STRUCTURE에서 advanceStage 시 GENERATING으로 전환됩니다', async () => {
      let session = await engine.startSession('ko');
      session = {
        ...session,
        currentStage: InterviewStage.PUZZLE_STRUCTURE,
        completedStages: INTERVIEW_STAGE_ORDER.slice(0, -1),
      };

      const advanced = await engine.advanceStage(session);

      expect(advanced.currentStage).toBe(InterviewStage.GENERATING);
      expect(advanced.status).toBe('generating');
    });

    it('이미 완료된 단계를 중복 추가하지 않습니다', async () => {
      let session = await engine.startSession('ko');
      session = {
        ...session,
        currentStage: InterviewStage.CORE_PLOT,
        completedStages: [InterviewStage.CASE_OVERVIEW],
      };

      const advanced = await engine.advanceStage(session);
      const overviewCount = advanced.completedStages.filter(
        (s) => s === InterviewStage.CASE_OVERVIEW,
      ).length;

      expect(overviewCount).toBe(1);
    });
  });

  // ── 전체 흐름 테스트 ─────────────────────────────────────────────────────────

  describe('전체 인터뷰 흐름', () => {
    it('세션 시작 → 초기 질문 → 사용자 응답 → 단계 전환 흐름이 작동합니다', async () => {
      // 초기 질문 생성
      mockGenerateText.mockResolvedValueOnce(
        makeAiQuestionResponse('이 사건은 어떤 장르인가요?'),
      );
      // 사용자 응답 처리 (충분성 부족)
      mockGenerateText.mockResolvedValueOnce(
        makeAiExtractionResponse(
          '좋습니다, 더 구체적으로 알려주세요.',
          { overview: { genre: 'mystery' } },
          40,
          false,
        ),
      );

      const engine2 = new InterviewEngine();
      let session = await engine2.startSession('ko');

      // 초기 질문
      const { updatedSession: s1 } = await engine2.sendInitialQuestion(session);
      expect(s1.messages).toHaveLength(1);
      expect(s1.messages[0].content).toBe('이 사건은 어떤 장르인가요?');

      // 사용자 답변 처리
      const { updatedSession: s2, stageAdvanced } = await engine2.processUserMessage(
        s1,
        '미스터리 장르입니다.',
      );

      expect(s2.messages).toHaveLength(3); // 초기 질문 + user + ai
      expect(s2.collectedInfo.overview?.genre).toBe('mystery');
      expect(stageAdvanced).toBe(false);
      expect(s2.currentStage).toBe(InterviewStage.CASE_OVERVIEW);
    });
  });
});
